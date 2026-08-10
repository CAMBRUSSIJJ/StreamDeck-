package protocol

const Version = 1
const AppVersion = "0.2.0"

type Envelope struct {
	V          int    `json:"v"`
	IV         string `json:"iv"`
	Ciphertext string `json:"ciphertext"`
}

type PairRequest struct {
	Kind            string `json:"kind"`
	RequestID       string `json:"requestId"`
	ClientPublicKey string `json:"clientPublicKey"`
	ClientNonce     string `json:"clientNonce"`
}

type PairResponse struct {
	Kind            string   `json:"kind"`
	RequestID       string   `json:"requestId"`
	ServerPublicKey string   `json:"serverPublicKey"`
	ServerNonce     string   `json:"serverNonce"`
	Envelope        Envelope `json:"envelope"`
}

type Device struct {
	ID       string `json:"id"`
	RoomID   string `json:"roomId"`
	Secret   string `json:"secret"`
	Name     string `json:"name"`
	Platform string `json:"platform"`
	Version  int    `json:"protocolVersion"`
}

type Message struct {
	Type string  `json:"type"`
	ID   string  `json:"id"`
	TS   int64   `json:"ts"`
	Body jsonRaw `json:"body"`
}

type jsonRaw = []byte
