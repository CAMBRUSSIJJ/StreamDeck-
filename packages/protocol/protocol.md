# Nexus Protocol v1

## Mensagens

Mensagens lógicas usam `type`, `id`, `ts` e `body`. Tipos principais: `command`, `ack`, `status` e `ping`.

## Ações suportadas

- `open_url` `{ url }`
- `launch_app` `{ path, args? }`
- `hotkey` `{ keys: ["CTRL", "SHIFT", "K"] }`
- `media` `{ key: "play_pause" | "next" | "previous" | "volume_up" | "volume_down" | "volume_mute" }`
- `system` `{ key: "lock" }`
- `integration` `{ service, command, params? }`
- `macro` `{ stopOnError, steps[] }`

Shell arbitrário não faz parte do protocolo.

## Nexus Relay — V1.8

O transporte principal usa WebSocket seguro no mesmo projeto da interface:

- endpoint: `/api/relay`;
- pairing room: `nexus-pair-<6 digits>`;
- device room: `nexus-device-<room id>`;
- frame: `{ "type": "nexus", "payload": ... }`.

`/api/config` informa ao browser a `relayUrl` da mesma origem. O Windows Bridge deriva o mesmo endpoint a partir da `webAppUrl` configurada no painel.

O payload persistente do dispositivo continua sendo um `Envelope` cifrado AES-256-GCM. O relay não altera o envelope.

## Status e ack

Status do Bridge pode incluir `activeApp`, `audio`, `integrations`, `transport`, `serverTime` e `syncSequence`. Um `ack` pode incluir `state` com um snapshot imediatamente posterior ao comando.

## Local Transport — fallback

O Windows Bridge mantém `/api/local/*` em `http://<IP-LAN>:38474` para compatibilidade/fallback. O acesso é restrito a endereços privados. Em contexto seguro pode ser usado envelope AES-GCM; o modo HTTP LAN compatível exige token aleatório do dispositivo e proteção contra replay.

## Migração

O transporte Supabase das versões V1.7 e anteriores não faz parte do runtime V1.8. Campos legados são ignorados durante a leitura da configuração. O Windows Bridge V1.8 usa `webAppUrl` para derivar o Nexus Relay e pode reutilizar os registros de pareamento existentes.

## Integrações

A ação `integration` não representa execução genérica. `service` e `command` são identificadores seguros e o Bridge despacha somente para adaptadores registrados. Segredos, senhas e tokens OAuth não são enviados ao deck.
