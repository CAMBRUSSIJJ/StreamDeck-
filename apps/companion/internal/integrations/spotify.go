package integrations

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"nexusdeck/companion/internal/store"
)

const spotifyRedirectURI = "http://127.0.0.1:38473/api/integrations/spotify/callback"
const spotifyScopes = "user-read-playback-state user-read-currently-playing user-modify-playback-state"

type spotifyAuthPending struct {
	State, Verifier string
	Expires         time.Time
}

type SpotifyAdapter struct {
	store   *store.Store
	http    *http.Client
	mu      sync.Mutex
	pending spotifyAuthPending
}

func NewSpotifyAdapter(s *store.Store) *SpotifyAdapter {
	return &SpotifyAdapter{store: s, http: &http.Client{Timeout: 8 * time.Second}}
}
func (a *SpotifyAdapter) ID() string   { return "spotify" }
func (a *SpotifyAdapter) Name() string { return "Spotify" }
func (a *SpotifyAdapter) Kind() string { return "oauth-web-api" }
func (a *SpotifyAdapter) Commands() []Command {
	return []Command{
		{ID: "play", Label: "Reproduzir"}, {ID: "pause", Label: "Pausar"}, {ID: "next", Label: "Próxima faixa"}, {ID: "previous", Label: "Faixa anterior"},
		{ID: "set_volume", Label: "Definir volume", Requires: "volumePercent"}, {ID: "seek", Label: "Ir para posição", Requires: "positionMs"},
		{ID: "shuffle_on", Label: "Ativar aleatório"}, {ID: "shuffle_off", Label: "Desativar aleatório"},
		{ID: "repeat_track", Label: "Repetir faixa"}, {ID: "repeat_context", Label: "Repetir contexto"}, {ID: "repeat_off", Label: "Desativar repetição"},
		{ID: "transfer_playback", Label: "Trocar dispositivo", Requires: "deviceId"},
	}
}

func (a *SpotifyAdapter) Status(ctx context.Context) Status {
	cfg := a.store.Snapshot().Integrations.Spotify
	status := Status{Configured: strings.TrimSpace(cfg.ClientID) != "", Connected: cfg.RefreshToken != "" || (cfg.AccessToken != "" && cfg.ExpiresAt > time.Now().Unix())}
	if !status.Configured {
		status.Detail = "Informe um Client ID do Spotify"
		return status
	}
	if !status.Connected {
		status.Detail = "Autorização necessária"
		return status
	}
	token, err := a.accessToken(ctx)
	if err != nil {
		status.Connected = false
		status.Error = err.Error()
		status.Detail = "Sessão Spotify expirada"
		return status
	}
	payload, code, err := a.getJSON(ctx, token, "https://api.spotify.com/v1/me/player")
	if err != nil {
		status.Error = err.Error()
		return status
	}
	if code == http.StatusNoContent {
		status.Detail = "Conectado · sem reprodução ativa"
		status.State = map[string]any{"playing": false}
		return status
	}
	status.State = spotifyPlaybackState(payload)
	status.Detail = "Conectado à Web API"
	return status
}

