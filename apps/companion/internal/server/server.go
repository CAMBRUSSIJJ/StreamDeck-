package server

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"nexusdeck/companion/internal/integrations"
	"nexusdeck/companion/internal/localpair"
	"nexusdeck/companion/internal/pairing"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/startup"
	"nexusdeck/companion/internal/store"
	"nexusdeck/companion/internal/updatechecker"
)

//go:embed web/*
var webFS embed.FS

type Server struct {
	store        *store.Store
	integrations *integrations.Manager
	pair         *pairing.PairManager
	localPair    *localpair.Manager
	devices      *pairing.DeviceManager
	localURL     string
	startedAt    time.Time
	http         *http.Server
}

func New(s *store.Store, pair *pairing.PairManager, localPair *localpair.Manager, devices *pairing.DeviceManager, integrationManager *integrations.Manager, localURL string) *Server {
	return &Server{store: s, pair: pair, localPair: localPair, devices: devices, integrations: integrationManager, localURL: localURL, startedAt: time.Now()}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("GET /api/diagnostics", s.handleDiagnostics)
	mux.HandleFunc("POST /api/startup", s.handleStartup)
	mux.HandleFunc("GET /api/update/check", s.handleUpdateCheck)
	mux.HandleFunc("POST /api/settings", s.handleSettings)
	mux.HandleFunc("POST /api/pair/start", s.handlePairStart)
	mux.HandleFunc("POST /api/local/pair/start", s.handleLocalPairStart)
	mux.HandleFunc("POST /api/device/remove", s.handleDeviceRemove)
	mux.HandleFunc("POST /api/local/device/remove", s.handleLocalDeviceRemove)
	mux.HandleFunc("POST /api/integrations/obs/settings", s.handleOBSSettings)
	mux.HandleFunc("POST /api/integrations/obs/test", s.handleOBSTest)
	mux.HandleFunc("POST /api/integrations/spotify/settings", s.handleSpotifySettings)
	mux.HandleFunc("POST /api/integrations/spotify/connect", s.handleSpotifyConnect)
	mux.HandleFunc("GET /api/integrations/spotify/callback", s.handleSpotifyCallback)
	mux.HandleFunc("POST /api/integrations/spotify/disconnect", s.handleSpotifyDisconnect)
	mux.HandleFunc("POST /api/integrations/discord/settings", s.handleDiscordSettings)
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
	localDevices := make([]map[string]any, 0, len(cfg.LocalDevices))
	for _, d := range cfg.LocalDevices {
		localDevices = append(localDevices, map[string]any{"id": d.ID, "name": d.Name, "platform": d.Platform, "createdAt": d.CreatedAt})
	}
	integrationStatus := map[string]any{}
	if s.integrations != nil {
		integrationStatus["status"] = s.integrations.Statuses()
		integrationStatus["catalog"] = s.integrations.Catalog()
	}
	integrationStatus["settings"] = map[string]any{
		"obs":     map[string]any{"url": cfg.Integrations.OBS.URL, "passwordConfigured": cfg.Integrations.OBS.Password != ""},
		"spotify": map[string]any{"clientId": cfg.Integrations.Spotify.ClientID, "authorized": cfg.Integrations.Spotify.RefreshToken != "" || cfg.Integrations.Spotify.AccessToken != ""},
		"discord": map[string]any{"muteHotkey": cfg.Integrations.Discord.MuteHotkey, "deafenHotkey": cfg.Integrations.Discord.DeafenHotkey},
	}
	writeJSON(w, 200, map[string]any{
		"version":        protocol.AppVersion,
		"configured":     cfg.SupabaseURL != "" && cfg.SupabaseAnonKey != "",
		"supabaseUrl":    cfg.SupabaseURL,
		"devices":        devices,
		"localDevices":   localDevices,
		"pair":           s.pair.Status(),
		"localPair":      s.localPair.Status(),
		"localUrl":       s.localURL,
		"integrations":   integrationStatus,
		"configPath":     s.store.Path(),
		"startupEnabled": startup.Enabled(),
		"uptimeSeconds":  int64(time.Since(s.startedAt).Seconds()),
		"platform":       runtime.GOOS,
	})
}

