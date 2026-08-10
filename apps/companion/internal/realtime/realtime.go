package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

type Config struct{ URL, AnonKey string }

type Session struct {
	ws      *wsConn
	topic   string
	joinRef string
	ref     atomic.Uint64
	mu      sync.Mutex
	closed  chan struct{}
}

func websocketEndpoint(cfg Config) (string, error) {
	u, err := url.Parse(cfg.URL)
	if err != nil {
		return "", err
	}
	if u.Host == "" {
		return "", errors.New("invalid Supabase URL")
	}
	if u.Scheme == "https" {
		u.Scheme = "wss"
	} else if u.Scheme == "http" {
		u.Scheme = "ws"
	} else {
		return "", errors.New("Supabase URL must use http/https")
	}
	u.Path = "/realtime/v1/websocket"
	q := u.Query()
	q.Set("apikey", cfg.AnonKey)
	q.Set("vsn", "2.0.0")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func DialChannel(ctx context.Context, cfg Config, topic string) (*Session, error) {
	endpoint, err := websocketEndpoint(cfg)
	if err != nil {
		return nil, err
	}
	ws, err := dialWebSocket(endpoint, 12*time.Second)
	if err != nil {
		return nil, err
	}
	s := &Session{ws: ws, topic: "realtime:" + topic, closed: make(chan struct{})}
	joinRef := s.nextRef()
	s.joinRef = joinRef
	payload := map[string]any{"config": map[string]any{
		"broadcast":        map[string]any{"ack": false, "self": false},
		"presence":         map[string]any{"enabled": false, "key": ""},
		"postgres_changes": []any{}, "private": false,
	}}
	if err := s.send(joinRef, joinRef, s.topic, "phx_join", payload); err != nil {
		ws.Close()
		return nil, err
	}
	deadline := time.NewTimer(10 * time.Second)
	defer deadline.Stop()
	for {
		select {
		case <-ctx.Done():
			ws.Close()
			return nil, ctx.Err()
		case <-deadline.C:
			ws.Close()
			return nil, errors.New("timeout joining realtime channel")
		default:
		}
		data, err := ws.ReadText()
		if err != nil {
			ws.Close()
			return nil, err
		}
		var frame []json.RawMessage
		if json.Unmarshal(data, &frame) != nil || len(frame) != 5 {
			continue
		}
		var ref, event string
		_ = json.Unmarshal(frame[1], &ref)
		_ = json.Unmarshal(frame[3], &event)
		if ref == joinRef && event == "phx_reply" {
			var reply struct {
				Status string `json:"status"`
			}
			if err := json.Unmarshal(frame[4], &reply); err != nil {
				ws.Close()
				return nil, err
			}
			if reply.Status != "ok" {
				ws.Close()
				return nil, fmt.Errorf("realtime join rejected: %s", reply.Status)
			}
			go s.heartbeat()
			return s, nil
		}
	}
}

func (s *Session) nextRef() string { return strconv.FormatUint(s.ref.Add(1), 10) }

func (s *Session) send(joinRef, ref, topic, event string, payload any) error {
	frame := []any{joinRef, ref, topic, event, payload}
	data, err := json.Marshal(frame)
	if err != nil {
		return err
	}
	return s.ws.WriteText(data)
}

func (s *Session) heartbeat() {
	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			ref := s.nextRef()
			_ = s.send("", ref, "phoenix", "heartbeat", map[string]any{})
		case <-s.closed:
			return
		}
	}
}

func (s *Session) Broadcast(payload any) error {
	ref := s.nextRef()
	return s.send(s.joinRef, ref, s.topic, "broadcast", map[string]any{"event": "nexus", "type": "broadcast", "payload": payload})
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
		var frame []json.RawMessage
		if json.Unmarshal(data, &frame) != nil || len(frame) != 5 {
			continue
		}
		var topic, event string
		_ = json.Unmarshal(frame[2], &topic)
		_ = json.Unmarshal(frame[3], &event)
		if topic != s.topic || event != "broadcast" {
			continue
		}
		var outer struct {
			Event   string          `json:"event"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(frame[4], &outer); err != nil || outer.Event != "nexus" {
			continue
		}
		handler(outer.Payload)
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
