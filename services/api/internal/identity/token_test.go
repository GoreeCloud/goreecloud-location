package identity

import (
	"strings"
	"testing"
)

func TestOpaqueTokenHashing(t *testing.T) {
	plain, hash, err := NewOpaqueToken("loc_usr_")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(plain, "loc_usr_") {
		t.Fatalf("unexpected token prefix: %q", plain)
	}
	if len(hash) != 64 {
		t.Fatalf("expected sha256 hex hash, got length %d", len(hash))
	}
	if got := HashOpaqueToken(plain); got != hash {
		t.Fatalf("hash mismatch: %q != %q", got, hash)
	}
	if strings.Contains(hash, plain) {
		t.Fatal("token hash unexpectedly contains plaintext token")
	}
}

func TestNewUUID(t *testing.T) {
	value, err := NewUUID()
	if err != nil {
		t.Fatal(err)
	}
	if len(value) != 36 || value[14] != '4' {
		t.Fatalf("unexpected RFC4122 v4 UUID: %q", value)
	}
}