func (s *Server) handleStartup(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	if err := startup.SetEnabled(body.Enabled); err != nil {
		writeJSON(w, 500, map[string]any{"error": "não foi possível alterar a inicialização automática: " + err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "enabled": startup.Enabled()})
}

func (s *Server) handleUpdateCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
	defer cancel()
	info, err := updatechecker.Check(ctx, protocol.AppVersion)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": "não foi possível verificar atualizações: " + err.Error()})
		return
	}
	writeJSON(w, 200, info)
}

type diagnosticCheck struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Status string `json:"status"`
	Detail string `json:"detail"`
}

func (s *Server) handleDiagnostics(w http.ResponseWriter, r *http.Request) {
	checks := []diagnosticCheck{}
	add := func(id, label, status, detail string) {
		checks = append(checks, diagnosticCheck{ID: id, Label: label, Status: status, Detail: detail})
	}

	add("admin", "Painel administrativo", "ok", "Respondendo em http://127.0.0.1:38473")

	if err := testConfigWritable(s.store.Path()); err != nil {
		add("config", "Configuração local", "error", err.Error())
	} else {
		add("config", "Configuração local", "ok", s.store.Path())
	}

	if host, err := localHost(s.localURL); err != nil {
		add("lan-address", "Endereço da rede local", "error", err.Error())
	} else if ip := net.ParseIP(host); ip != nil && (ip.IsPrivate() || ip.IsLoopback()) {
		add("lan-address", "Endereço da rede local", "ok", s.localURL)
	} else {
		add("lan-address", "Endereço da rede local", "warn", s.localURL+" não parece ser um IP privado")
	}

	if err := dialLocalDeck(s.localURL); err != nil {
		add("local-port", "Servidor do iPad", "error", "Porta 38474 indisponível: "+err.Error())
	} else {
		add("local-port", "Servidor do iPad", "ok", "Porta 38474 está aceitando conexões")
	}

	cfg := s.store.Snapshot()
	if len(cfg.LocalDevices) == 0 {
		add("pairing", "Pareamento", "warn", "Nenhum iPad autorizado ainda")
	} else {
		add("pairing", "Pareamento", "ok", fmt.Sprintf("%d dispositivo(s) local(is) autorizado(s)", len(cfg.LocalDevices)))
	}

	if startup.Enabled() {
		add("startup", "Iniciar com o Windows", "ok", "Ativado")
	} else {
		add("startup", "Iniciar com o Windows", "warn", "Desativado")
	}

	if runtime.GOOS == "windows" {
		add("platform", "Sistema operacional", "ok", "Windows")
	} else {
		add("platform", "Sistema operacional", "warn", runtime.GOOS+" — build de desenvolvimento")
	}

	summary := map[string]int{"ok": 0, "warn": 0, "error": 0}
	for _, check := range checks {
		summary[check.Status]++
	}
	writeJSON(w, 200, map[string]any{
		"version":       protocol.AppVersion,
		"generatedAt":   time.Now().UTC().Format(time.RFC3339),
		"uptimeSeconds": int64(time.Since(s.startedAt).Seconds()),
		"localUrl":      s.localURL,
		"checks":        checks,
		"summary":       summary,
	})
}

func testConfigWritable(configPath string) error {
	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("não foi possível acessar %s: %w", dir, err)
	}
	file, err := os.CreateTemp(dir, ".nexus-diag-*")
	if err != nil {
		return fmt.Errorf("pasta de configuração sem permissão de escrita: %w", err)
	}
	name := file.Name()
	_ = file.Close()
	_ = os.Remove(name)
	return nil
}

func localHost(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	host := parsed.Hostname()
	if host == "" {
		return "", fmt.Errorf("endereço local inválido")
	}
	return host, nil
}

func dialLocalDeck(raw string) error {
	host, err := localHost(raw)
	if err != nil {
		return err
	}
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, "38474"), 700*time.Millisecond)
	if err != nil {
		return err
	}
	_ = conn.Close()
	return nil
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

