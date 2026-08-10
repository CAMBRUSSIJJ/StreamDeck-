//go:build windows

package startup

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

const runKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
const valueName = "NexusDeckCompanion"

func enabled() bool {
	cmd := exec.Command("reg.exe", "query", runKey, "/v", valueName)
	return cmd.Run() == nil
}

func setEnabled(value bool) error {
	if !value {
		cmd := exec.Command("reg.exe", "delete", runKey, "/v", valueName, "/f")
		if err := cmd.Run(); err != nil && enabled() {
			return err
		}
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	command := fmt.Sprintf(`"%s" --background`, strings.ReplaceAll(exe, `"`, ``))
	cmd := exec.Command("reg.exe", "add", runKey, "/v", valueName, "/t", "REG_SZ", "/d", command, "/f")
	return cmd.Run()
}
