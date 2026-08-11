package localserver

import (
	"context"
	"crypto/subtle"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"nexusdeck/companion/internal/actions"
	ncrypto "nexusdeck/companion/internal/crypto"
	"nexusdeck/companion/internal/foreground"
	"nexusdeck/companion/internal/integrations"
	"nexusdeck/companion/internal/localpair"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/store"
	"nexusdeck/companion/internal/systemstate"
)

//go:embed web/* web/assets/icons/* web/js/* web/js/core/* web/js/ui/*
var webFS embed.FS

type Server struct {
	store        *store.Store
	pair         *localpair.Manager
	integrations *integrations.Manager
	http         *http.Server
	startedAt    time.Time
	replayMu     sync.Mutex
	recent       map[string]map[string]time.Time
	statusSeq    atomic.Uint64
}

type secureRequest struct {
	DeviceID string            `json:"deviceId"`
	Envelope protocol.Envelope `json:"envelope"`
}

type wireMessage struct {
	Type string          `json:"type"`
	ID   string          `json:"id"`
	TS   int64           `json:"ts"`
	Body json.RawMessage `json:"body"`
}

func New(s *store.Store, pair *localpair.Manager, integrationManager *integrations.Manager) *Server {
	return &Server{store: s, pair: pair, integrations: integrationManager, startedAt: time.Now(), recent: map[string]map[string]time.Time{}}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/local/info", s.handleInfo)
	mux.HandleFunc("POST /api/local/pair", s.handlePair)
	mux.HandleFunc("POST /api/local/pair-simple", s.handlePairSimple)
	mux.HandleFunc("POST /api/local/message", s.handleMessage)
	mux.HandleFunc("POST /api/local/message-simple", s.handleMessageSimple)
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"configured": false, "version": protocol.AppVersion, "mode": "local"})
	})
	sub, _ := fs.Sub(webFS, "web")
	mux.Handle("/", http.FileServer(http.FS(sub)))
	return localOnly(securityHeaders(mux))
}

func (s *Server) Listen(addr string) error {
	s.http = &http.Server{Addr: addr, Handler: s.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 90 * time.Second, IdleTimeout: 120 * time.Second}
	return s.http.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.http == nil {
		return nil
	}
	return s.http.Shutdown(ctx)
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	host, _ := os.Hostname()
	if host == "" {
		host = "Windows PC"
	}
	writeJSON(w, 200, map[string]any{
		"localMode":       true,
		"version":         protocol.AppVersion,
		"protocolVersion": protocol.Version,
		"hostname":        host,
		"platform":        platformName(),
		"pair":            s.pair.PublicStatus(),
		"uptimeSeconds":   int64(time.Since(s.startedAt).Seconds()),
		"securityModes":   []string{"aes-gcm", "lan-token"},
	})
}

func (s *Server) handlePair(w http.ResponseWriter, r *http.Request) {
	var request protocol.LocalPairRequest
	if err := decodeJSON(w, r, 64<<10, &request); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	response, err := s.pair.Pair(request)
	if err != nil {
		writeJSON(w, 401, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, response)
}

func (s *Server) handlePairSimple(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Code           string `json:"code"`
		ClientName     string `json:"clientName"`
		ClientPlatform string `json:"clientPlatform"`
	}
	if err := decodeJSON(w, r, 32<<10, &request); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	peer, err := s.pair.PairSimple(request.Code, request.ClientName, request.ClientPlatform)
	if err != nil {
		writeJSON(w, 401, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"device": peer, "security": "lan-token"})
}

func (s *Server) handleMessage(w http.ResponseWriter, r *http.Request) {
	var request secureRequest
	if err := decodeJSON(w, r, 256<<10, &request); err != nil || request.DeviceID == "" {
		writeJSON(w, 400, map[string]any{"error": "mensagem inválida"})
		return
	}
	device, ok := s.store.LocalDevice(request.DeviceID)
	if !ok {
		writeJSON(w, 401, map[string]any{"error": "dispositivo local não autorizado"})
		return
	}
	key, err := ncrypto.DecodeSecret(device.Secret)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "segredo local inválido"})
		return
	}
	aad := fmt.Sprintf("nexus-local:%s:v1", device.ID)
	var message wireMessage
	if err := ncrypto.DecryptJSON(request.Envelope, key, aad, &message); err != nil {
		writeJSON(w, 401, map[string]any{"error": "mensagem não autenticada"})
		return
	}
	if !s.acceptMessage(device.ID, message) {
		writeJSON(w, 409, map[string]any{"error": "mensagem expirada ou repetida"})
		return
	}
	response, err := s.processMessage(message)
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error()})
		return
	}
	envelope, err := ncrypto.EncryptJSON(response, key, aad)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "falha ao proteger resposta"})
		return
	}
	writeJSON(w, 200, map[string]any{"envelope": envelope, "security": "aes-gcm"})
}

