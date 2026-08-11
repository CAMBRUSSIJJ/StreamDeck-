//go:build windows

package systemstate

import (
	"fmt"
	"math"
	"syscall"
	"unsafe"
)

type guid struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

var (
	ole32            = syscall.NewLazyDLL("ole32.dll")
	coInitializeEx   = ole32.NewProc("CoInitializeEx")
	coUninitialize   = ole32.NewProc("CoUninitialize")
	coCreateInstance = ole32.NewProc("CoCreateInstance")

	clsidMMDeviceEnumerator = guid{0xBCDE0395, 0xE52F, 0x467C, [8]byte{0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E}}
	iidIMMDeviceEnumerator  = guid{0xA95664D2, 0x9614, 0x4F35, [8]byte{0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6}}
	iidIAudioEndpointVolume = guid{0x5CDF2C82, 0x841E, 0x4546, [8]byte{0x97, 0x22, 0x0C, 0xF7, 0x40, 0x78, 0x22, 0x9A}}
)

const (
	coinitApartmentThreaded = 0x2
	clsctxAll               = 23
	eRender                 = 0
	eMultimedia             = 1
	rpcEChangedMode         = 0x80010106
)

type immDeviceEnumerator struct{ lpVtbl *immDeviceEnumeratorVtbl }
type immDeviceEnumeratorVtbl struct {
	QueryInterface                         uintptr
	AddRef                                 uintptr
	Release                                uintptr
	EnumAudioEndpoints                     uintptr
	GetDefaultAudioEndpoint                uintptr
	GetDevice                              uintptr
	RegisterEndpointNotificationCallback   uintptr
	UnregisterEndpointNotificationCallback uintptr
}
type immDevice struct{ lpVtbl *immDeviceVtbl }
type immDeviceVtbl struct {
	QueryInterface    uintptr
	AddRef            uintptr
	Release           uintptr
	Activate          uintptr
	OpenPropertyStore uintptr
	GetId             uintptr
	GetState          uintptr
}
type iAudioEndpointVolume struct{ lpVtbl *iAudioEndpointVolumeVtbl }
type iAudioEndpointVolumeVtbl struct {
	QueryInterface                uintptr
	AddRef                        uintptr
	Release                       uintptr
	RegisterControlChangeNotify   uintptr
	UnregisterControlChangeNotify uintptr
	GetChannelCount               uintptr
	SetMasterVolumeLevel          uintptr
	SetMasterVolumeLevelScalar    uintptr
	GetMasterVolumeLevel          uintptr
	GetMasterVolumeLevelScalar    uintptr
	SetChannelVolumeLevel         uintptr
	SetChannelVolumeLevelScalar   uintptr
	GetChannelVolumeLevel         uintptr
	GetChannelVolumeLevelScalar   uintptr
	SetMute                       uintptr
	GetMute                       uintptr
	GetVolumeStepInfo             uintptr
	VolumeStepUp                  uintptr
	VolumeStepDown                uintptr
	QueryHardwareSupport          uintptr
	GetVolumeRange                uintptr
}

func failed(hr uintptr) bool { return int32(hr) < 0 }

func release(ptr unsafe.Pointer, proc uintptr) {
	if ptr != nil && proc != 0 {
		syscall.SyscallN(proc, uintptr(ptr))
	}
}

