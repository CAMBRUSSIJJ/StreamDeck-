# Changelog

## 1.0.0 — Stable

- Instalador Windows de um clique com instalação por usuário, startup, atalho e desinstalação.
- Companion com ícone na bandeja do Windows e menu para painel, Deck local e saída.
- Inicialização automática configurável pelo painel administrativo.
- Modo single-instance para evitar conflitos de porta em lançamentos repetidos.
- Onboarding V1.0 no iPad com quatro etapas e opção de reabrir pelos Ajustes.
- Diagnóstico completo no Companion: configuração, endereço LAN, porta local, pareamento, startup e plataforma.
- Exportação de diagnóstico sanitizado sem tokens, senhas ou chaves.
- Diagnóstico rápido no iPad com registro local limitado de erros de runtime.
- Backup portátil V2 com checksum, resumo/preview antes da importação e compatibilidade com backups V1.
- Verificador de atualização pelo GitHub Releases, sem auto-instalação silenciosa.
- Cache PWA atualizado para `nexus-deck-v1.0.0`.
- Versões do protocolo, interface e Companion consolidadas em `1.0.0`.

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
