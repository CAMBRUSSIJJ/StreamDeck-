package protocol

const Version = 1
const AppVersion = "1.7.0"

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
	ClientName      string `json:"clientName,omitempty"`
	ClientPlatform  string `json:"clientPlatform,omitempty"`
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

type LocalDevice struct {
	ID        string `json:"id"`
	Secret    string `json:"secret"`
	Name      string `json:"name"`
	Platform  string `json:"platform"`
	CreatedAt int64  `json:"createdAt"`
}

type LocalPeer struct {
	ID        string `json:"id"`
	Secret    string `json:"secret"`
	Name      string `json:"name"`
	Platform  string `json:"platform"`
	Transport string `json:"transport"`
	Version   int    `json:"protocolVersion"`
}

type LocalPairRequest struct {
	Code            string `json:"code"`
	RequestID       string `json:"requestId"`
	ClientPublicKey string `json:"clientPublicKey"`
	ClientNonce     string `json:"clientNonce"`
	ClientName      string `json:"clientName,omitempty"`
	ClientPlatform  string `json:"clientPlatform,omitempty"`
}

type Message struct {
	Type string  `json:"type"`
	ID   string  `json:"id"`
	TS   int64   `json:"ts"`
	Body jsonRaw `json:"body"`
}

type jsonRaw = []byte
