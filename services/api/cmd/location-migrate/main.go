// GoreeCloud Location database migration command.
//
// This command deliberately uses the same database configuration package and
// pgx connection path as the API so migration and runtime readiness cannot
// silently target different PostgreSQL endpoints.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/GoreeCloud/goreecloud-location/services/api/internal/config"
	"github.com/GoreeCloud/goreecloud-location/services/api/internal/migrate"
	"github.com/jackc/pgx/v5/pgxpool"
)

const migrationTimeout = 2 * time.Minute

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	directory := flag.String("dir", migrationDirectoryFromEnvironment(), "directory containing ordered SQL migrations")
	flag.Parse()

	databaseURL, err := config.DatabaseURLFromEnvironment()
	if err != nil {
		logger.Error("invalid database configuration", "error", err)
		os.Exit(1)
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		logger.Error("could not parse database configuration", "error", err)
		os.Exit(1)
	}
	if poolConfig.ConnConfig.Database == "" {
		logger.Error("database configuration did not select a database")
		os.Exit(1)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		logger.Error("could not initialize database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), migrationTimeout)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		logger.Error("database is unavailable for migrations", "database", poolConfig.ConnConfig.Database, "error", err)
		os.Exit(1)
	}

	applied, err := migrate.ApplyDirectory(ctx, pool, *directory)
	if err != nil {
		logger.Error("database migration failed", "database", poolConfig.ConnConfig.Database, "error", err)
		os.Exit(1)
	}
	for _, name := range applied {
		fmt.Printf("applied %s\n", name)
	}
}

func migrationDirectoryFromEnvironment() string {
	if directory := strings.TrimSpace(os.Getenv("LOCATION_MIGRATIONS_DIR")); directory != "" {
		return directory
	}
	return "../../migrations"
}
