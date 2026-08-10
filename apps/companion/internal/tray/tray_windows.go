//go:build windows

package tray

import (
	"os/exec"
	"syscall"
	"unsafe"
)

const (
	wmDestroy       = 0x0002
	wmCommand       = 0x0111
	wmLButtonDblClk = 0x0203
	wmRButtonUp     = 0x0205
	wmApp           = 0x8000
	trayMessage     = wmApp + 1

	nimAdd     = 0x00000000
	nimDelete  = 0x00000002
	nifMessage = 0x00000001
	nifIcon    = 0x00000002
	nifTip     = 0x00000004

	mfString       = 0x00000000
	mfSeparator    = 0x00000800
	tpmRightButton = 0x0002
	tpmReturnCmd   = 0x0100

	idiApplication = 32512

	idOpenAdmin = 1001
	idOpenDeck  = 1002
	idExit      = 1003
)

type point struct{ X, Y int32 }
type msg struct {
	Hwnd           uintptr
	Message        uint32
	WParam, LParam uintptr
	Time           uint32
	Pt             point
}
type wndClassEx struct {
	Size       uint32
	Style      uint32
	WndProc    uintptr
	ClsExtra   int32
	WndExtra   int32
	Instance   uintptr
	Icon       uintptr
	Cursor     uintptr
	Background uintptr
	MenuName   *uint16
	ClassName  *uint16
	IconSm     uintptr
}
type notifyIconData struct {
	Size             uint32
	HWnd             uintptr
	UID              uint32
	Flags            uint32
	CallbackMessage  uint32
	Icon             uintptr
	Tip              [128]uint16
	State            uint32
	StateMask        uint32
	Info             [256]uint16
	TimeoutOrVersion uint32
	InfoTitle        [64]uint16
	InfoFlags        uint32
	GUIDItem         [16]byte
	BalloonIcon      uintptr
}

var (
	user32                  = syscall.NewLazyDLL("user32.dll")
	shell32                 = syscall.NewLazyDLL("shell32.dll")
	kernel32                = syscall.NewLazyDLL("kernel32.dll")
	procRegisterClassExW    = user32.NewProc("RegisterClassExW")
	procCreateWindowExW     = user32.NewProc("CreateWindowExW")
	procDefWindowProcW      = user32.NewProc("DefWindowProcW")
	procGetMessageW         = user32.NewProc("GetMessageW")
	procTranslateMessage    = user32.NewProc("TranslateMessage")
	procDispatchMessageW    = user32.NewProc("DispatchMessageW")
	procDestroyWindow       = user32.NewProc("DestroyWindow")
	procPostQuitMessage     = user32.NewProc("PostQuitMessage")
	procLoadIconW           = user32.NewProc("LoadIconW")
	procCreatePopupMenu     = user32.NewProc("CreatePopupMenu")
	procAppendMenuW         = user32.NewProc("AppendMenuW")
	procTrackPopupMenu      = user32.NewProc("TrackPopupMenu")
	procDestroyMenu         = user32.NewProc("DestroyMenu")
	procGetCursorPos        = user32.NewProc("GetCursorPos")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procShellNotifyIconW    = shell32.NewProc("Shell_NotifyIconW")
	procGetModuleHandleW    = kernel32.NewProc("GetModuleHandleW")
)

var adminTarget, deckTarget string
var exitCallback func()
var trayData notifyIconData

func utf16Ptr(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

func openURL(value string) {
	_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", value).Start()
}

func wndProc(hwnd uintptr, message uint32, wParam, lParam uintptr) uintptr {
	switch message {
	case trayMessage:
		switch uint32(lParam) {
		case wmLButtonDblClk:
			openURL(adminTarget)
			return 0
		case wmRButtonUp:
			menu, _, _ := procCreatePopupMenu.Call()
			if menu == 0 {
				return 0
			}
			defer procDestroyMenu.Call(menu)
			procAppendMenuW.Call(menu, mfString, idOpenAdmin, uintptr(unsafe.Pointer(utf16Ptr("Abrir painel"))))
			procAppendMenuW.Call(menu, mfString, idOpenDeck, uintptr(unsafe.Pointer(utf16Ptr("Abrir Nexus Deck"))))
			procAppendMenuW.Call(menu, mfSeparator, 0, 0)
			procAppendMenuW.Call(menu, mfString, idExit, uintptr(unsafe.Pointer(utf16Ptr("Sair"))))
			var pt point
			procGetCursorPos.Call(uintptr(unsafe.Pointer(&pt)))
			procSetForegroundWindow.Call(hwnd)
			cmd, _, _ := procTrackPopupMenu.Call(menu, tpmRightButton|tpmReturnCmd, uintptr(pt.X), uintptr(pt.Y), 0, hwnd, 0)
			switch cmd {
			case idOpenAdmin:
				openURL(adminTarget)
			case idOpenDeck:
				openURL(deckTarget)
			case idExit:
				if exitCallback != nil {
					exitCallback()
				}
				procDestroyWindow.Call(hwnd)
			}
			return 0
		}
	case wmCommand:
		return 0
	case wmDestroy:
		procShellNotifyIconW.Call(nimDelete, uintptr(unsafe.Pointer(&trayData)))
		procPostQuitMessage.Call(0)
		return 0
	}
	ret, _, _ := procDefWindowProcW.Call(hwnd, uintptr(message), wParam, lParam)
	return ret
}

func start(adminURL, deckURL string, onExit func()) error {
	adminTarget, deckTarget, exitCallback = adminURL, deckURL, onExit
	go func() {
		instance, _, _ := procGetModuleHandleW.Call(0)
		className := utf16Ptr("NexusDeckTrayWindow")
		callback := syscall.NewCallback(wndProc)
		wc := wndClassEx{Size: uint32(unsafe.Sizeof(wndClassEx{})), WndProc: callback, Instance: instance, ClassName: className}
		procRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))
		hwnd, _, _ := procCreateWindowExW.Call(0, uintptr(unsafe.Pointer(className)), uintptr(unsafe.Pointer(utf16Ptr("Nexus Deck"))), 0, 0, 0, 0, 0, 0, 0, instance, 0)
		if hwnd == 0 {
			return
		}
		icon, _, _ := procLoadIconW.Call(0, idiApplication)
		trayData = notifyIconData{Size: uint32(unsafe.Sizeof(notifyIconData{})), HWnd: hwnd, UID: 1, Flags: nifMessage | nifIcon | nifTip, CallbackMessage: trayMessage, Icon: icon}
		tip, _ := syscall.UTF16FromString("Nexus Deck Companion")
		copy(trayData.Tip[:], tip)
		procShellNotifyIconW.Call(nimAdd, uintptr(unsafe.Pointer(&trayData)))
		var m msg
		for {
			result, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&m)), 0, 0, 0)
			if int32(result) <= 0 {
				break
			}
			procTranslateMessage.Call(uintptr(unsafe.Pointer(&m)))
			procDispatchMessageW.Call(uintptr(unsafe.Pointer(&m)))
		}
	}()
	return nil
}
