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

// ApplyDirectory applies every .sql migration in lexical filename order using
// one PostgreSQL connection. Migration files remain responsible for their own
// transaction boundaries and schema_migrations records.
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
		content, err := os.ReadFile(path)
		if err != nil {
			return applied, fmt.Errorf("read migration %s: %w", filepath.Base(path), err)
		}

		// PgConn.Exec uses PostgreSQL's simple-query protocol, which is appropriate
		// for migration files that deliberately contain transaction blocks and
		// multiple SQL statements.
		if _, err := connection.Conn().PgConn().Exec(ctx, string(content)).ReadAll(); err != nil {
			return applied, fmt.Errorf("apply migration %s: %w", filepath.Base(path), err)
		}
		applied = append(applied, filepath.Base(path))
	}

	return applied, nil
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
