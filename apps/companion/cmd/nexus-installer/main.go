//go:build windows

package main

import (
	"embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

//go:embed payload/*
var payloadFS embed.FS

const version = "1.4.0"
const product = "Nexus Deck"
const runKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
const uninstallKey = `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\NexusDeck`

const (
	mbOK           = 0x00000000
	mbYesNo        = 0x00000004
	mbIconInfo     = 0x00000040
	mbIconQuestion = 0x00000020
	mbIconError    = 0x00000010
	idYes          = 6
)

var user32 = syscall.NewLazyDLL("user32.dll")
var messageBoxW = user32.NewProc("MessageBoxW")

func main() {
	if hasArg("/uninstall") || hasArg("--uninstall") {
		uninstall()
		return
	}
	install()
}

func install() {
	if messageBox("Instalar o Nexus Deck V1.4 neste computador?\n\nO Companion será instalado para o usuário atual e iniciará automaticamente com o Windows.", "Nexus Deck Setup", mbYesNo|mbIconQuestion) != idYes {
		return
	}

	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		fatal("Não foi possível localizar LOCALAPPDATA.")
	}
	installDir := filepath.Join(localAppData, "Programs", "NexusDeck")
	companionPath := filepath.Join(installDir, "NexusDeck-Companion.exe")
	setupPath := filepath.Join(installDir, "NexusDeck-Setup.exe")

	_ = exec.Command("taskkill.exe", "/IM", "NexusDeck-Companion.exe", "/F").Run()
	time.Sleep(250 * time.Millisecond)

	if err := os.MkdirAll(installDir, 0o755); err != nil {
		fatal(err.Error())
	}
	payload, err := payloadFS.ReadFile("payload/NexusDeck-Companion.exe")
	if err != nil {
		fatal("Payload do Companion ausente: " + err.Error())
	}
	if err := writeAtomic(companionPath, payload, 0o755); err != nil {
		fatal("Falha ao instalar Companion: " + err.Error())
	}

	current, err := os.Executable()
	if err == nil && !samePath(current, setupPath) {
		data, readErr := os.ReadFile(current)
		if readErr == nil {
			_ = writeAtomic(setupPath, data, 0o755)
		}
	}

	startupCommand := fmt.Sprintf(`"%s" --background`, companionPath)
	if err := regAdd(runKey, "NexusDeckCompanion", "REG_SZ", startupCommand); err != nil {
		fatal("Falha ao configurar inicialização automática: " + err.Error())
	}

	_ = regAdd(uninstallKey, "DisplayName", "REG_SZ", "Nexus Deck")
	_ = regAdd(uninstallKey, "DisplayVersion", "REG_SZ", version)
	_ = regAdd(uninstallKey, "Publisher", "REG_SZ", "Nexus Deck")
	_ = regAdd(uninstallKey, "InstallLocation", "REG_SZ", installDir)
	_ = regAdd(uninstallKey, "DisplayIcon", "REG_SZ", companionPath)
	_ = regAdd(uninstallKey, "UninstallString", "REG_SZ", fmt.Sprintf(`"%s" /uninstall`, setupPath))
	_ = regAdd(uninstallKey, "NoModify", "REG_DWORD", "1")
	_ = regAdd(uninstallKey, "NoRepair", "REG_DWORD", "1")

	_ = createStartMenuShortcut(companionPath)
	_ = os.WriteFile(filepath.Join(installDir, "VERSION"), []byte(version+"\r\n"), 0o644)

	_ = exec.Command(companionPath).Start()
	messageBox("Nexus Deck foi instalado com sucesso.\n\nO painel do Companion será aberto agora. Depois disso, ele poderá permanecer na bandeja do Windows.", "Nexus Deck", mbOK|mbIconInfo)
}

