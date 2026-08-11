# Changelog


## 1.8.0 — Vercel Live UI + Windows Bridge

- Vercel passa a ser a fonte única da interface Nexus; o Windows não incorpora mais uma segunda cópia do Deck.
- Companion passa a atuar conceitualmente como **Nexus Windows Bridge**, dedicado a capacidades nativas do Windows.
- Novo Nexus Relay em WebSocket seguro no próprio projeto Vercel, sem exigir Supabase em novas instalações.
- Vite 8 + Nitro 3 adicionam `/api/config` e `/api/relay` ao projeto `apps/deck`.
- Windows Bridge recebe uma única configuração: URL HTTPS oficial do Nexus no Vercel.
- Pareamento cloud por código de 6 dígitos reutiliza o protocolo cifrado existente sobre o Nexus Relay.
- Workers de dispositivos são reiniciados automaticamente quando a URL oficial é alterada.
- Estado cloud agora inclui áudio real, app em primeiro plano, integrações, sequência e timestamps; ACKs retornam snapshot imediato.
- Status cloud passa a atualizar aproximadamente a cada 3 segundos enquanto conectado.
- `http://<IP-LAN>:38474/` deixa de servir UI embarcada e redireciona para a URL oficial; APIs LAN continuam disponíveis como fallback privado.
- Removida a etapa de sincronizar/copiar `apps/deck` para dentro do executável.
- O runtime V1.8 não depende mais de Supabase. Campos antigos eventualmente presentes no `config.json` são ignorados; dispositivos já pareados continuam reutilizando seus IDs e segredos ao migrar para o Nexus Relay.
- Atualizações exclusivamente visuais/web passam a exigir apenas GitHub → Vercel, sem reinstalar o Windows Bridge.

## 1.7.0 — App Focus

- Nova ação local **App Focus** no editor de teclas.
- Spotify Focus em tela dedicada, otimizado para iPad horizontal e vertical.
- Metadata enriquecida: capa, faixa, artista, álbum, duração, progresso e link oficial do Spotify.
- Controles reais de reprodução: play/pause, anterior, próxima, seek, volume, shuffle e repeat.
- Seleção de dispositivo Spotify Connect.
- Fila do Spotify carregada sob demanda apenas enquanto o App Focus está aberto.
- Snapshot sob demanda evita transformar o polling normal do Companion em múltiplas chamadas de API.
- Teclas Spotify Focus passam a mostrar faixa/artista ao vivo quando disponível.
- Base genérica `focus.js` preparada para futuros módulos OBS Focus e Windows Focus.

## 1.5.0 — Companion Sync + iPad Immersivo

- Companion passa a devolver um snapshot de estado junto de cada comando local.
- Sincronização local reduzida para aproximadamente 2,5 s quando a página está ativa.
- Novo Companion Sync Center no iPad.
- Leitura de volume e mute reais do Windows por Core Audio.
- Novo comando seguro `media.volume_set` para slider absoluto.
- Spotify Now Playing aproveita metadados já retornados pela Web API.
- Feedback visual de envio/sucesso/erro por tecla.
- Novo controle de tela cheia e refinamentos para Home Screen/standalone.
- Novo módulo `companion-sync.js` e testes dedicados.

## 1.2.0 — Layout Engine

- Novo sistema de layout por página com seis presets profissionais: Minimal Pro, Control Center, Compact Grid, Focus, Dashboard e Media Console.
- Personalização de 3–8 colunas, densidade, escala de ícones, alinhamento de texto, estilo de card e raio.
- Dock configurável em quatro níveis e cabeçalho configurável em três níveis.
- Cinco temas de superfície: Graphite, Midnight, Slate, Ivory e OLED Black, independentes da cor de destaque.
- Prévia ao vivo no editor de layout, com Cancelar restaurando a composição salva.
- Até 12 layouts personalizados salvos localmente e incluídos no backup portátil.
- Ação para aplicar a mesma composição visual a todas as páginas.
- Gerenciador de páginas mostra o preset ativo e oferece acesso direto ao editor visual.
- Biblioteca de ícones ampliada com Word, Excel, PowerPoint, Teams, OneDrive, GitHub Desktop, Explorador de Arquivos, Premiere Pro, Photoshop e Steam.
- Novo módulo testável `js/core/layout.js`.
- Cache PWA atualizado para `nexus-deck-v1.2.0`.
- Companion/Setup recompilados com a interface local V1.2.

## 1.1.0 — Nexus Pro Layout

- Redesign visual completo da interface do iPad com foco em produto profissional e redução de efeitos decorativos.
- Nova paleta graphite, superfícies sólidas, sombras discretas e hierarquia tipográfica mais limpa.
- Grid padrão de cinco colunas em telas largas e densidade adaptativa para iPad em paisagem/retrato.
- Cards redesenhados: compactos, sem glow, com linha de acento discreta e estados táteis mais claros.
- Topbar, dock, modais, editor e widgets alinhados à nova linguagem Nexus Pro.
- Nova biblioteca `js/ui/app-icons.js` com ícones vetoriais embutidos de Chrome, Edge, Obsidian, Spotify, Discord, OBS Studio, VS Code, Notion, Gmail, Outlook, WhatsApp, YouTube e Twitch.
- Detecção automática de ícone por nome, URL, executável e integração, com seleção manual no editor.
- Preview do editor atualizado para renderizar os ícones de aplicativos.
- Migração transparente: controles antigos passam a usar `appIcon: auto` sem perder dados.
- Cache PWA atualizado para `nexus-deck-v1.1.0`.
- Companion/Setup recompilados para incluir a interface local V1.1.

