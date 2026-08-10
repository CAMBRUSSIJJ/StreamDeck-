package integrations

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"nexusdeck/companion/internal/store"
)

type Command struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	Description string `json:"description,omitempty"`
	Requires    string `json:"requires,omitempty"`
}

type Status struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Kind       string         `json:"kind"`
	Configured bool           `json:"configured"`
	Connected  bool           `json:"connected"`
	Detail     string         `json:"detail,omitempty"`
	State      map[string]any `json:"state,omitempty"`
	Error      string         `json:"error,omitempty"`
	Commands   []Command      `json:"commands,omitempty"`
}

type Adapter interface {
	ID() string
	Name() string
	Kind() string
	Commands() []Command
	Status(context.Context) Status
	Execute(context.Context, string, map[string]any) (map[string]any, error)
}

type Manager struct {
	store    *store.Store
	adapters map[string]Adapter
	mu       sync.Mutex
	cacheAt  time.Time
	cache    map[string]Status

	OBS     *OBSAdapter
	Spotify *SpotifyAdapter
	Discord *DiscordAdapter
	Browser *BrowserAdapter
}

func NewManager(s *store.Store) *Manager {
	m := &Manager{store: s, adapters: map[string]Adapter{}, cache: map[string]Status{}}
	m.OBS = NewOBSAdapter(s)
	m.Spotify = NewSpotifyAdapter(s)
	m.Discord = NewDiscordAdapter(s)
	m.Browser = NewBrowserAdapter()
	m.Register(m.OBS)
	m.Register(m.Spotify)
	m.Register(m.Discord)
	m.Register(m.Browser)
	return m
}

func (m *Manager) Register(adapter Adapter) {
	if adapter == nil || adapter.ID() == "" {
		return
	}
	m.adapters[adapter.ID()] = adapter
}

func (m *Manager) Catalog() []Status {
	ids := make([]string, 0, len(m.adapters))
	for id := range m.adapters {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	out := make([]Status, 0, len(ids))
	for _, id := range ids {
		a := m.adapters[id]
		out = append(out, Status{ID: a.ID(), Name: a.Name(), Kind: a.Kind(), Commands: a.Commands()})
	}
	return out
}

func (m *Manager) ExecuteIntegration(service, command string, params map[string]any) (map[string]any, error) {
	adapter, ok := m.adapters[service]
	if !ok {
		return nil, fmt.Errorf("integração %q não existe", service)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	result, err := adapter.Execute(ctx, command, params)
	m.invalidate()
	return result, err
}

func (m *Manager) Statuses() map[string]Status {
	m.mu.Lock()
	if time.Since(m.cacheAt) < 3*time.Second && len(m.cache) > 0 {
		out := cloneStatuses(m.cache)
		m.mu.Unlock()
		return out
	}
	m.mu.Unlock()

	type item struct {
		id     string
		status Status
	}
	ch := make(chan item, len(m.adapters))
	for id, adapter := range m.adapters {
		go func(id string, adapter Adapter) {
			ctx, cancel := context.WithTimeout(context.Background(), 1400*time.Millisecond)
			defer cancel()
			status := adapter.Status(ctx)
			status.ID = adapter.ID()
			status.Name = adapter.Name()
			status.Kind = adapter.Kind()
			status.Commands = adapter.Commands()
			ch <- item{id: id, status: status}
		}(id, adapter)
	}
	statuses := map[string]Status{}
	for range m.adapters {
		entry := <-ch
		statuses[entry.id] = entry.status
	}
	m.mu.Lock()
	m.cacheAt = time.Now()
	m.cache = cloneStatuses(statuses)
	m.mu.Unlock()
	return statuses
}

func (m *Manager) Status(id string) (Status, error) {
	adapter, ok := m.adapters[id]
	if !ok {
		return Status{}, errors.New("integração não encontrada")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	status := adapter.Status(ctx)
	status.ID = adapter.ID()
	status.Name = adapter.Name()
	status.Kind = adapter.Kind()
	status.Commands = adapter.Commands()
	return status, nil
}

func (m *Manager) invalidate() {
	m.mu.Lock()
	m.cacheAt = time.Time{}
	m.cache = map[string]Status{}
	m.mu.Unlock()
}

func cloneStatuses(in map[string]Status) map[string]Status {
	out := make(map[string]Status, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