func (a *SpotifyAdapter) Execute(ctx context.Context, command string, params map[string]any) (map[string]any, error) {
	token, err := a.accessToken(ctx)
	if err != nil {
		return nil, err
	}
	if command == "focus_snapshot" {
		return a.focusSnapshot(ctx, token)
	}

	method, path := "", ""
	query := url.Values{}
	var requestBody io.Reader
	contentType := ""
	switch command {
	case "play":
		method, path = http.MethodPut, "/v1/me/player/play"
	case "pause":
		method, path = http.MethodPut, "/v1/me/player/pause"
	case "next":
		method, path = http.MethodPost, "/v1/me/player/next"
	case "previous":
		method, path = http.MethodPost, "/v1/me/player/previous"
	case "set_volume":
		value, ok := intParam(params, "volumePercent")
		if !ok || value < 0 || value > 100 {
			return nil, errors.New("volumePercent deve estar entre 0 e 100")
		}
		method, path = http.MethodPut, "/v1/me/player/volume"
		query.Set("volume_percent", strconv.Itoa(value))
	case "seek":
		value, ok := intParam(params, "positionMs")
		if !ok || value < 0 {
			return nil, errors.New("positionMs inválido")
		}
		method, path = http.MethodPut, "/v1/me/player/seek"
		query.Set("position_ms", strconv.Itoa(value))
	case "shuffle_on", "shuffle_off":
		method, path = http.MethodPut, "/v1/me/player/shuffle"
		query.Set("state", strconv.FormatBool(command == "shuffle_on"))
	case "repeat_track", "repeat_context", "repeat_off":
		method, path = http.MethodPut, "/v1/me/player/repeat"
		query.Set("state", strings.TrimPrefix(command, "repeat_"))
	case "transfer_playback":
		deviceID, _ := params["deviceId"].(string)
		deviceID = strings.TrimSpace(deviceID)
		if deviceID == "" {
			return nil, errors.New("deviceId é obrigatório")
		}
		method, path = http.MethodPut, "/v1/me/player"
		raw, _ := json.Marshal(map[string]any{"device_ids": []string{deviceID}, "play": true})
		requestBody = bytes.NewReader(raw)
		contentType = "application/json"
	default:
		return nil, fmt.Errorf("comando Spotify não suportado: %s", command)
	}
	endpoint := "https://api.spotify.com" + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	req, _ := http.NewRequestWithContext(ctx, method, endpoint, requestBody)
	req.Header.Set("Authorization", "Bearer "+token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := a.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, errors.New(spotifyError(resp))
	}
	return map[string]any{"command": command, "status": resp.StatusCode}, nil
}

func (a *SpotifyAdapter) focusSnapshot(ctx context.Context, token string) (map[string]any, error) {
	playback, playbackCode, err := a.getJSON(ctx, token, "https://api.spotify.com/v1/me/player")
	if err != nil {
		return nil, err
	}
	result := map[string]any{"available": true, "fetchedAt": time.Now().UnixMilli(), "playing": false, "queue": []any{}, "devices": []any{}}
	if playbackCode != http.StatusNoContent {
		for key, value := range spotifyPlaybackState(playback) {
			result[key] = value
		}
		if item, ok := playback["item"].(map[string]any); ok {
			result["track"] = spotifyTrackFromItem(item)
		}
		if device, ok := playback["device"].(map[string]any); ok {
			result["device"] = spotifyDeviceFromMap(device)
		}
		if contextObj, ok := playback["context"].(map[string]any); ok {
			if v, ok := contextObj["type"].(string); ok {
				result["contextType"] = v
			}
		}
	}

	if devicesPayload, _, devicesErr := a.getJSON(ctx, token, "https://api.spotify.com/v1/me/player/devices"); devicesErr == nil {
		devices := []any{}
		if raw, ok := devicesPayload["devices"].([]any); ok {
			for _, entry := range raw {
				if device, ok := entry.(map[string]any); ok {
					devices = append(devices, spotifyDeviceFromMap(device))
				}
			}
		}
		result["devices"] = devices
	}

	if queuePayload, _, queueErr := a.getJSON(ctx, token, "https://api.spotify.com/v1/me/player/queue"); queueErr == nil {
		queue := []any{}
		if raw, ok := queuePayload["queue"].([]any); ok {
			for index, entry := range raw {
				if index >= 12 {
					break
				}
				if item, ok := entry.(map[string]any); ok {
					queue = append(queue, spotifyTrackFromItem(item))
				}
			}
		}
		result["queue"] = queue
	}
	return result, nil
}

func (a *SpotifyAdapter) getJSON(ctx context.Context, token, endpoint string) (map[string]any, int, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := a.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNoContent {
		return map[string]any{}, resp.StatusCode, nil
	}
	if resp.StatusCode >= 300 {
		return nil, resp.StatusCode, errors.New(spotifyError(resp))
	}
	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, resp.StatusCode, err
	}
	return payload, resp.StatusCode, nil
}

