# Nexus Deck V1.7.0

Nexus Deck transforma o iPad em uma superfície de controle para Windows com foco **Local First**.

## App Focus

A V1.7 introduz uma camada de foco por aplicativo. O primeiro módulo completo é o **Spotify Focus**, com capa oficial da faixa, música, artista, álbum, progresso, play/pause, faixa anterior/próxima, shuffle, repetição, volume, seleção de dispositivo Spotify Connect e fila. O deck continua independente: você pode criar uma tecla com ação **App Focus → Spotify Focus** para abrir essa experiência em tela dedicada.

A estrutura foi criada para receber novos módulos de foco sem misturar lógica de UI com o protocolo do Windows. OBS Studio e Windows Media ficam preparados como próximos adaptadores de foco.

## V1.7 — App Focus

- nova ação **App Focus** no editor;
- Spotify Focus em tela dedicada e responsiva no iPad;
- capa oficial, faixa, artista, álbum, duração e progresso;
- play/pause, anterior, próxima, seek, volume, shuffle e repetição;
- fila carregada sob demanda e seleção de dispositivo Spotify Connect;
- tecla Spotify Focus mostra faixa/artista ao vivo no deck;
- sincronização detalhada acontece somente enquanto o foco está aberto;
- base genérica pronta para novos módulos de foco;
- recursos de Companion Sync, modo imersivo e Nexus Local das versões anteriores continuam disponíveis.

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
