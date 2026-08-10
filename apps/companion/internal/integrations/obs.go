package integrations

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/textproto"
	"net/url"
	"strings"
	"time"

	"nexusdeck/companion/internal/store"
)

type OBSAdapter struct{ store *store.Store }

func NewOBSAdapter(s *store.Store) *OBSAdapter { return &OBSAdapter{store: s} }
func (a *OBSAdapter) ID() string               { return "obs" }
func (a *OBSAdapter) Name() string             { return "OBS Studio" }
func (a *OBSAdapter) Kind() string             { return "native-websocket" }
func (a *OBSAdapter) Commands() []Command {
	return []Command{
		{ID: "toggle_stream", Label: "Iniciar / parar transmissão"},
		{ID: "toggle_record", Label: "Iniciar / parar gravação"},
		{ID: "toggle_virtual_camera", Label: "Alternar câmera virtual"},
		{ID: "save_replay", Label: "Salvar Replay Buffer"},
		{ID: "set_scene", Label: "Trocar cena", Requires: "sceneName"},
		{ID: "toggle_input_mute", Label: "Alternar mute de fonte", Requires: "inputName"},
		{ID: "toggle_studio_mode", Label: "Alternar Studio Mode"},
	}
}

func (a *OBSAdapter) Status(ctx context.Context) Status {
	cfg := a.store.Snapshot().Integrations.OBS
	status := Status{Configured: strings.TrimSpace(cfg.URL) != "", Connected: false}
	if !status.Configured {
		status.Detail = "Configure o WebSocket do OBS"
		return status
	}
	client, err := dialOBS(ctx, cfg.URL, cfg.Password)
	if err != nil {
		status.Error = err.Error()
		status.Detail = "OBS indisponível"
		return status
	}
	defer client.Close()
	state := map[string]any{}
	if data, err := client.Request("GetCurrentProgramScene", nil); err == nil {
		state["sceneName"] = data["currentProgramSceneName"]
	}
	if data, err := client.Request("GetStreamStatus", nil); err == nil {
		state["streaming"] = data["outputActive"]
	}
	if data, err := client.Request("GetRecordStatus", nil); err == nil {
		state["recording"] = data["outputActive"]
	}
	status.Connected = true
	status.Detail = "Conectado ao obs-websocket 5.x"
	status.State = state
	return status
}

func (a *OBSAdapter) Execute(ctx context.Context, command string, params map[string]any) (map[string]any, error) {
	cfg := a.store.Snapshot().Integrations.OBS
	if strings.TrimSpace(cfg.URL) == "" {
		return nil, errors.New("OBS não configurado no Companion")
	}
	client, err := dialOBS(ctx, cfg.URL, cfg.Password)
	if err != nil {
		return nil, err
	}
	defer client.Close()
	switch command {
	case "toggle_stream":
		return client.Request("ToggleStream", nil)
	case "toggle_record":
		return client.Request("ToggleRecord", nil)
	case "toggle_virtual_camera":
		return client.Request("ToggleVirtualCam", nil)
	case "save_replay":
		return client.Request("SaveReplayBuffer", nil)
	case "set_scene":
		scene := stringParam(params, "sceneName")
		if scene == "" {
			return nil, errors.New("informe sceneName")
		}
		return client.Request("SetCurrentProgramScene", map[string]any{"sceneName": scene})
	case "toggle_input_mute":
		input := stringParam(params, "inputName")
		if input == "" {
			return nil, errors.New("informe inputName")
		}
		return client.Request("ToggleInputMute", map[string]any{"inputName": input})
	case "toggle_studio_mode":
		current, err := client.Request("GetStudioModeEnabled", nil)
		if err != nil {
			return nil, err
		}
		enabled, _ := current["studioModeEnabled"].(bool)
		return client.Request("SetStudioModeEnabled", map[string]any{"studioModeEnabled": !enabled})
	default:
		return nil, fmt.Errorf("comando OBS não suportado: %s", command)
	}
}

type obsClient struct {
	conn   net.Conn
	reader *bufio.Reader
	ctx    context.Context
}

type wsEnvelope struct {
	Op int            `json:"op"`
	D  map[string]any `json:"d"`
}

