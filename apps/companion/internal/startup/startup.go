package startup

func Enabled() bool               { return enabled() }
func SetEnabled(value bool) error { return setEnabled(value) }
