package actions

import "testing"

func TestRejectsShell(t *testing.T) {
	if err := Validate(Action{Type: "shell"}); err == nil {
		t.Fatal("shell action should be rejected")
	}
}

func TestValidMedia(t *testing.T) {
	if err := Validate(Action{Type: "media", Key: "play_pause"}); err != nil {
		t.Fatal(err)
	}
}

func TestRejectsUnsafeURLScheme(t *testing.T) {
	if err := Validate(Action{Type: "open_url", URL: "file:///C:/secret"}); err == nil {
		t.Fatal("file scheme should be rejected")
	}
}
