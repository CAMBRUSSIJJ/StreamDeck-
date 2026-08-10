//go:build !windows

package startup

func enabled() bool         { return false }
func setEnabled(bool) error { return nil }
