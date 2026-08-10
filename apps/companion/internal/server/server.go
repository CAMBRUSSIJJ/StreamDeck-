package server

import (
	"context"
	"embed"
	"encoding/json"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"nexusdeck/companion/internal/pairing"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/store"
)

//go:embed web/*
var webFS embed.FS

type Server struct {
	store   *store.Store
	pair    *pairing.PairManager
	devices *pairing.DeviceManager
	http    *http.Server
}

func New(s *store.Store, pair *pairing.PairManager, devices *pairing.DeviceManager) *Server {
	return &Server{store: s, pair: pair, devices: devices}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("POST /api/settings", s.handleSettings)
	mux.HandleFunc("POST /api/pair/start", s.handlePairStart)
	mux.HandleFunc("POST /api/device/remove", s.handleDeviceRemove)
	sub, _ := fs.Sub(webFS, "web")
	mux.Handle("/", http.FileServer(http.FS(sub)))
	return securityHeaders(mux)
}

func (s *Server) Listen(addr string) error {
	s.http = &http.Server{Addr: addr, Handler: s.Handler(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	return s.http.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.http == nil {
		return nil
	}
	return s.http.Shutdown(ctx)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'")
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	cfg := s.store.Snapshot()
	devices := make([]map[string]any, 0, len(cfg.Devices))
	for _, d := range cfg.Devices {
		devices = append(devices, map[string]any{"id": d.ID, "name": d.Name, "platform": d.Platform})
	}
	writeJSON(w, 200, map[string]any{
		"version":     protocol.AppVersion,
		"configured":  cfg.SupabaseURL != "" && cfg.SupabaseAnonKey != "",
		"supabaseUrl": cfg.SupabaseURL,
		"devices":     devices,
		"pair":        s.pair.Status(),
		"configPath":  s.store.Path(),
	})
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SupabaseURL     string `json:"supabaseUrl"`
		SupabaseAnonKey string `json:"supabaseAnonKey"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	body.SupabaseURL = strings.TrimRight(strings.TrimSpace(body.SupabaseURL), "/")
	body.SupabaseAnonKey = strings.TrimSpace(body.SupabaseAnonKey)
	if !strings.HasPrefix(body.SupabaseURL, "https://") || len(body.SupabaseAnonKey) < 20 {
		writeJSON(w, 400, map[string]any{"error": "URL ou chave pública inválida"})
		return
	}
	if err := s.store.SetCloud(body.SupabaseURL, body.SupabaseAnonKey); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	s.devices.Sync()
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handlePairStart(w http.ResponseWriter, r *http.Request) {
	status, err := s.pair.Start(context.Background())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, status)
}

func (s *Server) handleDeviceRemove(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil || body.ID == "" {
		writeJSON(w, 400, map[string]any{"error": "ID inválido"})
		return
	}
	if err := s.store.RemoveDevice(body.ID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	s.devices.Sync()
	writeJSON(w, 200, map[string]any{"ok": true})
}
