package localserver

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"nexusdeck/companion/internal/localpair"
	"nexusdeck/companion/internal/store"
)

func testServer(t *testing.T) (*Server, *localpair.Manager) {
	t.Helper()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "config"))
	s, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	pair := localpair.New(s)
	return New(s, pair, nil), pair
}

func localRequest(method, path string, body []byte) *http.Request {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.RemoteAddr = "192.168.1.25:54321"
	return req
}

func TestRootRedirectsToOfficialWebApp(t *testing.T) {
	srv, _ := testServer(t)
	if err := srv.store.SetWebAppURL("https://nexus.example"); err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recorder, localRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected 307, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if got := recorder.Header().Get("Location"); got != "https://nexus.example" {
		t.Fatalf("unexpected redirect %q", got)
	}
}

func TestRootWithoutWebAppExplainsVercelConfiguration(t *testing.T) {
	srv, _ := testServer(t)
	recorder := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recorder, localRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", recorder.Code)
	}
	if !bytes.Contains(recorder.Body.Bytes(), []byte("Vercel")) {
		t.Fatalf("expected Vercel setup guidance: %s", recorder.Body.String())
	}
}

func TestInfoIsAvailableOnPrivateLAN(t *testing.T) {
	srv, _ := testServer(t)
	recorder := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recorder, localRequest(http.MethodGet, "/api/local/info", nil))
	if recorder.Code != 200 {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["localMode"] != true {
		t.Fatalf("local mode missing: %v", body)
	}
}

func TestSimpleLocalPingRequiresDeviceToken(t *testing.T) {
	srv, pair := testServer(t)
	status, err := pair.Start()
	if err != nil {
		t.Fatal(err)
	}
	peer, err := pair.PairSimple(status.Code, "iPad", "iPadOS")
	if err != nil {
		t.Fatal(err)
	}
	payload := map[string]any{
		"deviceId": peer.ID,
		"message":  map[string]any{"type": "ping", "id": "ping-test", "ts": time.Now().UnixMilli(), "body": map[string]any{}},
	}
	raw, _ := json.Marshal(payload)
	req := localRequest(http.MethodPost, "/api/local/message-simple", raw)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+peer.Secret)
	recorder := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recorder, req)
	if recorder.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var body struct {
		Message struct {
			Type string         `json:"type"`
			Body map[string]any `json:"body"`
		} `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Message.Type != "status" {
		t.Fatalf("expected status response, got %q", body.Message.Type)
	}
	if _, ok := body.Message.Body["audio"]; !ok {
		t.Fatalf("expected audio state in status: %+v", body.Message.Body)
	}
	if _, ok := body.Message.Body["syncSequence"]; !ok {
		t.Fatalf("expected sync sequence in status: %+v", body.Message.Body)
	}
}

func TestPublicRemoteAddressIsRejected(t *testing.T) {
	srv, _ := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/local/info", nil)
	req.RemoteAddr = "8.8.8.8:5555"
	recorder := httptest.NewRecorder()
	srv.Handler().ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}
