//go:build !windows

package actions

import (
	"errors"
	"os/exec"
)

func openURL(raw string) error       { return exec.Command("xdg-open", raw).Start() }
func sendHotkey(keys []string) error { return errors.New("hotkeys are only implemented on Windows") }
func sendMediaKey(key string) error {
	return errors.New("media controls are only implemented on Windows")
}

func runSystemAction(key string) error {
	return errors.New("system actions are only implemented on Windows")
}
