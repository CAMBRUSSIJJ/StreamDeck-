//go:build windows

package foreground

import (
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	kernel32                   = syscall.NewLazyDLL("kernel32.dll")
	getForegroundWindow        = user32.NewProc("GetForegroundWindow")
	getWindowThreadProcessID   = user32.NewProc("GetWindowThreadProcessId")
	getWindowTextLengthW       = user32.NewProc("GetWindowTextLengthW")
	getWindowTextW             = user32.NewProc("GetWindowTextW")
	openProcess                = kernel32.NewProc("OpenProcess")
	queryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
	closeHandle                = kernel32.NewProc("CloseHandle")
)

const processQueryLimitedInformation = 0x1000

func Current() (Info, bool) {
	hwnd, _, _ := getForegroundWindow.Call()
	if hwnd == 0 {
		return Info{}, false
	}
	var pid uint32
	getWindowThreadProcessID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == 0 {
		return Info{}, false
	}

	info := Info{PID: pid, WindowTitle: windowTitle(hwnd)}
	handle, _, _ := openProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if handle == 0 {
		return info, info.WindowTitle != ""
	}
	defer closeHandle.Call(handle)

	buffer := make([]uint16, 32768)
	size := uint32(len(buffer))
	result, _, _ := queryFullProcessImageNameW.Call(handle, 0, uintptr(unsafe.Pointer(&buffer[0])), uintptr(unsafe.Pointer(&size)))
	if result == 0 || size == 0 {
		return info, info.WindowTitle != ""
	}
	info.ProcessPath = syscall.UTF16ToString(buffer[:size])
	info.ProcessName = filepath.Base(info.ProcessPath)
	return info, info.ProcessName != ""
}

func windowTitle(hwnd uintptr) string {
	length, _, _ := getWindowTextLengthW.Call(hwnd)
	if length == 0 {
		return ""
	}
	buffer := make([]uint16, int(length)+1)
	written, _, _ := getWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buffer[0])), uintptr(len(buffer)))
	if written == 0 {
		return ""
	}
	return syscall.UTF16ToString(buffer[:written])
}
