# Nexus Deck V1.5.0

Nexus Deck transforma o iPad em uma superfície de controle para Windows com foco **Local First**.

## V1.5 — Companion Sync + iPad Immersivo

- sincronização bidirecional iPad ↔ Companion;
- status vivo do computador, aplicativo em primeiro plano e integrações;
- leitura do volume/mute reais do Windows via Core Audio;
- slider com ajuste de volume absoluto pelo Companion;
- Spotify Now Playing quando a integração estiver autorizada;
- confirmação visual ENVIANDO / OK / ERRO nas teclas;
- polling local mais rápido e retorno de estado junto do ACK;
- botão de tela cheia com fallback para instalação na Tela de Início;
- modo standalone/imersivo otimizado para iPad;
- Supabase continua opcional.

## Vercel

Use:

```text
Root Directory: apps/deck
Framework Preset: Other
```

Para controle local real, abra no iPad o endereço exibido pelo Companion, normalmente:

```text
http://IP-DO-PC:38474
```

## Segurança

O Companion não aceita shell arbitrário. Ações são validadas pelo protocolo e a porta local aceita apenas clientes de rede privada/local.