func spotifyPlaybackState(payload map[string]any) map[string]any {
	state := map[string]any{}
	if playing, ok := payload["is_playing"].(bool); ok {
		state["playing"] = playing
	}
	if progress, ok := numberFromAny(payload["progress_ms"]); ok {
		state["progressMs"] = progress
	}
	if shuffle, ok := payload["shuffle_state"].(bool); ok {
		state["shuffle"] = shuffle
	}
	if repeat, ok := payload["repeat_state"].(string); ok {
		state["repeat"] = repeat
	}
	if item, ok := payload["item"].(map[string]any); ok {
		track := spotifyTrackFromItem(item)
		for key, value := range track {
			switch key {
			case "name":
				state["track"] = value
			case "artist", "album", "artworkUrl", "spotifyUrl", "uri", "durationMs", "explicit":
				state[key] = value
			}
		}
	}
	if device, ok := payload["device"].(map[string]any); ok {
		if name, ok := device["name"].(string); ok {
			state["device"] = name
		}
		if vol, ok := numberFromAny(device["volume_percent"]); ok {
			state["volumePercent"] = vol
		}
	}
	return state
}

func spotifyTrackFromItem(item map[string]any) map[string]any {
	track := map[string]any{}
	if name, ok := item["name"].(string); ok {
		track["name"] = name
	}
	if duration, ok := numberFromAny(item["duration_ms"]); ok {
		track["durationMs"] = duration
	}
	if explicit, ok := item["explicit"].(bool); ok {
		track["explicit"] = explicit
	}
	if uri, ok := item["uri"].(string); ok {
		track["uri"] = uri
	}
	if urls, ok := item["external_urls"].(map[string]any); ok {
		if spotifyURL, ok := urls["spotify"].(string); ok {
			track["spotifyUrl"] = spotifyURL
		}
	}
	if artists, ok := item["artists"].([]any); ok {
		names := []string{}
		for _, value := range artists {
			if artist, ok := value.(map[string]any); ok {
				if name, ok := artist["name"].(string); ok {
					names = append(names, name)
				}
			}
		}
		if len(names) > 0 {
			track["artist"] = strings.Join(names, ", ")
		}
	}
	if album, ok := item["album"].(map[string]any); ok {
		if name, ok := album["name"].(string); ok {
			track["album"] = name
		}
		if images, ok := album["images"].([]any); ok && len(images) > 0 {
			if first, ok := images[0].(map[string]any); ok {
				if imageURL, ok := first["url"].(string); ok {
					track["artworkUrl"] = imageURL
				}
			}
		}
	}
	return track
}

func spotifyDeviceFromMap(device map[string]any) map[string]any {
	out := map[string]any{}
	if id, ok := device["id"].(string); ok {
		out["id"] = id
	}
	if name, ok := device["name"].(string); ok {
		out["name"] = name
	}
	if typ, ok := device["type"].(string); ok {
		out["type"] = typ
	}
	if active, ok := device["is_active"].(bool); ok {
		out["active"] = active
	}
	if restricted, ok := device["is_restricted"].(bool); ok {
		out["restricted"] = restricted
	}
	if volume, ok := numberFromAny(device["volume_percent"]); ok {
		out["volumePercent"] = volume
	}
	return out
}

func (a *SpotifyAdapter) AuthorizationURL() (string, error) {
	cfg := a.store.Snapshot().Integrations.Spotify
	if strings.TrimSpace(cfg.ClientID) == "" {
		return "", errors.New("salve o Client ID do Spotify primeiro")
	}
	verifier := randomURLToken(64)
	hash := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(hash[:])
	state := randomURLToken(24)
	a.mu.Lock()
	a.pending = spotifyAuthPending{State: state, Verifier: verifier, Expires: time.Now().Add(8 * time.Minute)}
	a.mu.Unlock()
	q := url.Values{}
	q.Set("client_id", cfg.ClientID)
	q.Set("response_type", "code")
	q.Set("redirect_uri", spotifyRedirectURI)
	q.Set("scope", spotifyScopes)
	q.Set("state", state)
	q.Set("code_challenge_method", "S256")
	q.Set("code_challenge", challenge)
	q.Set("show_dialog", "true")
	return "https://accounts.spotify.com/authorize?" + q.Encode(), nil
}

