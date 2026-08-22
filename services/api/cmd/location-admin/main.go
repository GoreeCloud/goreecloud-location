package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/GoreeCloud/goreecloud-location/services/api/internal/config"
	"github.com/GoreeCloud/goreecloud-location/services/api/internal/identity"
	"github.com/jackc/pgx/v5/pgxpool"
)

type createUserResult struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	Token       string `json:"token"`
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: location-admin create-user --display-name NAME")
	}

	switch args[0] {
	case "create-user":
		return createUser(args[1:])
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func createUser(args []string) error {
	flags := flag.NewFlagSet("create-user", flag.ContinueOnError)
	flags.SetOutput(os.Stderr)
	displayName := flags.String("display-name", "", "user display name")
	label := flags.String("token-label", "initial admin-provisioned access", "access token label")
	if err := flags.Parse(args); err != nil {
		return err
	}

	*displayName = strings.TrimSpace(*displayName)
	*label = strings.TrimSpace(*label)
	if *displayName == "" || len(*displayName) > 100 {
		return errors.New("display name must contain 1-100 characters")
	}
	if *label == "" || len(*label) > 100 {
		return errors.New("token label must contain 1-100 characters")
	}

	databaseURL, err := config.DatabaseURLFromEnvironment()
	if err != nil {
		return fmt.Errorf("database configuration: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("database unavailable: %w", err)
	}

	userID, err := identity.NewUUID()
	if err != nil {
		return err
	}
	tokenID, err := identity.NewUUID()
	if err != nil {
		return err
	}
	token, tokenHash, err := identity.NewOpaqueToken("loc_usr_")
	if err != nil {
		return err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		INSERT INTO users(id, display_name) VALUES ($1, $2)
	`, userID, *displayName); err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_preferences(user_id) VALUES ($1)
	`, userID); err != nil {
		return fmt.Errorf("create user preferences: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO user_access_tokens(id, user_id, token_hash, label)
		VALUES ($1, $2, $3, $4)
	`, tokenID, userID, tokenHash, *label); err != nil {
		return fmt.Errorf("create user token: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit user creation: %w", err)
	}

	if err := json.NewEncoder(os.Stdout).Encode(createUserResult{
		UserID: userID, DisplayName: *displayName, Token: token,
	}); err != nil && !errors.Is(err, os.ErrClosed) {
		return fmt.Errorf("encode result: %w", err)
	}
	fmt.Fprintln(os.Stderr, "Created user and one access token. Store the token securely; only its hash is persisted.")
	return nil
}
