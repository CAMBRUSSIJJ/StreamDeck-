# Arquitetura Nexus Deck v0.5

```text
GitHub monorepo
├── apps/deck       -> Vercel -> Safari/PWA no iPad
├── apps/companion  -> Windows .exe
└── packages/protocol

          Nexus Deck PWA
      ┌────────┴────────┐
      │                 │
  UI/Widgets        Editor local
      │                 │
      └────────┬────────┘
               │
       protocolo de ações
               │
        ┌──────┴──────┐
        │             │
   Relay opcional   futuro modo local
        │             │
        └──────┬──────┘
               │
      Windows Companion
```

## Camadas

- **Interface:** botões, toggles, sliders, mídia, status e relógio.
- **Estado local:** páginas, ordem, aparência, valores e preferências ficam no iPad.
- **Protocolo:** apenas ações explicitamente permitidas são aceitas.
- **Companion:** executa URL, aplicativo, hotkeys e comandos de mídia no Windows.
- **Transporte:** Supabase continua opcional; a arquitetura foi mantida separada para permitir modo local-first posteriormente.

## Segurança

- Sem execução arbitrária de shell.
- Chaves de dispositivo não ficam expostas no HTML.
- A camada visual funciona sem credenciais de nuvem.
- Companion é binário único, compilável sem CGO.
