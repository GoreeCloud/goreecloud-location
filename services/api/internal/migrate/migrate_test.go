package migrate

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestMigrationFilesAreSQLOnlyAndLexicallyOrdered(t *testing.T) {
	directory := t.TempDir()
	for _, name := range []string{"0002_second.sql", "README.md", "0001_first.sql", "notes.SQL"} {
		if err := os.WriteFile(filepath.Join(directory, name), []byte("-- test\n"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(directory, "0000_directory.sql"), 0o700); err != nil {
		t.Fatal(err)
	}

	files, err := migrationFiles(directory)
	if err != nil {
		t.Fatal(err)
	}

	got := make([]string, 0, len(files))
	for _, path := range files {
		got = append(got, filepath.Base(path))
	}
	want := []string{"0001_first.sql", "0002_second.sql", "notes.SQL"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected migration order: got %v want %v", got, want)
	}
}

func TestMigrationFilesRejectsEmptyDirectory(t *testing.T) {
	if _, err := migrationFiles(t.TempDir()); err == nil {
		t.Fatal("expected empty migration directory to be rejected")
	}
}

func TestMigrationFilesRejectsBlankDirectory(t *testing.T) {
	if _, err := migrationFiles("   "); err == nil {
		t.Fatal("expected blank migration directory to be rejected")
	}
}
