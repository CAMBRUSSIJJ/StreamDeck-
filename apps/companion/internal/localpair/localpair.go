package localpair

import (
	"crypto/ecdh"
	crand "crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"

	ncrypto "nexusdeck/companion/internal/crypto"
	"nexusdeck/companion/internal/protocol"
	"nexusdeck/companion/internal/store"
)

type Status struct {
	Code      string `json:"code,omitempty"`
	ExpiresAt int64  `json:"expiresAt"`
	Active    bool   `json:"active"`
}

type Manager struct {
	store       *store.Store
	mu          sync.RWMutex
	status      Status
	privateKey  *ecdh.PrivateKey
	publicKey   string
	serverNonce string
}

func New(s *store.Store) *Manager { return &Manager{store: s} }

func (m *Manager) Status() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expireLocked()
	return m.status
}

func (m *Manager) PublicStatus() Status {
	status := m.Status()
	status.Code = ""
	return status
}

func (m *Manager) Start() (Status, error) {
	code, err := randomCode()
	if err != nil {
		return Status{}, err
	}
	privateKey, publicKey, serverNonce, err := ncrypto.NewPairingIdentity()
	if err != nil {
		return Status{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.privateKey = privateKey
	m.publicKey = publicKey
	m.serverNonce = serverNonce
	m.status = Status{Code: code, ExpiresAt: time.Now().Add(2 * time.Minute).UnixMilli(), Active: true}
	return m.status, nil
}

func (m *Manager) Pair(request protocol.LocalPairRequest) (protocol.PairResponse, error) {
	if !validPairRequest(request) {
		return protocol.PairResponse{}, errors.New("solicitação de pareamento inválida")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expireLocked()
	if !m.status.Active || m.privateKey == nil {
		return protocol.PairResponse{}, errors.New("nenhum pareamento local ativo")
	}
	if request.Code != m.status.Code {
		return protocol.PairResponse{}, errors.New("código de pareamento incorreto")
	}
	pairKey, err := ncrypto.DerivePairKey(m.privateKey, request.ClientPublicKey, request.Code, request.ClientNonce, m.serverNonce)
	if err != nil {
		return protocol.PairResponse{}, err
	}
	id, err := ncrypto.RandomB64(12)
	if err != nil {
		return protocol.PairResponse{}, err
	}
	secret, err := ncrypto.RandomB64(32)
	if err != nil {
		return protocol.PairResponse{}, err
	}
	clientName := strings.TrimSpace(request.ClientName)
	if clientName == "" {
		clientName = "iPad"
	}
	clientPlatform := strings.TrimSpace(request.ClientPlatform)
	if clientPlatform == "" {
		clientPlatform = "iPadOS / Browser"
	}
	localDevice := protocol.LocalDevice{ID: id, Secret: secret, Name: clientName, Platform: clientPlatform, CreatedAt: time.Now().UnixMilli()}
	if err := m.store.AddLocalDevice(localDevice); err != nil {
		return protocol.PairResponse{}, err
	}
	host, _ := os.Hostname()
	if host == "" {
		host = "Windows PC"
	}
	platform := runtime.GOOS
	if platform == "windows" {
		platform = "Windows"
	}
	peer := protocol.LocalPeer{ID: id, Secret: secret, Name: host, Platform: platform, Transport: "local", Version: protocol.Version}
	envelope, err := ncrypto.EncryptJSON(peer, pairKey, fmt.Sprintf("local-pair:%s:%s", request.Code, request.RequestID))
	if err != nil {
		return protocol.PairResponse{}, err
	}
	response := protocol.PairResponse{Kind: "local-pair-response", RequestID: request.RequestID, ServerPublicKey: m.publicKey, ServerNonce: m.serverNonce, Envelope: envelope}
	m.status = Status{}
	m.privateKey = nil
	m.publicKey = ""
	m.serverNonce = ""
	return response, nil
}

func (m *Manager) PairSimple(code, clientName, clientPlatform string) (protocol.LocalPeer, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.expireLocked()
	if !m.status.Active {
		return protocol.LocalPeer{}, errors.New("nenhum pareamento local ativo")
	}
	if code != m.status.Code {
		return protocol.LocalPeer{}, errors.New("código de pareamento incorreto")
	}
	id, err := ncrypto.RandomB64(12)
	if err != nil {
		return protocol.LocalPeer{}, err
	}
	secret, err := ncrypto.RandomB64(32)
	if err != nil {
		return protocol.LocalPeer{}, err
	}
	clientName = strings.TrimSpace(clientName)
	if clientName == "" {
		clientName = "iPad"
	}
	clientPlatform = strings.TrimSpace(clientPlatform)
	if clientPlatform == "" {
		clientPlatform = "iPadOS / Browser"
	}
	if err := m.store.AddLocalDevice(protocol.LocalDevice{ID: id, Secret: secret, Name: clientName, Platform: clientPlatform, CreatedAt: time.Now().UnixMilli()}); err != nil {
		return protocol.LocalPeer{}, err
	}
	host, _ := os.Hostname()
	if host == "" {
		host = "Windows PC"
	}
	platform := runtime.GOOS
	if platform == "windows" {
		platform = "Windows"
	}
	peer := protocol.LocalPeer{ID: id, Secret: secret, Name: host, Platform: platform, Transport: "local", Version: protocol.Version}
	m.status = Status{}
	m.privateKey = nil
	m.publicKey = ""
	m.serverNonce = ""
	return peer, nil
}

func (m *Manager) expireLocked() {
	if m.status.Active && time.Now().UnixMilli() >= m.status.ExpiresAt {
		m.status = Status{}
		m.privateKey = nil
		m.publicKey = ""
		m.serverNonce = ""
	}
}

func validPairRequest(request protocol.LocalPairRequest) bool {
	return len(request.Code) == 6 && request.RequestID != "" && request.ClientPublicKey != "" && request.ClientNonce != ""
}

func randomCode() (string, error) {
	n, err := crand.Int(crand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
