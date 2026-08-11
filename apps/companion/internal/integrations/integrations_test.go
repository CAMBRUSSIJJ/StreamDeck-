package integrations

import (
	"context"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"nexusdeck/companion/internal/store"
)

func TestCatalogHasProfessionalAdapters(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "config"))
	s, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	m := NewManager(s)
	ids := map[string]bool{}
	for _, v := range m.Catalog() {
		ids[v.ID] = true
	}
	for _, id := range []string{"obs", "spotify", "discord", "browser"} {
		if !ids[id] {
			t.Fatalf("missing adapter %s", id)
		}
	}
}
func TestDiscordHotkeyValidation(t *testing.T) {
	if err := validateHotkeyString("CTRL+SHIFT+M"); err != nil {
		t.Fatal(err)
	}
	if err := validateHotkeyString(""); err == nil {
		t.Fatal("empty hotkey should fail")
	}
}

func TestSpotifyAuthorizationURLUsesPKCEAndLoopback(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "config"))
	s, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetSpotifyClientID("client-id-test"); err != nil {
		t.Fatal(err)
	}
	a := NewSpotifyAdapter(s)
	raw, err := a.AuthorizationURL()
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if u.Host != "accounts.spotify.com" || q.Get("response_type") != "code" {
		t.Fatalf("unexpected auth URL: %s", raw)
	}
	if q.Get("redirect_uri") != spotifyRedirectURI {
		t.Fatalf("unexpected redirect URI: %s", q.Get("redirect_uri"))
	}
	if q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") == "" || q.Get("state") == "" {
		t.Fatalf("PKCE/state missing: %s", raw)
	}
}

func TestOBSWebSocketHandshakeAuthAndRequest(t *testing.T) {
	const password = "secret-password"
	const challenge = "challenge-123"
	const salt = "salt-456"
	serverErr := make(chan error, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h, ok := w.(http.Hijacker)
		if !ok {
			serverErr <- fmt.Errorf("hijacking unavailable")
			return
		}
		conn, rw, err := h.Hijack()
		if err != nil {
			serverErr <- err
			return
		}
		defer conn.Close()
		key := r.Header.Get("Sec-WebSocket-Key")
		acceptHash := sha1.Sum([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
		_, _ = fmt.Fprintf(rw, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\nSec-WebSocket-Protocol: obswebsocket.json\r\n\r\n", base64.StdEncoding.EncodeToString(acceptHash[:]))
		if err := rw.Flush(); err != nil {
			serverErr <- err
			return
		}
		hello := map[string]any{"op": 0, "d": map[string]any{"rpcVersion": 1, "authentication": map[string]any{"challenge": challenge, "salt": salt}}}
		if err := writeServerJSON(conn, hello); err != nil {
			serverErr <- err
			return
		}

		raw, err := readWSMessage(rw.Reader, conn)
		if err != nil {
			serverErr <- err
			return
		}
		var identify wsEnvelope
		if err := json.Unmarshal(raw, &identify); err != nil {
			serverErr <- err
			return
		}
		secretHash := sha256.Sum256([]byte(password + salt))
		secret := base64.StdEncoding.EncodeToString(secretHash[:])
		authHash := sha256.Sum256([]byte(secret + challenge))
		expectedAuth := base64.StdEncoding.EncodeToString(authHash[:])
		if identify.Op != 1 || identify.D["authentication"] != expectedAuth {
			serverErr <- fmt.Errorf("unexpected identify/auth: %+v", identify)
			return
		}
		if err := writeServerJSON(conn, map[string]any{"op": 2, "d": map[string]any{"negotiatedRpcVersion": 1}}); err != nil {
			serverErr <- err
			return
		}

		raw, err = readWSMessage(rw.Reader, conn)
		if err != nil {
			serverErr <- err
			return
		}
		var request wsEnvelope
		if err := json.Unmarshal(raw, &request); err != nil {
			serverErr <- err
			return
		}
		requestID, _ := request.D["requestId"].(string)
		if request.Op != 6 || request.D["requestType"] != "GetCurrentProgramScene" || requestID == "" {
			serverErr <- fmt.Errorf("unexpected request: %+v", request)
			return
		}
		response := map[string]any{"op": 7, "d": map[string]any{"requestType": "GetCurrentProgramScene", "requestId": requestID, "requestStatus": map[string]any{"result": true, "code": 100}, "responseData": map[string]any{"currentProgramSceneName": "Principal"}}}
		if err := writeServerJSON(conn, response); err != nil {
			serverErr <- err
			return
		}
		serverErr <- nil
	}))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	client, err := dialOBS(context.Background(), wsURL, password)
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()
	data, err := client.Request("GetCurrentProgramScene", nil)
	if err != nil {
		t.Fatal(err)
	}
	if data["currentProgramSceneName"] != "Principal" {
		t.Fatalf("unexpected OBS response: %+v", data)
	}
	if err := <-serverErr; err != nil {
		t.Fatal(err)
	}
}

func writeServerJSON(conn net.Conn, value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return writeServerFrame(conn, 0x1, raw)
}

func writeServerFrame(w io.Writer, opcode byte, payload []byte) error {
	header := []byte{0x80 | opcode}
	n := len(payload)
	switch {
	case n < 126:
		header = append(header, byte(n))
	case n <= 65535:
		header = append(header, 126, byte(n>>8), byte(n))
	default:
		header = append(header, 127)
		var b [8]byte
		binary.BigEndian.PutUint64(b[:], uint64(n))
		header = append(header, b[:]...)
	}
	if _, err := w.Write(header); err != nil {
		return err
	}
	_, err := w.Write(payload)
	return err
}

func TestSpotifyPlaybackStateIncludesAppFocusMetadata(t *testing.T) {
	payload := map[string]any{
		"is_playing":    true,
		"progress_ms":   float64(61000),
		"shuffle_state": true,
		"repeat_state":  "context",
		"item": map[string]any{
			"name":          "Midnight City",
			"duration_ms":   float64(244000),
			"explicit":      false,
			"uri":           "spotify:track:test",
			"external_urls": map[string]any{"spotify": "https://open.spotify.com/track/test"},
			"artists":       []any{map[string]any{"name": "M83"}},
			"album":         map[string]any{"name": "Hurry Up", "images": []any{map[string]any{"url": "https://i.scdn.co/image/test"}}},
		},
		"device": map[string]any{"name": "Desktop", "volume_percent": float64(62)},
	}
	state := spotifyPlaybackState(payload)
	if state["track"] != "Midnight City" || state["artist"] != "M83" || state["album"] != "Hurry Up" {
		t.Fatalf("metadata incompleta: %+v", state)
	}
	if state["artworkUrl"] != "https://i.scdn.co/image/test" || state["durationMs"] != 244000 {
		t.Fatalf("artwork/duration ausentes: %+v", state)
	}
	if state["repeat"] != "context" || state["shuffle"] != true {
		t.Fatalf("playback state incompleto: %+v", state)
	}
}

func TestSpotifyCatalogHasTransferPlayback(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(t.TempDir(), "config"))
	s, err := store.New()
	if err != nil {
		t.Fatal(err)
	}
	a := NewSpotifyAdapter(s)
	found := false
	for _, command := range a.Commands() {
		if command.ID == "transfer_playback" {
			found = true
		}
	}
	if !found {
		t.Fatal("transfer_playback ausente")
	}
}
