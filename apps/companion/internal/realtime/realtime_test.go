package realtime

import "testing"

func TestRelayURLForWebApp(t *testing.T) {
	got, err := RelayURLForWebApp("https://nexus.example/")
	if err != nil {
		t.Fatal(err)
	}
	if got != "wss://nexus.example/api/relay" {
		t.Fatalf("got %q", got)
	}
}

func TestRelayEndpoint(t *testing.T) {
	got, err := relayEndpoint("wss://nexus.example/api/relay", "nexus-device-Abc_1234")
	if err != nil {
		t.Fatal(err)
	}
	if got != "wss://nexus.example/api/relay?role=bridge&room=nexus-device-Abc_1234" && got != "wss://nexus.example/api/relay?room=nexus-device-Abc_1234&role=bridge" {
		t.Fatalf("unexpected endpoint %q", got)
	}
}

func TestRelayRejectsNonWebSocketURL(t *testing.T) {
	if _, err := relayEndpoint("https://nexus.example/api/relay", "nexus-device-Abc_1234"); err == nil {
		t.Fatal("expected ws/wss validation error")
	}
}
