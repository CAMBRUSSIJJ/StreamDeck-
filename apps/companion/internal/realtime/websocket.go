package realtime

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"crypto/sha1"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type wsConn struct {
	conn net.Conn
	r    *bufio.Reader
	mu   sync.Mutex
}

func dialWebSocket(rawURL string, timeout time.Duration) (*wsConn, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	host := u.Host
	port := "443"
	if u.Scheme == "ws" {
		port = "80"
	}
	if _, _, err := net.SplitHostPort(host); err != nil {
		host = net.JoinHostPort(host, port)
	}
	dialer := net.Dialer{Timeout: timeout}
	var conn net.Conn
	if u.Scheme == "wss" {
		conn, err = tls.DialWithDialer(&dialer, "tcp", host, &tls.Config{ServerName: u.Hostname(), MinVersion: tls.VersionTLS12})
	} else {
		conn, err = dialer.Dial("tcp", host)
	}
	if err != nil {
		return nil, err
	}
	fail := func(e error) (*wsConn, error) { conn.Close(); return nil, e }
	keyBytes := make([]byte, 16)
	if _, err := rand.Read(keyBytes); err != nil {
		return fail(err)
	}
	key := base64.StdEncoding.EncodeToString(keyBytes)
	path := u.RequestURI()
	if path == "" {
		path = "/"
	}
	req := &http.Request{
		Method: "GET", URL: &url.URL{Path: u.Path, RawQuery: u.RawQuery}, Host: u.Host,
		Header: make(http.Header),
	}
	req.Header.Set("Upgrade", "websocket")
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Sec-WebSocket-Key", key)
	req.Header.Set("Sec-WebSocket-Version", "13")
	req.Header.Set("User-Agent", "NexusDeck-Companion/1.5.0")
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "GET %s HTTP/1.1\r\nHost: %s\r\n", path, u.Host)
	for k, values := range req.Header {
		for _, v := range values {
			fmt.Fprintf(&buf, "%s: %s\r\n", k, v)
		}
	}
	buf.WriteString("\r\n")
	if _, err := conn.Write(buf.Bytes()); err != nil {
		return fail(err)
	}
	r := bufio.NewReader(conn)
	resp, err := http.ReadResponse(r, req)
	if err != nil {
		return fail(err)
	}
	if resp.StatusCode != http.StatusSwitchingProtocols {
		return fail(fmt.Errorf("websocket handshake status %s", resp.Status))
	}
	if !strings.EqualFold(resp.Header.Get("Upgrade"), "websocket") {
		return fail(errors.New("missing websocket upgrade header"))
	}
	acceptSrc := key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
	h := sha1.Sum([]byte(acceptSrc))
	expected := base64.StdEncoding.EncodeToString(h[:])
	if resp.Header.Get("Sec-WebSocket-Accept") != expected {
		return fail(errors.New("invalid websocket accept"))
	}
	return &wsConn{conn: conn, r: r}, nil
}

func (w *wsConn) Close() error { return w.conn.Close() }

func (w *wsConn) WriteText(payload []byte) error { return w.writeFrame(0x1, payload) }
func (w *wsConn) WritePong(payload []byte) error { return w.writeFrame(0xA, payload) }

func (w *wsConn) writeFrame(opcode byte, payload []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	var header bytes.Buffer
	header.WriteByte(0x80 | opcode)
	length := len(payload)
	switch {
	case length < 126:
		header.WriteByte(0x80 | byte(length))
	case length <= 65535:
		header.WriteByte(0x80 | 126)
		_ = binary.Write(&header, binary.BigEndian, uint16(length))
	default:
		header.WriteByte(0x80 | 127)
		_ = binary.Write(&header, binary.BigEndian, uint64(length))
	}
	mask := make([]byte, 4)
	if _, err := rand.Read(mask); err != nil {
		return err
	}
	header.Write(mask)
	masked := make([]byte, length)
	for i := range payload {
		masked[i] = payload[i] ^ mask[i%4]
	}
	if err := w.conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
		return err
	}
	if _, err := w.conn.Write(header.Bytes()); err != nil {
		return err
	}
	_, err := w.conn.Write(masked)
	return err
}

func (w *wsConn) ReadText() ([]byte, error) {
	for {
		if err := w.conn.SetReadDeadline(time.Now().Add(45 * time.Second)); err != nil {
			return nil, err
		}
		b1, err := w.r.ReadByte()
		if err != nil {
			return nil, err
		}
		b2, err := w.r.ReadByte()
		if err != nil {
			return nil, err
		}
		fin := b1&0x80 != 0
		opcode := b1 & 0x0F
		masked := b2&0x80 != 0
		length := uint64(b2 & 0x7F)
		if length == 126 {
			var n uint16
			if err := binary.Read(w.r, binary.BigEndian, &n); err != nil {
				return nil, err
			}
			length = uint64(n)
		}
		if length == 127 {
			if err := binary.Read(w.r, binary.BigEndian, &length); err != nil {
				return nil, err
			}
		}
		if length > 8*1024*1024 {
			return nil, errors.New("websocket frame too large")
		}
		var mask []byte
		if masked {
			mask = make([]byte, 4)
			if _, err := io.ReadFull(w.r, mask); err != nil {
				return nil, err
			}
		}
		payload := make([]byte, int(length))
		if _, err := io.ReadFull(w.r, payload); err != nil {
			return nil, err
		}
		if masked {
			for i := range payload {
				payload[i] ^= mask[i%4]
			}
		}
		if !fin {
			return nil, errors.New("fragmented frames not supported")
		}
		switch opcode {
		case 0x1:
			return payload, nil
		case 0x8:
			return nil, io.EOF
		case 0x9:
			if err := w.WritePong(payload); err != nil {
				return nil, err
			}
		case 0xA:
			continue
		default:
			continue
		}
	}
}
