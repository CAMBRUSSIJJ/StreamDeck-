//go:build windows

package integrations

import (
	"fmt"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

var desktopUser32 = syscall.NewLazyDLL("user32.dll")
var desktopKeybdEvent = desktopUser32.NewProc("keybd_event")

const desktopKeyUp = 0x0002

var desktopVK = map[string]byte{"CTRL": 0x11, "CONTROL": 0x11, "SHIFT": 0x10, "ALT": 0x12, "WIN": 0x5B, "ENTER": 0x0D, "ESC": 0x1B, "TAB": 0x09, "SPACE": 0x20, "UP": 0x26, "DOWN": 0x28, "LEFT": 0x25, "RIGHT": 0x27, "F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73, "F5": 0x74, "F6": 0x75, "F7": 0x76, "F8": 0x77, "F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B}

func desktopVKFor(key string) (byte, error) {
	k := strings.ToUpper(strings.TrimSpace(key))
	if v, ok := desktopVK[k]; ok {
		return v, nil
	}
	if len(k) == 1 {
		c := k[0]
		if (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') {
			return c, nil
		}
	}
	return 0, fmt.Errorf("tecla não suportada %q", key)
}
func sendDesktopHotkey(keys []string) error {
	if len(keys) < 1 || len(keys) > 5 {
		return fmt.Errorf("atalho inválido")
	}
	vks := make([]byte, 0, len(keys))
	for _, k := range keys {
		v, e := desktopVKFor(k)
		if e != nil {
			return e
		}
		vks = append(vks, v)
	}
	for _, v := range vks {
		desktopKeybdEvent.Call(uintptr(v), 0, 0, 0)
		time.Sleep(8 * time.Millisecond)
	}
	for i := len(vks) - 1; i >= 0; i-- {
		desktopKeybdEvent.Call(uintptr(vks[i]), 0, desktopKeyUp, 0)
		time.Sleep(8 * time.Millisecond)
	}
	return nil
}
func openDesktopURL(raw string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", raw).Start()
}
