# Arquitetura — Nexus Deck V1.8

## Fonte única de interface

A V1.8 elimina a duplicação da UI entre Vercel e executável Windows.

```text
                         INTERNET
                            │
                            ▼
                 ┌──────────────────────┐
                 │       VERCEL         │
                 │ Nexus Web / PWA      │
                 │ /api/config          │
                 │ /api/relay · WSS     │
                 └──────────┬───────────┘
                            │
                         Nexus Relay
                         WebSocket WSS
                 ┌──────────┴───────────┐
                 │                      │
                 ▼                      ▼
        ┌────────────────┐      ┌──────────────────────┐
        │ iPad / PWA     │      │ Nexus Windows Bridge │
        │ UI / editor    │      │ Go · Windows x64     │
        │ App Focus      │      │ ações/estado local   │
        └────────────────┘      └──────────┬───────────┘
                                           │
                                           ▼
                                        Windows
```

`apps/deck` é a UI oficial. O Bridge não incorpora mais `apps/deck` em seu executável.

## Nexus Relay

O relay fica em `/api/relay` e usa WebSocket. Os canais continuam seguindo o protocolo Nexus:

- pareamento: `nexus-pair-<6 dígitos>`;
- dispositivo: `nexus-device-<room id aleatório>`;
- frame de transporte: `{ type: "nexus", payload }`.

O relay separa conexões por namespace/room e encaminha frames entre os peers da mesma room. O tráfego persistente de dispositivo é cifrado antes do relay com o segredo pareado; o relay não precisa conhecer a chave do dispositivo.

O cliente recebe `/api/config` da mesma origem e deriva o endpoint `wss://<host>/api/relay`, evitando configuração de Supabase na PWA.

## Windows Bridge

O processo Windows mantém:

- `127.0.0.1:38473`: painel administrativo e configuração;
- `0.0.0.0:38474`: fallback/API LAN privada;
- ações do Windows;
- estado do áudio;
- aplicativo em primeiro plano;
- macros locais;
- integrações locais, incluindo OBS e adaptadores allowlisted;
- workers WebSocket dos dispositivos pareados.

A raiz `http://<IP-LAN>:38474/` não entrega mais uma segunda cópia da UI. Quando `webAppUrl` está configurada, retorna um redirect temporário para a versão oficial no Vercel.

## Sincronização de estado

O Bridge envia um snapshot aproximadamente a cada 3 segundos enquanto o canal está conectado. Um `ack` de comando também inclui um snapshot novo, reduzindo a latência visual após um toque.

Snapshots podem incluir:

- online/hostname/versão;
- transport e sequência de sincronização;
- aplicativo em primeiro plano;
- volume/mute do Windows;
- estados sanitizados das integrações.

## Pareamento

O Windows gera um código temporário de 6 dígitos. O browser cria identidade efêmera para o handshake; depois do pareamento o dispositivo recebe `roomId` e segredo aleatórios e persiste esses dados localmente. O Bridge armazena somente os dispositivos autorizados e seus segredos no diretório de configuração do usuário.

## Compatibilidade

A V1.8 remove o transporte Supabase do runtime. Em instalações atualizadas, campos antigos desconhecidos no `config.json` são simplesmente ignorados pelo loader. Ao salvar a URL oficial do Vercel, os workers são reiniciados e passam a usar exclusivamente o Nexus Relay; IDs e segredos dos dispositivos existentes continuam válidos.

## Fallback LAN

A API local em `38474` continua disponível somente para rede privada/loopback/link-local. Ela preserva o modo local existente em caso de necessidade de diagnóstico ou fallback. A UI principal, entretanto, deve ser aberta no domínio Vercel.

## Atualizações

Mudanças de UI:

```text
GitHub → Push → Vercel → próximo reload da PWA
```

Mudanças nativas:

```text
Código Go/Windows → nova release do Windows Bridge → Setup
```

Essa separação impede que alterações de layout, CSS, App Focus ou mobile obriguem a recompilar o executável Windows.
