package actions

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
)

type Action struct {
	Type string   `json:"type"`
	URL  string   `json:"url,omitempty"`
	Path string   `json:"path,omitempty"`
	Args []string `json:"args,omitempty"`
	Keys []string `json:"keys,omitempty"`
	Key  string   `json:"key,omitempty"`
}

type CommandBody struct {
	Action Action `json:"action"`
}

func DecodeBody(raw json.RawMessage) (CommandBody, error) {
	var body CommandBody
	if err := json.Unmarshal(raw, &body); err != nil {
		return body, err
	}
	return body, Validate(body.Action)
}

func Validate(a Action) error {
	switch a.Type {
	case "open_url":
		u, err := url.Parse(a.URL)
		if err != nil || u.Scheme == "" {
			return errors.New("invalid URL")
		}
		switch strings.ToLower(u.Scheme) {
		case "http", "https", "mailto", "obsidian":
		default:
			return errors.New("URL scheme not allowed")
		}
	case "launch_app":
		if strings.TrimSpace(a.Path) == "" {
			return errors.New("application path required")
		}
		if runtime.GOOS == "windows" && !strings.HasSuffix(strings.ToLower(a.Path), ".exe") {
			return errors.New("application must be an .exe on Windows")
		}
		if len(a.Args) > 32 {
			return errors.New("too many application arguments")
		}
	case "hotkey":
		if len(a.Keys) < 1 || len(a.Keys) > 5 {
			return errors.New("hotkey must have 1-5 keys")
		}
		for _, key := range a.Keys {
			if len(key) < 1 || len(key) > 16 {
				return errors.New("invalid hotkey key")
			}
		}
	case "media":
		switch a.Key {
		case "play_pause", "next", "previous", "volume_up", "volume_down", "volume_mute":
		default:
			return errors.New("unsupported media key")
		}
	default:
		return fmt.Errorf("unsupported action type %q", a.Type)
	}
	return nil
}

func Execute(a Action) error {
	if err := Validate(a); err != nil {
		return err
	}
	switch a.Type {
	case "open_url":
		return openURL(a.URL)
	case "launch_app":
		return exec.Command(a.Path, a.Args...).Start()
	case "hotkey":
		return sendHotkey(a.Keys)
	case "media":
		return sendMediaKey(a.Key)
	default:
		return errors.New("unsupported action")
	}
}
