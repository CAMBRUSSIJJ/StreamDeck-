# Nexus Deck v1.2.0 — Layout Engine

Transforme o iPad em uma superfície de controle modular para Windows. A V1.2 preserva a fundação estável do Nexus e adiciona um **sistema visual por página**, com presets profissionais, temas, densidades e composição ajustável.

## V1.2 — Layout Engine

Cada página pode ter uma identidade própria sem alterar seus controles, macros ou integrações.

Presets incluídos:

- **Minimal Pro** — limpo e equilibrado para produtividade.
- **Control Center** — widgets e status em destaque.
- **Compact Grid** — mais ações por tela.
- **Focus** — poucos controles grandes para rotinas importantes.
- **Dashboard** — mistura aplicativos, status e informação.
- **Media Console** — composição para OBS, Spotify, Discord e áudio.

Ajustes por página:

- 3 a 8 colunas;
- densidade compacta, equilibrada ou espaçosa;
- ícones pequenos, médios ou grandes;
- texto à esquerda ou centralizado;
- cards sólido, elevado, outline ou flat;
- raio dos cards de 8 a 28 px;
- dock oculto, minimal, compacto ou completo;
- cabeçalho oculto, compacto ou completo;
- temas Graphite, Midnight, Slate, Ivory e OLED Black.

Também é possível salvar até 12 layouts personalizados e reutilizá-los em outras páginas, além de aplicar uma composição a todo o deck.

## Biblioteca de aplicativos

A biblioteca visual agora inclui Chrome, Edge, Obsidian, Spotify, Discord, OBS Studio, VS Code, Notion, Gmail, Outlook, WhatsApp, YouTube, Twitch, Word, Excel, PowerPoint, Teams, OneDrive, GitHub Desktop, Explorador de Arquivos, Adobe Premiere Pro, Photoshop e Steam.

## Fundação preservada

Nexus Local, widgets, macros, perfis inteligentes, integrações profissionais, backup V2, diagnóstico, tray do Windows e instalador continuam disponíveis.

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
