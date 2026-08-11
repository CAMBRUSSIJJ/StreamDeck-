# Segurança — Nexus Deck V1.8

## Modelo principal

A V1.8 usa o Vercel como fonte única da interface e um Nexus Relay WebSocket para transporte. O relay não concede ao navegador acesso genérico ao Windows: o Windows Bridge continua aceitando apenas mensagens do protocolo Nexus e ações allowlisted.

## Criptografia de dispositivo

Depois do pareamento, mensagens persistentes de dispositivo são protegidas com AES-256-GCM usando o segredo aleatório do dispositivo e AAD associada à room. O envelope cifrado é produzido antes de atravessar o Nexus Relay.

O relay recebe e encaminha o envelope; não precisa armazenar nem conhecer a chave do dispositivo. Tokens OAuth de integrações permanecem no Windows Bridge e não são incluídos nos snapshots enviados ao deck.

## Pareamento

- código temporário de 6 dígitos;
- handshake com material efêmero;
- `roomId` de dispositivo aleatório após pareamento;
- códigos expiram e não substituem o segredo persistente do dispositivo.

O código curto existe para usabilidade e deve ser tratado como credencial temporária. Gere-o apenas quando estiver realizando o pareamento.

## Relay

O endpoint `/api/relay` aceita somente rooms com formatos Nexus conhecidos e limita o tamanho de frames. Conexões são isoladas por namespace da room. O relay é transporte, não executor de comandos.

WebSockets no Vercel usam `wss://` em produção. O domínio do relay é obtido da mesma origem por `/api/config`.

## Windows Bridge

Não existe shell, CMD ou PowerShell genérico no protocolo remoto. Ações passam por validação antes de chegar aos adaptadores Windows. Integrações também aceitam apenas serviços/comandos registrados.

O painel administrativo permanece em loopback (`127.0.0.1:38473`). A API LAN em `38474` rejeita endereços fora de redes privadas/loopback/link-local e é mantida como fallback compatível.

## Migração legada

Campos antigos de Supabase podem continuar presentes em `config.json` após uma atualização, mas a V1.8 não os lê nem usa em runtime. Eles são ignorados e desaparecem quando a configuração é salva novamente. IDs e segredos dos dispositivos pareados permanecem separados desses campos e podem ser reutilizados no Nexus Relay.

## Recomendações

- Use domínio HTTPS do Vercel.
- Mantenha o Windows Bridge atualizado quando uma release alterar protocolo ou capacidades nativas.
- Remova dispositivos que você não reconhece pelo painel do Bridge.
- Não compartilhe códigos de pareamento ativos.
- Em rede pública, prefira o caminho Vercel/Relay em vez do fallback HTTP LAN.
