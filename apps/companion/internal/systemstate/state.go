package systemstate

type AudioState struct {
	Available     bool `json:"available"`
	VolumePercent int  `json:"volumePercent,omitempty"`
	Muted         bool `json:"muted,omitempty"`
}

func Snapshot() map[string]any {
	audio := ReadAudio()
	return map[string]any{"audio": audio}
}
