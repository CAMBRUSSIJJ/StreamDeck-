//go:build !windows

package integrations

import "errors"

func sendDesktopHotkey(keys []string) error {
	return errors.New("atalhos de integrações desktop exigem Windows")
}
func openDesktopURL(raw string) error { return errors.New("integração desktop exige Windows") }