func (a *SpotifyAdapter) CompleteAuthorization(ctx context.Context, code, state string) error {
	a.mu.Lock()
	pending := a.pending
	a.pending = spotifyAuthPending{}
	a.mu.Unlock()
	if pending.State == "" || state != pending.State || time.Now().After(pending.Expires) {
		return errors.New("autorização Spotify expirou ou é inválida")
	}
	cfg := a.store.Snapshot().Integrations.Spotify
	form := url.Values{}
	form.Set("client_id", cfg.ClientID)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", spotifyRedirectURI)
	form.Set("code_verifier", pending.Verifier)
	token, err := a.exchangeToken(ctx, form)
	if err != nil {
		return err
	}
	return a.store.SetSpotifyTokens(token.AccessToken, token.RefreshToken, token.TokenType, token.Scope, time.Now().Add(time.Duration(token.ExpiresIn)*time.Second).Unix())
}

func (a *SpotifyAdapter) Disconnect() error { return a.store.SetSpotifyTokens("", "", "", "", 0) }

func (a *SpotifyAdapter) accessToken(ctx context.Context) (string, error) {
	cfg := a.store.Snapshot().Integrations.Spotify
	if cfg.AccessToken != "" && cfg.ExpiresAt > time.Now().Add(30*time.Second).Unix() {
		return cfg.AccessToken, nil
	}
	if cfg.RefreshToken == "" {
		return "", errors.New("Spotify ainda não foi autorizado")
	}
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", cfg.RefreshToken)
	form.Set("client_id", cfg.ClientID)
	token, err := a.exchangeToken(ctx, form)
	if err != nil {
		return "", err
	}
	refresh := token.RefreshToken
	if refresh == "" {
		refresh = cfg.RefreshToken
	}
	scope := token.Scope
	if scope == "" {
		scope = cfg.Scope
	}
	typ := token.TokenType
	if typ == "" {
		typ = cfg.TokenType
	}
	if err := a.store.SetSpotifyTokens(token.AccessToken, refresh, typ, scope, time.Now().Add(time.Duration(token.ExpiresIn)*time.Second).Unix()); err != nil {
		return "", err
	}
	return token.AccessToken, nil
}

type spotifyToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

func (a *SpotifyAdapter) exchangeToken(ctx context.Context, form url.Values) (spotifyToken, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://accounts.spotify.com/api/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := a.http.Do(req)
	if err != nil {
		return spotifyToken{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return spotifyToken{}, errors.New(spotifyError(resp))
	}
	var token spotifyToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return token, err
	}
	if token.AccessToken == "" {
		return token, errors.New("Spotify não retornou access_token")
	}
	return token, nil
}

func spotifyError(resp *http.Response) string {
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
	var payload map[string]any
	if json.Unmarshal(raw, &payload) == nil {
		if v, ok := payload["error_description"].(string); ok && v != "" {
			return v
		}
		if v, ok := payload["error"].(string); ok && v != "" {
			return v
		}
		if e, ok := payload["error"].(map[string]any); ok {
			if m, ok := e["message"].(string); ok && m != "" {
				return m
			}
		}
	}
	return fmt.Sprintf("Spotify respondeu HTTP %d", resp.StatusCode)
}
func randomURLToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
func intParam(params map[string]any, key string) (int, bool) {
	if params == nil {
		return 0, false
	}
	return numberFromAny(params[key])
}
func numberFromAny(v any) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case json.Number:
		i, e := strconv.Atoi(n.String())
		return i, e == nil
	case string:
		i, e := strconv.Atoi(n)
		return i, e == nil
	default:
		return 0, false
	}
}
