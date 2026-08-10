package localpair

import (
	"path/filepath"
	"regexp"
	"testing"

	ncrypto "nexusdeck/companion/internal/crypto"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/store"
)

func newTestStore(t *testing.T) *store.Store {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "config"))
	s, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestLocalPairRoundTrip(t *testing.T) {
	s := newTestStore(t)
	manager := New(s)
	status, err := manager.Start()
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^\d{6}$`).MatchString(status.Code) || !status.Active {
		t.Fatalf("unexpected pair status: %+v", status)
	}
	clientPriv, clientPublic, clientNonce, err := ncrypto.NewPairingIdentity()
	if err != nil {
		t.Fatal(err)
	}
	request := protocol.LocalPairRequest{Code: status.Code, RequestID: "req-1", ClientPublicKey: clientPublic, ClientNonce: clientNonce, ClientName: "iPad Test", ClientPlatform: "iPadOS"}
	response, err := manager.Pair(request)
	if err != nil {
		t.Fatal(err)
	}
	pairKey, err := ncrypto.DerivePairKey(clientPriv, response.ServerPublicKey, status.Code, clientNonce, response.ServerNonce)
	if err != nil {
		t.Fatal(err)
	}
	var peer protocol.LocalPeer
	if err := ncrypto.DecryptJSON(response.Envelope, pairKey, "local-pair:"+status.Code+":req-1", &peer); err != nil {
		t.Fatal(err)
	}
	if peer.Transport != "local" || peer.ID == "" || peer.Secret == "" {
		t.Fatalf("invalid peer: %+v", peer)
	}
	if len(s.Snapshot().LocalDevices) != 1 {
		t.Fatalf("expected one local device")
	}
	if manager.Status().Active {
		t.Fatalf("pairing should close after success")
	}
}
