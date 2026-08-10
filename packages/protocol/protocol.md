# Nexus Protocol v1

Transport topic prefixes:

- Pairing: `realtime:nexus-pair-<6 digits>`
- Device: `realtime:nexus-device-<128-bit id>`

Broadcast event name: `nexus`

## Pair request

```json
{
  "kind": "pair-request",
  "requestId": "uuid-like-id",
  "clientPublicKey": "base64url",
  "clientNonce": "base64url"
}
```

## Pair response

```json
{
  "kind": "pair-response",
  "requestId": "same request id",
  "serverPublicKey": "base64url",
  "serverNonce": "base64url",
  "envelope": {
    "v": 1,
    "iv": "base64url",
    "ciphertext": "base64url"
  }
}
```

The decrypted payload contains `deviceId`, `roomId`, `secret`, `name` and protocol version.

## Secure envelope

```json
{
  "v": 1,
  "iv": "base64url",
  "ciphertext": "base64url"
}
```

Plaintext message types:

- `command`
- `ack`
- `status`

## Supported command actions

- `open_url` `{ url }`
- `launch_app` `{ path, args? }`
- `hotkey` `{ keys: ["CTRL", "SHIFT", "K"] }`
- `media` `{ key: "play_pause" | "next" | "previous" | "volume_up" | "volume_down" | "volume_mute" }`