func uninstall() {
	if messageBox("Remover o Nexus Deck deste computador?\n\nSeus layouts ficam no iPad. Você poderá escolher manter ou apagar as configurações locais do Companion.", "Desinstalar Nexus Deck", mbYesNo|mbIconQuestion) != idYes {
		return
	}
	_ = exec.Command("taskkill.exe", "/IM", "NexusDeck-Companion.exe", "/F").Run()
	_ = exec.Command("reg.exe", "delete", runKey, "/v", "NexusDeckCompanion", "/f").Run()
	_ = exec.Command("reg.exe", "delete", uninstallKey, "/f").Run()
	_ = removeStartMenuShortcut()

	keep := messageBox("Deseja MANTER as configurações do Companion e os iPads autorizados para uma futura reinstalação?\n\nSim = manter\nNão = apagar também as configurações", "Dados do Nexus Deck", mbYesNo|mbIconQuestion) == idYes
	if !keep {
		if configDir, err := os.UserConfigDir(); err == nil {
			_ = os.RemoveAll(filepath.Join(configDir, "NexusDeck"))
		}
	}

	exe, _ := os.Executable()
	installDir := filepath.Dir(exe)
	companionPath := filepath.Join(installDir, "NexusDeck-Companion.exe")
	_ = os.Remove(companionPath)
	_ = os.Remove(filepath.Join(installDir, "VERSION"))

	messageBox("Nexus Deck foi removido.", "Nexus Deck", mbOK|mbIconInfo)
	// The setup executable cannot delete itself while running. Remove the folder after exit.
	_ = exec.Command("cmd.exe", "/C", fmt.Sprintf(`ping 127.0.0.1 -n 2 >nul & rmdir /s /q "%s"`, strings.ReplaceAll(installDir, `"`, ``))).Start()
}

func createStartMenuShortcut(target string) error {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return fmt.Errorf("APPDATA indisponível")
	}
	dir := filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Nexus Deck")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	link := filepath.Join(dir, "Nexus Deck.lnk")
	script := fmt.Sprintf(`$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut('%s');$s.TargetPath='%s';$s.WorkingDirectory='%s';$s.Description='Nexus Deck Companion';$s.Save()`, ps(targetString(link)), ps(targetString(target)), ps(targetString(filepath.Dir(target))))
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	if err := cmd.Run(); err == nil {
		return nil
	}
	// Fallback that still appears in the Start Menu if PowerShell is restricted.
	url := filepath.Join(dir, "Nexus Deck.url")
	content := fmt.Sprintf("[InternetShortcut]\r\nURL=file:///%s\r\nIconFile=%s\r\nIconIndex=0\r\n", strings.ReplaceAll(filepath.ToSlash(target), " ", "%20"), target)
	return os.WriteFile(url, []byte(content), 0o644)
}

func removeStartMenuShortcut() error {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		return nil
	}
	return os.RemoveAll(filepath.Join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Nexus Deck"))
}

func regAdd(key, name, typ, value string) error {
	return exec.Command("reg.exe", "add", key, "/v", name, "/t", typ, "/d", value, "/f").Run()
}

func writeAtomic(path string, data []byte, mode os.FileMode) error {
	tmp := path + ".new"
	if err := os.WriteFile(tmp, data, mode); err != nil {
		return err
	}
	_ = os.Remove(path)
	return os.Rename(tmp, path)
}

func fatal(message string) { messageBox(message, "Nexus Deck Setup", mbOK|mbIconError); os.Exit(1) }
func messageBox(text, title string, flags uintptr) int {
	t, _ := syscall.UTF16PtrFromString(text)
	h, _ := syscall.UTF16PtrFromString(title)
	result, _, _ := messageBoxW.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(h)), flags)
	return int(result)
}
func hasArg(value string) bool {
	for _, arg := range os.Args[1:] {
		if strings.EqualFold(arg, value) {
			return true
		}
	}
	return false
}
func samePath(a, b string) bool {
	aa, _ := filepath.Abs(a)
	bb, _ := filepath.Abs(b)
	return strings.EqualFold(aa, bb)
}
func targetString(value string) string { return strings.ReplaceAll(value, "'", "''") }
func ps(value string) string           { return value }