func (s *Server) handleMessageSimple(w http.ResponseWriter, r *http.Request) {
	var request struct {
		DeviceID string      `json:"deviceId"`
		Message  wireMessage `json:"message"`
	}
	if err := decodeJSON(w, r, 256<<10, &request); err != nil || request.DeviceID == "" {
		writeJSON(w, 400, map[string]any{"error": "mensagem inválida"})
		return
	}
	device, ok := s.store.LocalDevice(request.DeviceID)
	if !ok {
		writeJSON(w, 401, map[string]any{"error": "dispositivo local não autorizado"})
		return
	}
	provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if provided == "" || subtle.ConstantTimeCompare([]byte(provided), []byte(device.Secret)) != 1 {
		writeJSON(w, 401, map[string]any{"error": "token local inválido"})
		return
	}
	if !s.acceptMessage(device.ID, request.Message) {
		writeJSON(w, 409, map[string]any{"error": "mensagem expirada ou repetida"})
		return
	}
	response, err := s.processMessage(request.Message)
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"message": response, "security": "lan-token"})
}

func (s *Server) snapshotStatus() map[string]any {
	host, _ := os.Hostname()
	if host == "" {
		host = "Windows PC"
	}
	now := time.Now()
	status := map[string]any{
		"online":        true,
		"hostname":      host,
		"platform":      platformName(),
		"version":       protocol.AppVersion,
		"transport":     "local",
		"uptimeSeconds": int64(now.Sub(s.startedAt).Seconds()),
		"serverTime":    now.UTC().Format(time.RFC3339Nano),
		"syncSequence":  s.statusSeq.Add(1),
	}
	if active, ok := foreground.Current(); ok {
		status["activeApp"] = active
	}
	if s.integrations != nil {
		status["integrations"] = s.integrations.Statuses()
	}
	for key, value := range systemstate.Snapshot() {
		status[key] = value
	}
	return status
}

func (s *Server) processMessage(message wireMessage) (wireMessage, error) {
	switch message.Type {
	case "ping":
		body, _ := json.Marshal(s.snapshotStatus())
		return wireMessage{Type: "status", ID: mustRandom(10), TS: time.Now().UnixMilli(), Body: body}, nil
	case "command":
		body, execErr := actions.DecodeBody(message.Body)
		var report actions.ExecutionReport
		if execErr == nil {
			report, execErr = actions.ExecuteWithReport(body.Action, s.integrations)
		}
		ack := map[string]any{"commandId": message.ID, "ok": execErr == nil, "state": s.snapshotStatus()}
		if body.Action.Type == "macro" || body.Action.Type == "integration" {
			ack["report"] = report
		}
		if execErr != nil {
			ack["error"] = execErr.Error()
		}
		ackRaw, _ := json.Marshal(ack)
		return wireMessage{Type: "ack", ID: mustRandom(10), TS: time.Now().UnixMilli(), Body: ackRaw}, nil
	default:
		return wireMessage{}, fmt.Errorf("tipo de mensagem não suportado")
	}
}

func (s *Server) acceptMessage(deviceID string, message wireMessage) bool {
	if message.ID == "" || message.TS == 0 || time.Since(time.UnixMilli(message.TS)) > 60*time.Second || time.Until(time.UnixMilli(message.TS)) > 15*time.Second {
		return false
	}
	now := time.Now()
	s.replayMu.Lock()
	defer s.replayMu.Unlock()
	bucket := s.recent[deviceID]
	if bucket == nil {
		bucket = map[string]time.Time{}
		s.recent[deviceID] = bucket
	}
	for id, seen := range bucket {
		if now.Sub(seen) > 2*time.Minute {
			delete(bucket, id)
		}
	}
	if _, exists := bucket[message.ID]; exists {
		return false
	}
	bucket[message.ID] = now
	return true
}

func localOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		ip := net.ParseIP(host)
		if ip == nil || !(ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast()) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'")
		next.ServeHTTP(w, r)
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, max int64, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, max))
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func platformName() string {
	if runtime.GOOS == "windows" {
		return "Windows"
	}
	return runtime.GOOS
}

func mustRandom(n int) string {
	value, _ := ncrypto.RandomB64(n)
	return value
}
