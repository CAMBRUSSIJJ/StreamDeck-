# Nexus Deck v1.0.0 — Stable

Nexus Deck transforma um iPad em uma superfície de controle modular para Windows. A V1.0 fecha o primeiro ciclo do produto com **controle local pela LAN**, editor touch-first, widgets, macros, perfis inteligentes, integrações profissionais e uma experiência de instalação/diagnóstico mais robusta.

## V1.0 — foco em produto

- **NexusDeck-Setup.exe**: instalador de um clique para o usuário atual do Windows.
- **Companion na bandeja do Windows** com menu para abrir painel, abrir o Deck local ou encerrar.
- **Inicialização automática** configurável pelo painel do Companion.
- **Single-instance**: abrir o Companion novamente reutiliza a instância existente em vez de gerar conflito de porta.
- **Onboarding no iPad** para conexão local, pareamento e personalização.
- **Diagnóstico completo no Windows** para configuração, endereço LAN, porta 38474, pareamento e startup.
- **Diagnóstico rápido no iPad**, com exportação sanitizada.
- **Backup V2** com checksum de integridade, preview antes da importação e preservação dos dispositivos pareados.
- **Verificação de atualização** pelo GitHub Releases, sem instalar nada automaticamente.
- Cache PWA e versões internas consolidados em `1.0.0`.

## Recursos consolidados

- **V0.9:** OBS Studio, Spotify, Discord e navegador por adaptadores especializados.
- **V0.8:** Perfis Inteligentes por aplicativo em primeiro plano.
- **V0.7:** Macros de 1–20 etapas, condições, atrasos e relatório por etapa.
- **V0.6:** Local First pela LAN, pareamento local e Supabase opcional.
- **V0.5:** widgets de volume, mídia, toggle, status e relógio.
- **V0.4:** editor touch-first e gerenciador de páginas.

## Segurança

O Companion não aceita shell, CMD ou PowerShell arbitrário como ação remota. Ações e integrações passam por allowlists explícitas. Credenciais de integrações ficam no armazenamento local do Companion e não entram nos backups do Deck. O modo HTTP LAN usa autenticação por token em redes privadas quando o Safari não oferece Web Crypto em contexto local inseguro.

## Instalação no Windows

Use `NexusDeck-Setup-v1.0.0.exe`. Ele instala o Companion em `%LOCALAPPDATA%\\Programs\\NexusDeck`, registra a inicialização automática, cria atalho no Menu Iniciar e registra o desinstalador no Windows.

O executável portátil `NexusDeck-Companion-v1.0.0.exe` continua disponível para uso sem instalação.

## Vercel

- **Root Directory:** `apps/deck`
- **Framework Preset:** Other
- **Build Command:** sem override
- **Output Directory:** sem override

Para controlar o Windows sem relay, abra no iPad o endereço LAN exibido pelo Companion, normalmente `http://<IP-DO-PC>:38474`.

## Desenvolvimento e testes

```bash
npm run check
cd apps/companion
go test ./...
go vet ./...
```

Build Windows completo pelo script `apps/companion/build-windows.bat`.
