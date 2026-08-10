# Nexus Deck v1.1.0 — Nexus Pro Layout

Transforme o iPad em uma superfície de controle modular para Windows. A V1.1 mantém toda a fundação estável da V1.0 e concentra a evolução em **layout, identidade visual e reconhecimento imediato dos aplicativos**.

## V1.1 — foco 100% visual

- Direção visual **Nexus Pro**: graphite escuro, superfícies sólidas, contraste controlado e menos efeitos decorativos.
- Grid mais compacto para aproveitar melhor o iPad em paisagem.
- Cards mais baixos, táteis e consistentes, sem glow/gradientes excessivos.
- Topbar, dock, modais, botões e editor redesenhados com hierarquia mais clara.
- Biblioteca vetorial embutida de ícones de aplicativos: Chrome, Edge, Obsidian, Spotify, Discord, OBS Studio, VS Code, Notion, Gmail, Outlook, WhatsApp, YouTube e Twitch.
- Detecção automática de ícone por nome do controle, URL, caminho do executável e integração.
- Seleção manual de ícone no editor, com opção **Automático** ou **Sem ícone de app**.
- Preview do editor exibe o mesmo ícone de aplicativo que aparecerá no deck.
- Compatibilidade com controles e backups das versões anteriores.

## Fundação preservada

A V1.1 não remove recursos da V1.0: Nexus Local, pareamento, widgets, macros, perfis inteligentes, integrações profissionais, diagnóstico, backup V2, tray do Windows e instalador continuam disponíveis.

## Vercel

- **Root Directory:** `apps/deck`
- **Framework Preset:** Other
- **Build Command:** desativado
- **Output Directory:** desativado

Para controle real pela LAN, abra no iPad o endereço exibido pelo Nexus Companion.

## Testes

```bash
npm run check
npm run sync:local-deck
cd apps/companion
go test ./...
go vet ./...
```
