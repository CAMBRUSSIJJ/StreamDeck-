package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"

	"nexusdeck/companion/internal/protocol"
)

func b64(b []byte) string                { return base64.RawURLEncoding.EncodeToString(b) }
func b64decode(s string) ([]byte, error) { return base64.RawURLEncoding.DecodeString(s) }

func RandomBytes(n int) ([]byte, error) {
	out := make([]byte, n)
	_, err := rand.Read(out)
	return out, err
}

func RandomB64(n int) (string, error) {
	b, err := RandomBytes(n)
	if err != nil {
		return "", err
	}
	return b64(b), nil
}

func NewPairingIdentity() (*ecdh.PrivateKey, string, string, error) {
	priv, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, "", "", err
	}
	nonce, err := RandomB64(16)
	if err != nil {
		return nil, "", "", err
	}
	return priv, b64(priv.PublicKey().Bytes()), nonce, nil
}

func DerivePairKey(priv *ecdh.PrivateKey, peerPublic, pairCode, clientNonce, serverNonce string) ([]byte, error) {
	peerBytes, err := b64decode(peerPublic)
	if err != nil {
		return nil, fmt.Errorf("decode peer public key: %w", err)
	}
	peer, err := ecdh.P256().NewPublicKey(peerBytes)
	if err != nil {
		return nil, fmt.Errorf("peer public key: %w", err)
	}
	shared, err := priv.ECDH(peer)
	if err != nil {
		return nil, err
	}
	cn, err := b64decode(clientNonce)
	if err != nil {
		return nil, err
	}
	sn, err := b64decode(serverNonce)
	if err != nil {
		return nil, err
	}
	saltInput := append(append([]byte(pairCode), cn...), sn...)
	salt := sha256.Sum256(saltInput)
	return hkdfSHA256(shared, salt[:], []byte("nexus-deck-pair-v1"), 32), nil
}

func hkdfSHA256(ikm, salt, info []byte, length int) []byte {
	extract := hmac.New(sha256.New, salt)
	extract.Write(ikm)
	prk := extract.Sum(nil)
	var out, prev []byte
	for counter := byte(1); len(out) < length; counter++ {
		expand := hmac.New(sha256.New, prk)
		expand.Write(prev)
		expand.Write(info)
		expand.Write([]byte{counter})
		prev = expand.Sum(nil)
		out = append(out, prev...)
	}
	return out[:length]
}

func EncryptJSON(value any, key []byte, aad string) (protocol.Envelope, error) {
	if len(key) != 32 {
		return protocol.Envelope{}, errors.New("AES key must be 32 bytes")
	}
	plain, err := json.Marshal(value)
	if err != nil {
		return protocol.Envelope{}, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return protocol.Envelope{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return protocol.Envelope{}, err
	}
	iv, err := RandomBytes(gcm.NonceSize())
	if err != nil {
		return protocol.Envelope{}, err
	}
	ciphertext := gcm.Seal(nil, iv, plain, []byte(aad))
	return protocol.Envelope{V: 1, IV: b64(iv), Ciphertext: b64(ciphertext)}, nil
}

func DecryptJSON(envelope protocol.Envelope, key []byte, aad string, target any) error {
	if envelope.V != 1 {
		return errors.New("unsupported envelope version")
	}
	iv, err := b64decode(envelope.IV)
	if err != nil {
		return err
	}
	ciphertext, err := b64decode(envelope.Ciphertext)
	if err != nil {
		return err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	plain, err := gcm.Open(nil, iv, ciphertext, []byte(aad))
	if err != nil {
		return err
	}
	return json.Unmarshal(plain, target)
}

func DecodeSecret(secret string) ([]byte, error) {
	key, err := b64decode(secret)
	if err != nil {
		return nil, err
	}
	if len(key) != 32 {
		return nil, errors.New("invalid device secret length")
	}
	return key, nil
}
