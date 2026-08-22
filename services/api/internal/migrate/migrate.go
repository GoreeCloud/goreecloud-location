package migrate

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ApplyDirectory applies every unrecorded .sql migration in lexical filename
// order using one PostgreSQL connection. Each migration file owns its transaction
// boundary and must record its filename (without .sql) in schema_migrations.
func ApplyDirectory(ctx context.Context, pool *pgxpool.Pool, directory string) ([]string, error) {
	files, err := migrationFiles(directory)
	if err != nil {
		return nil, err
	}

	connection, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquire migration connection: %w", err)
	}
	defer connection.Release()

	applied := make([]string, 0, len(files))
	for _, path := range files {
		name := filepath.Base(path)
		version := strings.TrimSuffix(name, filepath.Ext(name))

		recorded, err := migrationRecorded(ctx, connection, version)
		if err != nil {
			return applied, fmt.Errorf("check migration %s: %w", name, err)
		}
		if recorded {
			continue
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return applied, fmt.Errorf("read migration %s: %w", name, err)
		}

		// PgConn.Exec uses PostgreSQL's simple-query protocol, which is appropriate
		// for migration files that deliberately contain transaction blocks and
		// multiple SQL statements.
		if _, err := connection.Conn().PgConn().Exec(ctx, string(content)).ReadAll(); err != nil {
			return applied, fmt.Errorf("apply migration %s: %w", name, err)
		}

		recorded, err = migrationRecorded(ctx, connection, version)
		if err != nil {
			return applied, fmt.Errorf("verify migration %s: %w", name, err)
		}
		if !recorded {
			return applied, fmt.Errorf("migration %s completed without recording version %q", name, version)
		}
		applied = append(applied, name)
	}

	return applied, nil
}

func migrationRecorded(ctx context.Context, connection *pgxpool.Conn, version string) (bool, error) {
	var tableExists bool
	if err := connection.QueryRow(ctx, `
		SELECT to_regclass('public.schema_migrations') IS NOT NULL
	`).Scan(&tableExists); err != nil {
		return false, err
	}
	if !tableExists {
		return false, nil
	}

	var recorded bool
	if err := connection.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM public.schema_migrations
			WHERE version = $1
		)
	`, version).Scan(&recorded); err != nil {
		return false, err
	}
	return recorded, nil
}

func migrationFiles(directory string) ([]string, error) {
	directory = strings.TrimSpace(directory)
	if directory == "" {
		return nil, errors.New("migration directory is required")
	}

	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, fmt.Errorf("read migration directory: %w", err)
	}

	files := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(strings.ToLower(entry.Name()), ".sql") {
			continue
		}
		files = append(files, filepath.Join(directory, entry.Name()))
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("no SQL migrations found in %s", directory)
	}
	sort.Strings(files)
	return files, nil
}
