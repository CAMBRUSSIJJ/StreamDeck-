//go:build !windows

package tray

func start(string, string, func()) error { return nil }
