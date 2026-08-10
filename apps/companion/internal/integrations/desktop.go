package integrations

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"strings"

	"nexusdeck/companion/internal/store"
)

type DiscordAdapter struct{ store *store.Store }

func NewDiscordAdapter(s *store.Store) *DiscordAdapter { return &DiscordAdapter{store: s} }
func (a *DiscordAdapter) ID() string                   { return "discord" }
func (a *DiscordAdapter) Name() string                 { return "Discord Desktop" }
func (a *DiscordAdapter) Kind() string                 { return "desktop-shortcut" }
func (a *DiscordAdapter) Commands() []Command {
	return []Command{{ID: "toggle_mute", Label: "Alternar microfone"}, {ID: "toggle_deafen", Label: "Alternar áudio"}, {ID: "open", Label: "Abrir Discord"}}
}
func (a *DiscordAdapter) Status(ctx context.Context) Status {
	cfg := a.store.Snapshot().Integrations.Discord
	configured := strings.TrimSpace(cfg.MuteHotkey) != "" && strings.TrimSpace(cfg.DeafenHotkey) != ""
	return Status{Configured: configured, Connected: runtime.GOOS == "windows" && configured, Detail: "Compatibilidade por atalhos configuráveis do Discord", State: map[string]any{"muteHotkey": cfg.MuteHotkey, "deafenHotkey": cfg.DeafenHotkey}}
}
func (a *DiscordAdapter) Execute(ctx context.Context, command string, params map[string]any) (map[string]any, error) {
	cfg := a.store.Snapshot().Integrations.Discord
	switch command {
	case "toggle_mute":
		if err := sendDesktopHotkey(parseHotkey(cfg.MuteHotkey)); err != nil {
			return nil, err
		}
	case "toggle_deafen":
		if err := sendDesktopHotkey(parseHotkey(cfg.DeafenHotkey)); err != nil {
			return nil, err
		}
	case "open":
		if err := openDesktopURL("discord://"); err != nil {
			return nil, err
		}
	default:
		return nil, fmt.Errorf("comando Discord não suportado: %s", command)
	}
	return map[string]any{"command": command}, nil
}

type BrowserAdapter struct{}

func NewBrowserAdapter() *BrowserAdapter { return &BrowserAdapter{} }
func (a *BrowserAdapter) ID() string     { return "browser" }
func (a *BrowserAdapter) Name() string   { return "Navegador" }
func (a *BrowserAdapter) Kind() string   { return "desktop-shortcut" }
func (a *BrowserAdapter) Commands() []Command {
	return []Command{{ID: "new_tab", Label: "Nova aba"}, {ID: "close_tab", Label: "Fechar aba"}, {ID: "reopen_tab", Label: "Reabrir aba"}, {ID: "next_tab", Label: "Próxima aba"}, {ID: "previous_tab", Label: "Aba anterior"}, {ID: "reload", Label: "Recarregar"}, {ID: "focus_address", Label: "Focar barra de endereço"}, {ID: "fullscreen", Label: "Tela cheia"}, {ID: "incognito", Label: "Nova janela anônima"}}
}
func (a *BrowserAdapter) Status(ctx context.Context) Status {
	return Status{Configured: true, Connected: runtime.GOOS == "windows", Detail: "Chrome, Edge e navegadores compatíveis por atalhos de desktop"}
}
func (a *BrowserAdapter) Execute(ctx context.Context, command string, params map[string]any) (map[string]any, error) {
	keys := map[string][]string{"new_tab": {"CTRL", "T"}, "close_tab": {"CTRL", "W"}, "reopen_tab": {"CTRL", "SHIFT", "T"}, "next_tab": {"CTRL", "TAB"}, "previous_tab": {"CTRL", "SHIFT", "TAB"}, "reload": {"CTRL", "R"}, "focus_address": {"CTRL", "L"}, "fullscreen": {"F11"}, "incognito": {"CTRL", "SHIFT", "N"}}[command]
	if len(keys) == 0 {
		return nil, fmt.Errorf("comando de navegador não suportado: %s", command)
	}
	if err := sendDesktopHotkey(keys); err != nil {
		return nil, err
	}
	return map[string]any{"command": command}, nil
}

func parseHotkey(raw string) []string {
	parts := strings.Split(strings.ToUpper(strings.TrimSpace(raw)), "+")
	out := []string{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func validateHotkeyString(raw string) error {
	keys := parseHotkey(raw)
	if len(keys) < 1 || len(keys) > 5 {
		return errors.New("atalho precisa ter 1 a 5 teclas")
	}
	for _, k := range keys {
		if len(k) > 16 {
			return errors.New("tecla inválida")
		}
	}
	return nil
}
