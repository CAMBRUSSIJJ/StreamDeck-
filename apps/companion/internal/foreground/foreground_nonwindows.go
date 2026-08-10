//go:build !windows

package foreground

func Current() (Info, bool) { return Info{}, false }