func dialOBS(ctx context.Context, rawURL, password string) (*obsClient, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		rawURL = "ws://127.0.0.1:4455"
	}
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "ws" && u.Scheme != "wss") {
		return nil, errors.New("URL do OBS deve começar com ws:// ou wss://")
	}
	host := u.Host
	if !strings.Contains(host, ":") {
		if u.Scheme == "wss" {
			host += ":443"
		} else {
			host += ":80"
		}
	}
	dialer := &net.Dialer{Timeout: 3 * time.Second}
	var conn net.Conn
	if u.Scheme == "wss" {
		tlsConn, err := tls.DialWithDialer(dialer, "tcp", host, &tls.Config{ServerName: u.Hostname(), MinVersion: tls.VersionTLS12})
		if err != nil {
			return nil, err
		}
		conn = tlsConn
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", host)
		if err != nil {
			return nil, err
		}
	}
	deadline, ok := ctx.Deadline()
	if ok {
		_ = conn.SetDeadline(deadline)
	} else {
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
	}
	keyBytes := make([]byte, 16)
	_, _ = rand.Read(keyBytes)
	wsKey := base64.StdEncoding.EncodeToString(keyBytes)
	path := u.EscapedPath()
	if path == "" {
		path = "/"
	}
	if u.RawQuery != "" {
		path += "?" + u.RawQuery
	}
	req := fmt.Sprintf("GET %s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: obswebsocket.json\r\n\r\n", path, u.Host, wsKey)
	if _, err := io.WriteString(conn, req); err != nil {
		conn.Close()
		return nil, err
	}
	reader := bufio.NewReader(conn)
	tp := textproto.NewReader(reader)
	statusLine, err := tp.ReadLine()
	if err != nil {
		conn.Close()
		return nil, err
	}
	if !strings.Contains(statusLine, " 101 ") {
		conn.Close()
		return nil, fmt.Errorf("OBS recusou WebSocket: %s", statusLine)
	}
	headers, err := tp.ReadMIMEHeader()
	if err != nil {
		conn.Close()
		return nil, err
	}
	accept := headers.Get("Sec-WebSocket-Accept")
	expectedHash := sha1.Sum([]byte(wsKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
	if accept != base64.StdEncoding.EncodeToString(expectedHash[:]) {
		conn.Close()
		return nil, errors.New("handshake WebSocket do OBS inválido")
	}
	c := &obsClient{conn: conn, reader: reader, ctx: ctx}
	hello, err := c.readEnvelope()
	if err != nil {
		conn.Close()
		return nil, err
	}
	if hello.Op != 0 {
		conn.Close()
		return nil, errors.New("OBS não enviou Hello")
	}
	rpc := 1
	if n, ok := numberInt(hello.D["rpcVersion"]); ok && n > 0 {
		rpc = n
	}
	identify := map[string]any{"rpcVersion": rpc, "eventSubscriptions": 0}
	if authObj, ok := hello.D["authentication"].(map[string]any); ok {
		challenge, _ := authObj["challenge"].(string)
		salt, _ := authObj["salt"].(string)
		if password == "" {
			conn.Close()
			return nil, errors.New("OBS exige senha WebSocket")
		}
		secretHash := sha256.Sum256([]byte(password + salt))
		secret := base64.StdEncoding.EncodeToString(secretHash[:])
		authHash := sha256.Sum256([]byte(secret + challenge))
		identify["authentication"] = base64.StdEncoding.EncodeToString(authHash[:])
	}
	if err := c.writeJSON(wsEnvelope{Op: 1, D: identify}); err != nil {
		conn.Close()
		return nil, err
	}
	for {
		env, err := c.readEnvelope()
		if err != nil {
			conn.Close()
			return nil, err
		}
		if env.Op == 2 {
			_ = conn.SetDeadline(time.Time{})
			return c, nil
		}
	}
}

func (c *obsClient) Close() error { return c.conn.Close() }

func (c *obsClient) Request(requestType string, data map[string]any) (map[string]any, error) {
	requestID := randomToken(12)
	d := map[string]any{"requestType": requestType, "requestId": requestID}
	if len(data) > 0 {
		d["requestData"] = data
	}
	if err := c.writeJSON(wsEnvelope{Op: 6, D: d}); err != nil {
		return nil, err
	}
	_ = c.conn.SetDeadline(time.Now().Add(5 * time.Second))
	defer c.conn.SetDeadline(time.Time{})
	for {
		env, err := c.readEnvelope()
		if err != nil {
			return nil, err
		}
		if env.Op != 7 {
			continue
		}
		id, _ := env.D["requestId"].(string)
		if id != requestID {
			continue
		}
		status, _ := env.D["requestStatus"].(map[string]any)
		result, _ := status["result"].(bool)
		if !result {
			comment, _ := status["comment"].(string)
			if comment == "" {
				comment = "OBS rejeitou a solicitação"
			}
			return nil, errors.New(comment)
		}
		response, _ := env.D["responseData"].(map[string]any)
		if response == nil {
			response = map[string]any{}
		}
		return response, nil
	}
}

func (c *obsClient) writeJSON(v any) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return writeWSFrame(c.conn, 0x1, raw)
}
func (c *obsClient) readEnvelope() (wsEnvelope, error) {
	raw, err := readWSMessage(c.reader, c.conn)
	if err != nil {
		return wsEnvelope{}, err
	}
	var env wsEnvelope
	err = json.Unmarshal(raw, &env)
	return env, err
}

