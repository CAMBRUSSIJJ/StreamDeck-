package realtime

import "testing"

func TestWebsocketEndpoint(t *testing.T) {
	got, err := websocketEndpoint(Config{URL: "https://abc.supabase.co", AnonKey: "key value"})
	if err != nil {
		t.Fatal(err)
	}
	want := "wss://abc.supabase.co/realtime/v1/websocket?apikey=key+value&vsn=2.0.0"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