func openEndpoint() (*iAudioEndpointVolume, func(), error) {
	hr, _, _ := coInitializeEx.Call(0, coinitApartmentThreaded)
	shouldUninit := !failed(hr)
	if uint32(hr) == rpcEChangedMode {
		shouldUninit = false
	} else if failed(hr) {
		return nil, func() {}, fmt.Errorf("CoInitializeEx: 0x%x", uint32(hr))
	}

	var enumerator *immDeviceEnumerator
	hr, _, _ = coCreateInstance.Call(
		uintptr(unsafe.Pointer(&clsidMMDeviceEnumerator)), 0, clsctxAll,
		uintptr(unsafe.Pointer(&iidIMMDeviceEnumerator)),
		uintptr(unsafe.Pointer(&enumerator)),
	)
	if failed(hr) || enumerator == nil {
		if shouldUninit {
			coUninitialize.Call()
		}
		return nil, func() {}, fmt.Errorf("MMDeviceEnumerator: 0x%x", uint32(hr))
	}

	var device *immDevice
	hr, _, _ = syscall.SyscallN(
		enumerator.lpVtbl.GetDefaultAudioEndpoint,
		uintptr(unsafe.Pointer(enumerator)), eRender, eMultimedia,
		uintptr(unsafe.Pointer(&device)),
	)
	if failed(hr) || device == nil {
		release(unsafe.Pointer(enumerator), enumerator.lpVtbl.Release)
		if shouldUninit {
			coUninitialize.Call()
		}
		return nil, func() {}, fmt.Errorf("GetDefaultAudioEndpoint: 0x%x", uint32(hr))
	}

	var endpoint *iAudioEndpointVolume
	hr, _, _ = syscall.SyscallN(
		device.lpVtbl.Activate,
		uintptr(unsafe.Pointer(device)),
		uintptr(unsafe.Pointer(&iidIAudioEndpointVolume)),
		clsctxAll, 0, uintptr(unsafe.Pointer(&endpoint)),
	)
	if failed(hr) || endpoint == nil {
		release(unsafe.Pointer(device), device.lpVtbl.Release)
		release(unsafe.Pointer(enumerator), enumerator.lpVtbl.Release)
		if shouldUninit {
			coUninitialize.Call()
		}
		return nil, func() {}, fmt.Errorf("IAudioEndpointVolume: 0x%x", uint32(hr))
	}
	cleanup := func() {
		release(unsafe.Pointer(endpoint), endpoint.lpVtbl.Release)
		release(unsafe.Pointer(device), device.lpVtbl.Release)
		release(unsafe.Pointer(enumerator), enumerator.lpVtbl.Release)
		if shouldUninit {
			coUninitialize.Call()
		}
	}
	return endpoint, cleanup, nil
}

func ReadAudio() AudioState {
	endpoint, cleanup, err := openEndpoint()
	if err != nil {
		return AudioState{Available: false}
	}
	defer cleanup()

	var scalar float32
	hr, _, _ := syscall.SyscallN(
		endpoint.lpVtbl.GetMasterVolumeLevelScalar,
		uintptr(unsafe.Pointer(endpoint)),
		uintptr(unsafe.Pointer(&scalar)),
	)
	if failed(hr) {
		return AudioState{Available: false}
	}
	var muted int32
	hr, _, _ = syscall.SyscallN(
		endpoint.lpVtbl.GetMute,
		uintptr(unsafe.Pointer(endpoint)),
		uintptr(unsafe.Pointer(&muted)),
	)
	if failed(hr) {
		muted = 0
	}
	percent := int(math.Round(float64(scalar * 100)))
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	return AudioState{Available: true, VolumePercent: percent, Muted: muted != 0}
}

// SetAudioVolume uses IAudioEndpointVolume's discrete step API. This avoids
// shell commands and keeps volume control inside the Windows Core Audio API.
func SetAudioVolume(percent int) error {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	endpoint, cleanup, err := openEndpoint()
	if err != nil {
		return err
	}
	defer cleanup()

	var current uint32
	var count uint32
	hr, _, _ := syscall.SyscallN(
		endpoint.lpVtbl.GetVolumeStepInfo,
		uintptr(unsafe.Pointer(endpoint)),
		uintptr(unsafe.Pointer(&current)),
		uintptr(unsafe.Pointer(&count)),
	)
	if failed(hr) || count < 2 {
		return fmt.Errorf("GetVolumeStepInfo: 0x%x", uint32(hr))
	}
	target := uint32(math.Round((float64(percent) / 100) * float64(count-1)))
	const maxSteps = 128
	steps := 0
	for current < target && steps < maxSteps {
		hr, _, _ = syscall.SyscallN(endpoint.lpVtbl.VolumeStepUp, uintptr(unsafe.Pointer(endpoint)), 0)
		if failed(hr) {
			return fmt.Errorf("VolumeStepUp: 0x%x", uint32(hr))
		}
		current++
		steps++
	}
	for current > target && steps < maxSteps {
		hr, _, _ = syscall.SyscallN(endpoint.lpVtbl.VolumeStepDown, uintptr(unsafe.Pointer(endpoint)), 0)
		if failed(hr) {
			return fmt.Errorf("VolumeStepDown: 0x%x", uint32(hr))
		}
		current--
		steps++
	}
	return nil
}
