package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"nexusdeck/companion/internal/protocol"
)

type Config struct {
	SupabaseURL     string            `json:"supabaseUrl"`
	SupabaseAnonKey string            `json:"supabaseAnonKey"`
	Devices         []protocol.Device `json:"devices"`
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
	return out
}

func (s *Store) SetCloud(url, anonKey string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cfg.SupabaseURL = url
	s.cfg.SupabaseAnonKey = anonKey
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

func (s *Store) Path() string { return s.path }
