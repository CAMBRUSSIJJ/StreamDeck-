package realtime

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestWebSocketHandshakeAndFrames(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()

	serverErr := make(chan error, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			serverErr <- err
			return
		}
		defer conn.Close()
		r := bufio.NewReader(conn)
		req, err := http.ReadRequest(r)
		if err != nil {
			serverErr <- err
			return
		}
		key := req.Header.Get("Sec-WebSocket-Key")
		h := sha1.Sum([]byte(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
		accept := base64.StdEncoding.EncodeToString(h[:])
		fmt.Fprintf(conn, "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", accept)
		// Read one small masked text frame from the client.
		b1, _ := r.ReadByte()
		b2, _ := r.ReadByte()
		if b1&0x0F != 1 || b2&0x80 == 0 {
			serverErr <- fmt.Errorf("unexpected client frame")
			return
		}
		length := int(b2 & 0x7F)
		mask := make([]byte, 4)
		if _, err := r.Read(mask); err != nil {
			serverErr <- err
			return
		}
		payload := make([]byte, length)
		if _, err := r.Read(payload); err != nil {
			serverErr <- err
			return
		}
		for i := range payload {
			payload[i] ^= mask[i%4]
		}
		if string(payload) != "hello" {
			serverErr <- fmt.Errorf("got payload %q", payload)
			return
		}
		// Send an unmasked text frame back.
		_, err = conn.Write([]byte{0x81, 0x05, 'w', 'o', 'r', 'l', 'd'})
		serverErr <- err
	}()

	ws, err := dialWebSocket("ws://"+ln.Addr().String()+"/socket", 2*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	if err := ws.WriteText([]byte("hello")); err != nil {
		t.Fatal(err)
	}
	got, err := ws.ReadText()
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "world" {
		t.Fatalf("got %q", got)
	}
	if err := <-serverErr; err != nil {
		t.Fatal(err)
	}
}
