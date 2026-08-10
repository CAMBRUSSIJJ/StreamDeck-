# Nexus Deck v0.5.0 — Widgets Dinâmicos

Transforme o iPad em uma superfície de controle modular para Windows.

## V0.5

A V0.5 mantém o editor profissional da V0.4 e adiciona uma camada real de widgets:

- botão de ação tradicional;
- toggle ON/OFF com estado local persistente;
- slider de volume touch-first;
- central de mídia 2×2 com anterior, play/pause, próxima e mute;
- widget de status do computador;
- widget de relógio/data em tempo real;
- seletor de tipo no editor;
- presets automáticos de tamanho, cor e símbolo;
- migração não destrutiva do deck inicial da V0.4;
- funcionamento visual sem Supabase;
- comandos continuam restritos ao protocolo seguro existente.

## Deploy no Vercel

- **Root Directory:** `apps/deck`
- **Framework Preset:** Other
- **Build Command:** desativado
- **Output Directory:** desativado

A interface e os widgets locais funcionam sem Supabase. A comunicação remota com o PC continua separada da camada visual.

## Estrutura

```text
apps/
  deck/        PWA do iPad
  companion/   Companion Windows
packages/
  protocol/    protocolo compartilhado
.github/
  workflows/   CI e release
```

## Testes

```bash
npm run check
cd apps/companion
go test ./...
go vet ./...
```
