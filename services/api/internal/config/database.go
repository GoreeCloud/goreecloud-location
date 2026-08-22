package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"strings"
)

const defaultDatabasePort = "5432"

func DatabaseURLFromEnvironment() (string, error) {
	host := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_HOST"))
	if host == "" {
		return "", errors.New("LOCATION_DATABASE_HOST is required")
	}

	port := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_PORT"))
	if port == "" {
		port = defaultDatabasePort
	}

	name := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_NAME"))
	if name == "" {
		return "", errors.New("LOCATION_DATABASE_NAME is required")
	}

	user := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_USER"))
	if user == "" {
		return "", errors.New("LOCATION_DATABASE_USER is required")
	}

	password, err := databasePasswordFromEnvironment()
	if err != nil {
		return "", err
	}

	sslmode := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_SSLMODE"))
	if sslmode == "" {
		sslmode = "require"
	}

	databaseURL := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, password),
		Host:   net.JoinHostPort(host, port),
		Path:   "/" + name,
	}
	query := databaseURL.Query()
	query.Set("sslmode", sslmode)
	databaseURL.RawQuery = query.Encode()
	return databaseURL.String(), nil
}

func databasePasswordFromEnvironment() (string, error) {
	if password := os.Getenv("LOCATION_DATABASE_PASSWORD"); password != "" {
		return password, nil
	}

	path := strings.TrimSpace(os.Getenv("LOCATION_DATABASE_PASSWORD_FILE"))
	if path == "" {
		return "", errors.New("LOCATION_DATABASE_PASSWORD or LOCATION_DATABASE_PASSWORD_FILE is required")
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read database password file: %w", err)
	}
	password := strings.TrimSpace(string(content))
	if password == "" {
		return "", errors.New("database password file is empty")
	}
	return password, nil
}
