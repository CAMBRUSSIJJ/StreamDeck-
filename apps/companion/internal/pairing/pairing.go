package pairing

import (
	"context"
	crand "crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"os"
	"runtime"
	"sync"
	"time"

	ncrypto "nexusdeck/companion/internal/crypto"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/realtime"
	"nexusdeck/companion/internal/store"
)

type PairStatus struct {
	Code      string `json:"code"`
	ExpiresAt int64  `json:"expiresAt"`
	Active    bool   `json:"active"`
}

type PairManager struct {
	store   *store.Store
	devices *DeviceManager
	mu      sync.RWMutex
	status  PairStatus
	cancel  context.CancelFunc
}

func NewPairManager(s *store.Store, devices *DeviceManager) *PairManager {
	return &PairManager{store: s, devices: devices}
}

func (p *PairManager) Status() PairStatus { p.mu.RLock(); defer p.mu.RUnlock(); return p.status }

func (p *PairManager) Start(parent context.Context) (PairStatus, error) {
	cfg := p.store.Snapshot()
	if cfg.WebAppURL == "" {
		return PairStatus{}, errors.New("configure the Nexus Web URL first")
	}
	relayURL, relayErr := realtime.RelayURLForWebApp(cfg.WebAppURL)
	if relayErr != nil {
		return PairStatus{}, relayErr
	}
	relayCfg := realtime.Config{RelayURL: relayURL}
	p.mu.Lock()
	if p.cancel != nil {
		p.cancel()
	}
	ctx, cancel := context.WithTimeout(parent, 2*time.Minute)
	p.cancel = cancel
	code, err := randomCode()
	if err != nil {
		p.mu.Unlock()
		return PairStatus{}, err
	}
	priv, public, serverNonce, err := ncrypto.NewPairingIdentity()
	if err != nil {
		p.mu.Unlock()
		return PairStatus{}, err
	}
	p.status = PairStatus{Code: code, ExpiresAt: time.Now().Add(2 * time.Minute).UnixMilli(), Active: true}
	status := p.status
	p.mu.Unlock()

	session, err := realtime.DialChannel(ctx, relayCfg, "nexus-pair-"+code)
	if err != nil {
		cancel()
		p.clear(code)
		return PairStatus{}, err
	}
	go func() {
		defer session.Close()
		defer cancel()
		defer p.clear(code)
		_ = session.ReadBroadcast(ctx, func(raw json.RawMessage) {
			var req protocol.PairRequest
			if json.Unmarshal(raw, &req) != nil || req.Kind != "pair-request" || req.RequestID == "" {
				return
			}
			pairKey, err := ncrypto.DerivePairKey(priv, req.ClientPublicKey, code, req.ClientNonce, serverNonce)
			if err != nil {
				return
			}
			device, err := p.newDevice()
			if err != nil {
				return
			}
			env, err := ncrypto.EncryptJSON(device, pairKey, fmt.Sprintf("pair:%s:%s", code, req.RequestID))
			if err != nil {
				return
			}
			resp := protocol.PairResponse{Kind: "pair-response", RequestID: req.RequestID, ServerPublicKey: public, ServerNonce: serverNonce, Envelope: env}
			if err := session.Broadcast(resp); err != nil {
				return
			}
			if err := p.store.AddDevice(device); err != nil {
				return
			}
			p.devices.Sync()
			cancel()
		})
	}()
	return status, nil
}

func (p *PairManager) clear(code string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.status.Code == code {
		p.status = PairStatus{}
		p.cancel = nil
	}
}

func (p *PairManager) newDevice() (protocol.Device, error) {
	id, err := ncrypto.RandomB64(12)
	if err != nil {
		return protocol.Device{}, err
	}
	room, err := ncrypto.RandomB64(16)
	if err != nil {
		return protocol.Device{}, err
	}
	secret, err := ncrypto.RandomB64(32)
	if err != nil {
		return protocol.Device{}, err
	}
	host, _ := os.Hostname()
	if host == "" {
		host = "Windows PC"
	}
	platform := runtime.GOOS
	if platform == "windows" {
		platform = "Windows"
	}
	return protocol.Device{ID: id, RoomID: room, Secret: secret, Name: host, Platform: platform, Version: protocol.Version}, nil
}

func randomCode() (string, error) {
	n, err := crand.Int(crand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
