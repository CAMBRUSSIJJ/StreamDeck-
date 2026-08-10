# Segurança — Nexus Deck v1.0

## Princípios

O Nexus Deck segue um modelo **Local First**. O caminho preferencial é iPad ↔ Companion pela mesma rede privada. O Cloud Relay via Supabase permanece opcional e legado.

## Pareamento local

- código temporário de 6 dígitos;
- segredo aleatório por dispositivo;
- autorização persistida apenas no Companion e no iPad correspondente;
- revogação individual pelo painel Windows;
- mensagens com ID e timestamp para reduzir replay.

## Transporte

Em contexto seguro, o Nexus usa AES-256-GCM. Em Safari aberto por HTTP em IP privado, Web Crypto pode não estar disponível como Secure Context; nesse caso a V1.0 usa um token aleatório de alta entropia e restringe o servidor a endereços privados/loopback/link-local. Por isso o modo HTTP LAN deve ser usado somente em redes Wi‑Fi privadas e confiáveis.

## Execução no Windows

O protocolo não possui ação de shell genérica. O Companion aceita apenas famílias de ação registradas e validadas:

- URL;
- aplicativo `.exe`;
- hotkeys limitadas;
- mídia/volume;
- bloqueio de sessão;
- integrações registradas;
- macros compostas pelas mesmas ações permitidas.

Comandos arbitrários de CMD, PowerShell ou shell não fazem parte do protocolo remoto.

## Integrações

Senhas do OBS e tokens OAuth do Spotify ficam no arquivo de configuração local do Companion. Endpoints de status e relatórios de diagnóstico expõem somente informações sanitizadas.

## Backups e diagnósticos

Backups do Deck não incluem dispositivos, segredos ou tokens. A V1.0 adiciona checksum de integridade ao Backup V2. Relatórios de diagnóstico também omitem credenciais.

## Releases

Os executáveis gerados neste projeto não são assinados digitalmente por padrão. O Windows SmartScreen pode exibir aviso em builds baixados. Para distribuição pública em escala, recomenda-se assinatura Authenticode e publicação dos hashes SHA-256 junto à release.
