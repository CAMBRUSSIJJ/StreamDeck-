package foreground

type Info struct {
	ProcessName string `json:"processName"`
	ProcessPath string `json:"processPath,omitempty"`
	WindowTitle string `json:"windowTitle,omitempty"`
	PID         uint32 `json:"pid,omitempty"`
}
