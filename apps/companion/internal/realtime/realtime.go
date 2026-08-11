package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Config points to the Nexus Relay exposed by the official Nexus Web deploy.
// V1.8 has no external realtime provider configuration.
type Config struct {
	RelayURL string
}

type Session struct {
	ws     *wsConn
	topic  string
	mu     sync.Mutex
	closed chan struct{}
}

func RelayURLForWebApp(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", errors.New("Nexus Web URL is empty")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		return "", errors.New("invalid Nexus Web URL")
	}
	switch u.Scheme {
	case "https":
		u.Scheme = "wss"
	case "http":
		// HTTP is accepted only for local development. Production uses HTTPS.
		u.Scheme = "ws"
	default:
		return "", errors.New("Nexus Web URL must use http/https")
	}
	u.Path = "/api/relay"
	u.RawQuery = ""
	u.Fragment = ""
	return u.String(), nil
}

func relayEndpoint(baseURL, topic string) (string, error) {
	u, err := url.Parse(baseURL)
	if err != nil || u.Host == "" {
		return "", errors.New("invalid Nexus Relay URL")
	}
	if u.Scheme != "ws" && u.Scheme != "wss" {
		return "", errors.New("Nexus Relay must use ws/wss")
	}
	q := u.Query()
	q.Set("room", topic)
	q.Set("role", "bridge")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func DialChannel(ctx context.Context, cfg Config, topic string) (*Session, error) {
	if strings.TrimSpace(cfg.RelayURL) == "" {
		return nil, errors.New("Nexus Relay URL is empty")
	}
	endpoint, err := relayEndpoint(cfg.RelayURL, topic)
	if err != nil {
		return nil, err
	}
	ws, err := dialWebSocket(endpoint, 12*time.Second)
	if err != nil {
		return nil, err
	}
	s := &Session{ws: ws, topic: topic, closed: make(chan struct{})}
	deadline := time.NewTimer(10 * time.Second)
	defer deadline.Stop()
	for {
		select {
		case <-ctx.Done():
			_ = ws.Close()
			return nil, ctx.Err()
		case <-deadline.C:
			_ = ws.Close()
			return nil, errors.New("timeout joining Nexus Relay")
		default:
		}
		data, err := ws.ReadText()
		if err != nil {
			_ = ws.Close()
			return nil, err
		}
		var frame struct {
			Type string `json:"type"`
			Room string `json:"room"`
		}
		if json.Unmarshal(data, &frame) == nil && frame.Type == "relay-ready" && frame.Room == topic {
			go s.heartbeat()
			return s, nil
		}
	}
}

func (s *Session) heartbeat() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			data, _ := json.Marshal(map[string]any{"type": "ping", "ts": time.Now().UnixMilli()})
			_ = s.ws.WriteText(data)
		case <-s.closed:
			return
		}
	}
}

func (s *Session) Broadcast(payload any) error {
	data, err := json.Marshal(map[string]any{"type": "nexus", "payload": payload})
	if err != nil {
		return err
	}
	return s.ws.WriteText(data)
}

func (s *Session) ReadBroadcast(ctx context.Context, handler func(json.RawMessage)) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		data, err := s.ws.ReadText()
		if err != nil {
			return err
		}
		var frame struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if json.Unmarshal(data, &frame) != nil || frame.Type != "nexus" || len(frame.Payload) == 0 {
			continue
		}
		handler(frame.Payload)
	}
}

func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	select {
	case <-s.closed:
	default:
		close(s.closed)
	}
	return s.ws.Close()
}
