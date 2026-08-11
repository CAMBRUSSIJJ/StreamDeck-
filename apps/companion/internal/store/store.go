package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"nexusdeck/companion/internal/protocol"
)

type OBSIntegrationConfig struct {
	URL      string `json:"url,omitempty"`
	Password string `json:"password,omitempty"`
}

type SpotifyIntegrationConfig struct {
	ClientID     string `json:"clientId,omitempty"`
	AccessToken  string `json:"accessToken,omitempty"`
	RefreshToken string `json:"refreshToken,omitempty"`
	TokenType    string `json:"tokenType,omitempty"`
	Scope        string `json:"scope,omitempty"`
	ExpiresAt    int64  `json:"expiresAt,omitempty"`
}

type DiscordIntegrationConfig struct {
	MuteHotkey   string `json:"muteHotkey,omitempty"`
	DeafenHotkey string `json:"deafenHotkey,omitempty"`
}

type IntegrationsConfig struct {
	OBS     OBSIntegrationConfig     `json:"obs"`
	Spotify SpotifyIntegrationConfig `json:"spotify"`
	Discord DiscordIntegrationConfig `json:"discord"`
}

type Config struct {
	WebAppURL    string                 `json:"webAppUrl,omitempty"`
	Devices      []protocol.Device      `json:"devices"`
	LocalDevices []protocol.LocalDevice `json:"localDevices,omitempty"`
	Integrations IntegrationsConfig     `json:"integrations"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	cfg  Config
}

func New() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "NexusDeck", "config.json")
	s := &Store{path: path}
	if err := s.load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if s.cfg.Integrations.OBS.URL == "" {
		s.cfg.Integrations.OBS.URL = "ws://127.0.0.1:4455"
	}
	return s, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &s.cfg)
}

func (s *Store) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *Store) Snapshot() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.cfg
	out.Devices = append([]protocol.Device(nil), s.cfg.Devices...)
	out.LocalDevices = append([]protocol.LocalDevice(nil), s.cfg.LocalDevices...)
	return out
}

func (s *Store) SetWebAppURL(url string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg.WebAppURL = url
	return s.saveLocked()
}

func (s *Store) AddDevice(device protocol.Device) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.cfg.Devices {
		if s.cfg.Devices[i].ID == device.ID {
			s.cfg.Devices[i] = device
			return s.saveLocked()
		}
	}
	s.cfg.Devices = append(s.cfg.Devices, device)
	return s.saveLocked()
}

func (s *Store) RemoveDevice(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := s.cfg.Devices[:0]
	for _, d := range s.cfg.Devices {
		if d.ID != id {
			filtered = append(filtered, d)
		}
	}
	s.cfg.Devices = filtered
	return s.saveLocked()
}

func (s *Store) AddLocalDevice(device protocol.LocalDevice) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.cfg.LocalDevices {
		if s.cfg.LocalDevices[i].ID == device.ID {
			s.cfg.LocalDevices[i] = device
			return s.saveLocked()
		}
	}
	s.cfg.LocalDevices = append(s.cfg.LocalDevices, device)
	return s.saveLocked()
}

func (s *Store) LocalDevice(id string) (protocol.LocalDevice, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, device := range s.cfg.LocalDevices {
		if device.ID == id {
			return device, true
		}
	}
	return protocol.LocalDevice{}, false
}

func (s *Store) RemoveLocalDevice(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := s.cfg.LocalDevices[:0]
	for _, d := range s.cfg.LocalDevices {
		if d.ID != id {
			filtered = append(filtered, d)
		}
	}
	s.cfg.LocalDevices = filtered
	return s.saveLocked()
}

func (s *Store) SetOBSIntegration(url, password string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg.Integrations.OBS.URL = url
	s.cfg.Integrations.OBS.Password = password
	return s.saveLocked()
}

func (s *Store) SetSpotifyClientID(clientID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cfg.Integrations.Spotify.ClientID != clientID {
		s.cfg.Integrations.Spotify.AccessToken = ""
		s.cfg.Integrations.Spotify.RefreshToken = ""
		s.cfg.Integrations.Spotify.TokenType = ""
		s.cfg.Integrations.Spotify.Scope = ""
		s.cfg.Integrations.Spotify.ExpiresAt = 0
	}
	s.cfg.Integrations.Spotify.ClientID = clientID
	return s.saveLocked()
}

func (s *Store) SetSpotifyTokens(accessToken, refreshToken, tokenType, scope string, expiresAt int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg.Integrations.Spotify.AccessToken = accessToken
	s.cfg.Integrations.Spotify.RefreshToken = refreshToken
	s.cfg.Integrations.Spotify.TokenType = tokenType
	s.cfg.Integrations.Spotify.Scope = scope
	s.cfg.Integrations.Spotify.ExpiresAt = expiresAt
	return s.saveLocked()
}

func (s *Store) SetDiscordIntegration(muteHotkey, deafenHotkey string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg.Integrations.Discord.MuteHotkey = muteHotkey
	s.cfg.Integrations.Discord.DeafenHotkey = deafenHotkey
	return s.saveLocked()
}

func (s *Store) Path() string { return s.path }
