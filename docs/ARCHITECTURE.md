# Arquitetura Nexus Deck v0.2

```text
GitHub monorepo
├── apps/deck       -> Vercel -> Safari/PWA no iPad
├── apps/companion  -> GitHub Actions -> Windows .exe
└── packages/protocol

         iPad PWA
            │
            │ WSS / Broadcast cifrado
            ▼
    Supabase Realtime
            ▲
            │ WSS / Broadcast cifrado
            │
    Windows Companion
            │
            ├── abrir URL
            ├── abrir .exe
            ├── hotkeys
            └── controles de mídia
```

## Princípios

- Cloud transport não recebe a chave privada do dispositivo.
- Sem execução arbitrária de shell.
- Sem dependências JavaScript de runtime no Deck.
- Companion é binário único, compilável sem CGO.
- Configuração do Companion fica fora do repositório no diretório de configuração do usuário.
- Protocolo e criptografia independentes da UI para permitir futuro app iPadOS nativo.
