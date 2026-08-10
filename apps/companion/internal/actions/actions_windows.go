//go:build windows

package actions

import (
	"fmt"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	keybdEvent      = user32.NewProc("keybd_event")
	lockWorkStation = user32.NewProc("LockWorkStation")
)

const keyeventfKeyup = 0x0002

var vkMap = map[string]byte{
	"CTRL": 0x11, "CONTROL": 0x11, "SHIFT": 0x10, "ALT": 0x12, "WIN": 0x5B,
	"ENTER": 0x0D, "RETURN": 0x0D, "ESC": 0x1B, "ESCAPE": 0x1B, "TAB": 0x09, "SPACE": 0x20,
	"UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27,
	"F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74, "F6": 0x75, "F7": 0x76, "F8": 0x77,
	"F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B,
}

func openURL(raw string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", raw).Start()
}

func vkFor(key string) (byte, error) {
	k := strings.ToUpper(strings.TrimSpace(key))
	if v, ok := vkMap[k]; ok {
		return v, nil
	}
	if len(k) == 1 {
		c := k[0]
		if (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			return c, nil
		}
	}
	return 0, fmt.Errorf("unsupported key %q", key)
}

func tapVK(vk byte) {
	keybdEvent.Call(uintptr(vk), 0, 0, 0)
	keybdEvent.Call(uintptr(vk), 0, keyeventfKeyup, 0)
}

func sendHotkey(keys []string) error {
	vks := make([]byte, 0, len(keys))
	for _, key := range keys {
		vk, err := vkFor(key)
		if err != nil {
			return err
		}
		vks = append(vks, vk)
	}
	for _, vk := range vks {
		keybdEvent.Call(uintptr(vk), 0, 0, 0)
		time.Sleep(8 * time.Millisecond)
	}
	for i := len(vks) - 1; i >= 0; i-- {
		keybdEvent.Call(uintptr(vks[i]), 0, keyeventfKeyup, 0)
		time.Sleep(8 * time.Millisecond)
	}
	return nil
}

func sendMediaKey(key string) error {
	var vk byte
	switch key {
	case "play_pause":
		vk = 0xB3
	case "next":
		vk = 0xB0
	case "previous":
		vk = 0xB1
	case "volume_up":
		vk = 0xAF
	case "volume_down":
		vk = 0xAE
	case "volume_mute":
		vk = 0xAD
	default:
		return fmt.Errorf("unsupported media key %q", key)
	}
	tapVK(vk)
	return nil
}

func runSystemAction(key string) error {
	switch key {
	case "lock":
		result, _, callErr := lockWorkStation.Call()
		if result == 0 {
			return fmt.Errorf("LockWorkStation failed: %v", callErr)
		}
		return nil
	default:
		return fmt.Errorf("unsupported system action %q", key)
	}
}
