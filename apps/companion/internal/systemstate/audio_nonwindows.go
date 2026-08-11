//go:build !windows

package systemstate

import "errors"

func ReadAudio() AudioState { return AudioState{Available: false} }
func SetAudioVolume(percent int) error {
	return errors.New("controle de volume disponível apenas no Windows")
}