## 1.0.0 — Stable

- Instalador Windows, tray, single-instance e inicialização automática.
- Onboarding no iPad, diagnóstico local, backup V2 com checksum e checagem de atualização.
- Consolidação da fundação construída entre V0.4 e V0.9.

## 0.9.0 — Integrações Profissionais

- Nova arquitetura `internal/integrations` com adaptadores isolados e catálogo de comandos.
- Novo tipo de ação `integration`, disponível em controles normais e etapas de macro.
- OBS Studio via obs-websocket 5.x: stream, gravação, câmera virtual, Replay Buffer, cena, mute de entrada e Studio Mode.
- Spotify via OAuth 2.0 + PKCE e Web API: reprodução, navegação de faixas, volume, seek, shuffle e repeat.
- Discord Desktop por hotkeys configuráveis para mute/deafen e abertura do cliente.
- Navegador por hotkeys allowlisted do Windows para gerenciamento de abas e navegação.
- Painel do Companion com configuração, autorização e status das integrações.
- Status das integrações exposto ao Deck local e ao status do Companion sem expor senhas/tokens.
- Editor do Deck com seleção de serviço, comando e parâmetros específicos.
- Macros podem combinar ações Nexus tradicionais e integrações profissionais.
- Testes adicionais para validação e execução do novo tipo de ação.
- Cache PWA atualizado para `nexus-deck-v0.9.0`.

## 0.8.0 — Perfis Inteligentes

- Detecção do aplicativo em primeiro plano no Windows pelo Nexus Companion.
- Cada página pode ser vinculada a até 12 executáveis, como `obsidian.exe`, `code.exe` e `obs64.exe`.
- Troca automática de página quando o aplicativo correspondente entra em foco.
- Retorno à página manual anterior quando não existe perfil correspondente.
- Override manual de 30 segundos para evitar que a automação lute contra o usuário.
- Chave global para pausar/reativar Perfis Inteligentes.
- Aplicativo ativo exibido em Ajustes para facilitar a configuração dos perfis.
- Perfis entram no backup portátil do deck, sem incluir dados sensíveis.
- Cache PWA atualizado para `nexus-deck-v0.8.0`.

## 0.7.0 — Macros & Automação

- Novo tipo de controle **Macro / Automação** no editor.
- Macros com 1–20 etapas e execução em ordem.
- Atraso configurável de 0–10.000 ms antes de cada etapa, limitado a 60 s por macro.
- Condições simples por etapa: sempre, sucesso anterior ou falha anterior.
- Política opcional de parar imediatamente no primeiro erro.
- Execução e validação da sequência no Nexus Companion, sem shell arbitrário e sem macros aninhadas.
- Relatório por etapa retornado ao iPad, com sucesso, falha, salto e duração.
- Feedback visual de progresso diretamente no card da macro.
- Cache PWA atualizado para `nexus-deck-v0.7.0`.

## 0.6.0 — Local Control

- Novo servidor LAN do Companion em `:38474`.
- Nexus Deck completo servido diretamente pelo Windows para o iPad.
- Pareamento local por código de 6 dígitos sem exigir Supabase.
- Autorização persistente de iPads locais.
- Ping/status real do Companion com latência aproximada.
- Reconexão automática do transporte local.
- Proteção contra replay e rejeição de IPs fora de redes privadas.
- Transporte AES-256-GCM quando Web Crypto está disponível em contexto seguro.
- Fallback LAN autenticado por token para Safari em HTTP local.
- Novo comando `system.lock` para bloquear a sessão do Windows.
- Backup/importação portátil de páginas, controles e aparência, sem segredos de dispositivos.
- Painel Windows redesenhado com URL local em destaque.
- Supabase passa a ser explicitamente opcional.
- Cache PWA atualizado para `nexus-deck-v0.6.0`.

## 0.5.0 — Widgets Dinâmicos

- Novo tipo `button` para ações tradicionais.
- Novo `toggle` com estado ON/OFF persistente.
- Novo slider de volume touch-first com envio relativo de comandos de volume.
- Nova central de mídia 2×2.
- Novo widget de status do PC.
- Novo widget de relógio/data em tempo real.
- Editor agora permite trocar o tipo de item e aplica presets inteligentes.
- Novo módulo `core/widgets.js` com regras puras e testáveis.
- Migração do deck inicial antigo para a nova fundação de widgets.
- Cache PWA atualizado para `nexus-deck-v0.5.0`.
- Supabase continua opcional para a experiência visual.

## 0.4.0 — Editor Profissional

- Reordenação touch-first de controles pela alça de arraste.
- Feedback visual durante drag & drop.
- Duplicação de controles.
- Gerenciador de páginas.
- Criar, renomear, ativar, reordenar, duplicar e excluir páginas.