func writeWSFrame(w io.Writer, opcode byte, payload []byte) error {
	header := []byte{0x80 | opcode}
	n := len(payload)
	switch {
	case n < 126:
		header = append(header, 0x80|byte(n))
	case n <= 65535:
		header = append(header, 0x80|126, byte(n>>8), byte(n))
	default:
		header = append(header, 0x80|127)
		var b [8]byte
		binary.BigEndian.PutUint64(b[:], uint64(n))
		header = append(header, b[:]...)
	}
	mask := make([]byte, 4)
	if _, err := rand.Read(mask); err != nil {
		return err
	}
	header = append(header, mask...)
	masked := make([]byte, n)
	for i := range payload {
		masked[i] = payload[i] ^ mask[i%4]
	}
	if _, err := w.Write(header); err != nil {
		return err
	}
	_, err := w.Write(masked)
	return err
}

func readWSMessage(r *bufio.Reader, conn net.Conn) ([]byte, error) {
	var out []byte
	for {
		b1, err := r.ReadByte()
		if err != nil {
			return nil, err
		}
		b2, err := r.ReadByte()
		if err != nil {
			return nil, err
		}
		fin := b1&0x80 != 0
		opcode := b1 & 0x0f
		masked := b2&0x80 != 0
		length := uint64(b2 & 0x7f)
		if length == 126 {
			var b [2]byte
			if _, err = io.ReadFull(r, b[:]); err != nil {
				return nil, err
			}
			length = uint64(binary.BigEndian.Uint16(b[:]))
		}
		if length == 127 {
			var b [8]byte
			if _, err = io.ReadFull(r, b[:]); err != nil {
				return nil, err
			}
			length = binary.BigEndian.Uint64(b[:])
		}
		if length > 4<<20 {
			return nil, errors.New("frame OBS grande demais")
		}
		var mask [4]byte
		if masked {
			if _, err = io.ReadFull(r, mask[:]); err != nil {
				return nil, err
			}
		}
		payload := make([]byte, int(length))
		if _, err = io.ReadFull(r, payload); err != nil {
			return nil, err
		}
		if masked {
			for i := range payload {
				payload[i] ^= mask[i%4]
			}
		}
		switch opcode {
		case 0x8:
			return nil, io.EOF
		case 0x9:
			_ = writeWSFrame(conn, 0xA, payload)
			continue
		case 0xA:
			continue
		case 0x1, 0x0:
			out = append(out, payload...)
		default:
			continue
		}
		if fin {
			return out, nil
		}
	}
}

func numberInt(v any) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	default:
		return 0, false
	}
}
func stringParam(params map[string]any, key string) string {
	if params == nil {
		return ""
	}
	v, _ := params[key].(string)
	return strings.TrimSpace(v)
}
func randomToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
