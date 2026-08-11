# Nexus Deck v1.3.0 — Control Surface

Transforme o iPad em uma superfície de controle para Windows. A V1.3 muda a linguagem visual do Nexus: menos dashboard, mais **deck de teclas**.

## V1.3 — Control Surface

O modo de uso agora prioriza a grade. Os controles usam keycaps sólidos, ícones grandes, texto curto e feedback de pressão. Em telas largas, as páginas ficam numa barra lateral compacta; no modo de edição, o editor de tecla abre como um inspector lateral.

Grades incluídas:

- **Key Grid** — superfície padrão com 6 colunas.
- **Control Keys** — widgets e controles do sistema.
- **Dense Keys** — mais teclas por página.
- **Focus Keys** — teclas maiores para macros e rotinas.
- **Info Deck** — status, volume e informações.
- **Media Keys** — mídia, OBS, Discord e áudio.

A biblioteca visual inclui Chrome, Edge, Obsidian, Spotify, Discord, OBS Studio, VS Code, Notion, Gmail, Outlook, WhatsApp, YouTube, Twitch, Word, Excel, PowerPoint, Teams, OneDrive, GitHub Desktop, Explorador de Arquivos, Adobe Premiere Pro, Photoshop e Steam.

## Fundação preservada

Nexus Local, widgets, macros, perfis inteligentes, integrações, backup V2, diagnóstico, tray do Windows e instalador continuam disponíveis.

## Vercel

- **Root Directory:** `apps/deck`
- **Framework Preset:** Other
- **Build Command:** desativado
- **Output Directory:** desativado

## Qualidade

```bash
npm run check
npm run sync:local-deck
cd apps/companion
go test ./...
go vet ./...
```
