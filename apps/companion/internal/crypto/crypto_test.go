package crypto

import (
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key, _ := RandomBytes(32)
	input := map[string]any{"type": "command", "value": 42.0}
	env, err := EncryptJSON(input, key, "nexus:test:v1")
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := DecryptJSON(env, key, "nexus:test:v1", &out); err != nil {
		t.Fatal(err)
	}
	if out["type"] != "command" || out["value"] != 42.0 {
		t.Fatalf("unexpected output: %#v", out)
	}
}

func TestPairKeyMatches(t *testing.T) {
	aPriv, aPub, aNonce, err := NewPairingIdentity()
	if err != nil {
		t.Fatal(err)
	}
	bPriv, bPub, bNonce, err := NewPairingIdentity()
	if err != nil {
		t.Fatal(err)
	}
	aKey, err := DerivePairKey(aPriv, bPub, "123456", aNonce, bNonce)
	if err != nil {
		t.Fatal(err)
	}
	bKey, err := DerivePairKey(bPriv, aPub, "123456", aNonce, bNonce)
	if err != nil {
		t.Fatal(err)
	}
	if string(aKey) != string(bKey) {
		t.Fatal("derived keys differ")
	}
}

func TestAADMismatchFails(t *testing.T) {
	key, _ := RandomBytes(32)
	env, _ := EncryptJSON(map[string]bool{"ok": true}, key, "a")
	var out map[string]bool
	if err := DecryptJSON(env, key, "b", &out); err == nil {
		t.Fatal("expected authentication failure")
	}
}
