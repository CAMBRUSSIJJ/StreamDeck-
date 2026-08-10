# Segurança

## Modelo da v0.2

O Nexus Deck usa canais públicos do Supabase Realtime somente como transporte. O conteúdo sensível é cifrado no cliente e no Companion.

### Pareamento

- Código temporário de 6 dígitos, válido por curto período.
- Chaves efêmeras ECDH P-256 em ambos os lados.
- Chave de pareamento derivada por HKDF-SHA256.
- O segredo permanente do dispositivo é transferido dentro de AES-256-GCM.

### Sessão permanente

- Cada dispositivo recebe um `roomId` aleatório de 128 bits.
- Cada dispositivo recebe uma chave AES de 256 bits.
- Comandos, acknowledgements e status são cifrados com AES-GCM.
- IV aleatório de 96 bits por mensagem.
- AAD inclui o canal e a versão do protocolo.

## Limitações

- Um atacante que controlar o projeto Supabase pode negar serviço, embora não deva conseguir ler comandos cifrados sem a chave do dispositivo.
- O pareamento de 6 dígitos deve ser iniciado apenas quando o usuário estiver pronto para parear.
- Para ambientes empresariais, a próxima etapa recomendada é usar Supabase Auth + canais privados/RLS, além de assinatura de releases do Companion.
- Não exponha chaves de `service_role` no Deck ou no Companion.
