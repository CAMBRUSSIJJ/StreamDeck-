# Nexus Protocol v1

## Mensagens

Mensagens lógicas usam `type`, `id`, `ts` e `body`. IDs/timestamps permitem confirmação e proteção contra replay no transporte local.

Tipos principais:

- `command`
- `ack`
- `status`
- `ping`

## Ações suportadas

- `open_url` `{ url }`
- `launch_app` `{ path, args? }`
- `hotkey` `{ keys: ["CTRL", "SHIFT", "K"] }`
- `media` `{ key: "play_pause" | "next" | "previous" | "volume_up" | "volume_down" | "volume_mute" }`
- `system` `{ key: "lock" }`
- `integration` `{ service, command, params? }` para adaptadores allowlisted do Companion
- `macro` `{ stopOnError, steps[] }` com ações primitivas, atraso e condição por etapa

Shell arbitrário não faz parte do protocolo.

## Local Transport — V0.6

O Companion expõe o Deck e a API em `http://<IP-LAN>:38474`.

Fluxo:

1. Companion gera código temporário de 6 dígitos.
2. iPad solicita pareamento.
3. Companion cria ID e segredo aleatório de dispositivo.
4. O dispositivo é persistido no Windows.
5. Comandos locais exigem autenticação do dispositivo e timestamp recente.

Em contexto seguro, o transporte usa o envelope AES-256-GCM já utilizado pelo Nexus. Em HTTP LAN, a versão compatível usa token aleatório de 256 bits como credencial e restringe o servidor a redes privadas.

## Cloud Relay — opcional

O transporte Supabase anterior continua compatível:

- pairing: `realtime:nexus-pair-<6 digits>`
- device: `realtime:nexus-device-<room id>`
- evento broadcast: `nexus`

## Perfis Inteligentes — V0.8

As mensagens `status` do Companion podem incluir `activeApp` com `processName`, `processPath`, `windowTitle` e `pid`. O Deck usa principalmente `processName` para escolher uma página associada ao aplicativo em primeiro plano. Essa informação é estado do Companion; não concede capacidade extra de execução ao navegador.


## Integrações Profissionais — V0.9

A ação `integration` não representa execução genérica. `service` e `command` são identificadores seguros e o Companion despacha apenas para adaptadores registrados (`obs`, `spotify`, `discord`, `browser`). `params` é um objeto JSON limitado em tamanho e cada adaptador valida os parâmetros exigidos.

Status do Companion pode incluir `integrations`, com estado sanitizado de conexão/configuração e informações operacionais. Segredos, senhas e tokens OAuth não são enviados ao Deck.