func (s *Server) handleLocalPairStart(w http.ResponseWriter, r *http.Request) {
	status, err := s.localPair.Start()
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

func (s *Server) handleOBSSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL          string `json:"url"`
		Password     string `json:"password"`
		KeepPassword bool   `json:"keepPassword"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 32<<10)).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	body.URL = strings.TrimSpace(body.URL)
	if body.URL == "" {
		body.URL = "ws://127.0.0.1:4455"
	}
	if !strings.HasPrefix(body.URL, "ws://") && !strings.HasPrefix(body.URL, "wss://") {
		writeJSON(w, 400, map[string]any{"error": "A URL do OBS deve começar com ws:// ou wss://"})
		return
	}
	password := body.Password
	if body.KeepPassword && password == "" {
		password = s.store.Snapshot().Integrations.OBS.Password
	}
	if err := s.store.SetOBSIntegration(body.URL, password); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleOBSTest(w http.ResponseWriter, r *http.Request) {
	if s.integrations == nil {
		writeJSON(w, 503, map[string]any{"error": "integrações indisponíveis"})
		return
	}
	status, err := s.integrations.Status("obs")
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if !status.Connected {
		msg := status.Error
		if msg == "" {
			msg = status.Detail
		}
		writeJSON(w, 400, map[string]any{"error": msg, "status": status})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "status": status})
}

func (s *Server) handleSpotifySettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ClientID string `json:"clientId"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	body.ClientID = strings.TrimSpace(body.ClientID)
	if body.ClientID == "" || len(body.ClientID) > 128 {
		writeJSON(w, 400, map[string]any{"error": "Client ID do Spotify inválido"})
		return
	}
	if err := s.store.SetSpotifyClientID(body.ClientID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "redirectUri": "http://127.0.0.1:38473/api/integrations/spotify/callback"})
}

func (s *Server) handleSpotifyConnect(w http.ResponseWriter, r *http.Request) {
	if s.integrations == nil {
		writeJSON(w, 503, map[string]any{"error": "integrações indisponíveis"})
		return
	}
	authURL, err := s.integrations.Spotify.AuthorizationURL()
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"authUrl": authURL})
}

func (s *Server) handleSpotifyCallback(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("error") != "" {
		http.Error(w, "Spotify: autorização recusada", http.StatusBadRequest)
		return
	}
	code, state := r.URL.Query().Get("code"), r.URL.Query().Get("state")
	if code == "" || state == "" {
		http.Error(w, "Spotify: callback inválido", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if s.integrations == nil {
		http.Error(w, "Integrações indisponíveis", http.StatusServiceUnavailable)
		return
	}
	if err := s.integrations.Spotify.CompleteAuthorization(ctx, code, state); err != nil {
		http.Error(w, "Spotify: "+err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte("<!doctype html><html lang=pt-BR><meta charset=utf-8><title>Spotify conectado</title><main><h1>Spotify conectado</h1><p>A autorização foi concluída. Você pode fechar esta aba e voltar ao Nexus Companion.</p></main></html>"))
}

func (s *Server) handleSpotifyDisconnect(w http.ResponseWriter, r *http.Request) {
	if s.integrations == nil {
		writeJSON(w, 503, map[string]any{"error": "integrações indisponíveis"})
		return
	}
	if err := s.integrations.Spotify.Disconnect(); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleDiscordSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MuteHotkey   string `json:"muteHotkey"`
		DeafenHotkey string `json:"deafenHotkey"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]any{"error": "JSON inválido"})
		return
	}
	body.MuteHotkey = strings.ToUpper(strings.TrimSpace(body.MuteHotkey))
	body.DeafenHotkey = strings.ToUpper(strings.TrimSpace(body.DeafenHotkey))
	if body.MuteHotkey == "" || body.DeafenHotkey == "" {
		writeJSON(w, 400, map[string]any{"error": "Configure os dois atalhos do Discord"})
		return
	}
	if err := s.store.SetDiscordIntegration(body.MuteHotkey, body.DeafenHotkey); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleLocalDeviceRemove(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&body); err != nil || body.ID == "" {
		writeJSON(w, 400, map[string]any{"error": "ID inválido"})
		return
	}
	if err := s.store.RemoveLocalDevice(body.ID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}
