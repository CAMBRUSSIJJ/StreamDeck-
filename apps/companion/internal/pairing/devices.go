package pairing

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"nexusdeck/companion/internal/actions"
	ncrypto "nexusdeck/companion/internal/crypto"
	"nexusdeck/companion/internal/foreground"
	"nexusdeck/companion/internal/integrations"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/realtime"
	"nexusdeck/companion/internal/store"
	"nexusdeck/companion/internal/systemstate"
)

type DeviceManager struct {
	store        *store.Store
	integrations *integrations.Manager
	ctx          context.Context
	cancel       context.CancelFunc
	mu           sync.Mutex
	workers      map[string]context.CancelFunc
	startedAt    time.Time
	statusSeq    atomic.Uint64
}

func NewDeviceManager(s *store.Store, integrationManager *integrations.Manager) *DeviceManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &DeviceManager{store: s, integrations: integrationManager, ctx: ctx, cancel: cancel, workers: map[string]context.CancelFunc{}, startedAt: time.Now()}
}

func (m *DeviceManager) Sync() {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Sync is intentionally a restart point. Besides adding/removing devices it
	// is called after the Nexus Web URL changes, so existing WebSocket workers
	// must reconnect to the new Vercel relay instead of remaining on the old
	// endpoint until a network failure happens.
	for id, cancel := range m.workers {
		cancel()
		delete(m.workers, id)
	}

	cfg := m.store.Snapshot()
	for _, d := range cfg.Devices {
		ctx, cancel := context.WithCancel(m.ctx)
		m.workers[d.ID] = cancel
		go m.runDevice(ctx, d)
	}
}

func (m *DeviceManager) Stop() { m.cancel() }

func (m *DeviceManager) runDevice(ctx context.Context, device protocol.Device) {
	key, err := ncrypto.DecodeSecret(device.Secret)
	if err != nil {
		return
	}
	backoff := time.Second
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		cfg := m.store.Snapshot()
		if cfg.WebAppURL == "" {
			time.Sleep(2 * time.Second)
			continue
		}
		relayURL, relayErr := realtime.RelayURLForWebApp(cfg.WebAppURL)
		if relayErr != nil {
			time.Sleep(2 * time.Second)
			continue
		}
		relayCfg := realtime.Config{RelayURL: relayURL}
		session, err := realtime.DialChannel(ctx, relayCfg, "nexus-device-"+device.RoomID)
		if err != nil {
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			if backoff < 15*time.Second {
				backoff *= 2
			}
			continue
		}
		backoff = time.Second
		done := make(chan struct{})
		go m.statusLoop(ctx, done, session, device, key)
		err = session.ReadBroadcast(ctx, func(raw json.RawMessage) { m.handleDeviceMessage(session, device, key, raw) })
		close(done)
		session.Close()
		if err != nil {
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
		}
	}
}

func (m *DeviceManager) snapshotStatus() map[string]any {
	host, _ := os.Hostname()
	if host == "" {
		host = "Windows PC"
	}
	now := time.Now()
	body := map[string]any{
		"online":        true,
		"hostname":      host,
		"platform":      "Windows",
		"version":       protocol.AppVersion,
		"transport":     "cloud",
		"uptimeSeconds": int64(now.Sub(m.startedAt).Seconds()),
		"serverTime":    now.UTC().Format(time.RFC3339Nano),
		"syncSequence":  m.statusSeq.Add(1),
	}
	if active, ok := foreground.Current(); ok {
		body["activeApp"] = active
	}
	if m.integrations != nil {
		body["integrations"] = m.integrations.Statuses()
	}
	for key, value := range systemstate.Snapshot() {
		body[key] = value
	}
	return body
}

func (m *DeviceManager) statusLoop(ctx context.Context, done <-chan struct{}, session *realtime.Session, device protocol.Device, key []byte) {
	// Three seconds keeps the iPad UI visibly live without turning normal idle
	// status into a high-frequency stream. Command acknowledgements include an
	// immediate fresh snapshot, so user actions do not wait for this ticker.
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	send := func() {
		message := map[string]any{"type": "status", "id": mustRandom(10), "ts": time.Now().UnixMilli(), "body": m.snapshotStatus()}
		env, err := ncrypto.EncryptJSON(message, key, fmt.Sprintf("nexus:%s:v1", device.RoomID))
		if err == nil {
			_ = session.Broadcast(env)
		}
	}
	send()
	for {
		select {
		case <-ticker.C:
			send()
		case <-done:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (m *DeviceManager) handleDeviceMessage(session *realtime.Session, device protocol.Device, key []byte, raw json.RawMessage) {
	var env protocol.Envelope
	if json.Unmarshal(raw, &env) != nil {
		return
	}
	var msg struct {
		Type string          `json:"type"`
		ID   string          `json:"id"`
		TS   int64           `json:"ts"`
		Body json.RawMessage `json:"body"`
	}
	if ncrypto.DecryptJSON(env, key, fmt.Sprintf("nexus:%s:v1", device.RoomID), &msg) != nil || msg.Type != "command" {
		return
	}
	body, err := actions.DecodeBody(msg.Body)
	var report actions.ExecutionReport
	if err == nil {
		report, err = actions.ExecuteWithReport(body.Action, m.integrations)
	}
	ackBody := map[string]any{"commandId": msg.ID, "ok": err == nil, "state": m.snapshotStatus()}
	if body.Action.Type == "macro" || body.Action.Type == "integration" {
		ackBody["report"] = report
	}
	if err != nil {
		ackBody["error"] = err.Error()
	}
	ack := map[string]any{"type": "ack", "id": mustRandom(10), "ts": time.Now().UnixMilli(), "body": ackBody}
	ackEnv, encErr := ncrypto.EncryptJSON(ack, key, fmt.Sprintf("nexus:%s:v1", device.RoomID))
	if encErr == nil {
		_ = session.Broadcast(ackEnv)
	}
}

func mustRandom(n int) string { s, _ := ncrypto.RandomB64(n); return s }
