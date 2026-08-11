# Nexus Deck V1.8.0

Nexus Deck transforma o iPad em uma superfície de controle para o Windows. A V1.8 separa definitivamente a interface do componente nativo: **Vercel é a fonte única da UI** e o executável do Windows atua somente como **Nexus Windows Bridge**.

```text
GitHub → Vercel → Nexus Web/PWA no iPad
                    │
                    │ Nexus Relay · WSS
                    ▼
             Nexus Windows Bridge
                    │
                    ▼
                  Windows
```

## V1.8 — Vercel Live UI

- UI única em `apps/deck`, publicada pelo Vercel.
- Atualizações de HTML/CSS/JavaScript, layouts, App Focus e mobile chegam pelo próximo deploy; não exigem reinstalar o Bridge.
- Nexus Relay em WebSocket seguro (`wss://`) no próprio projeto Vercel.
- Pareamento de 6 dígitos entre a interface web e o Windows Bridge.
- Mensagens de dispositivo continuam cifradas pelo protocolo Nexus antes de entrar no relay.
- O Windows Bridge não contém mais uma cópia completa da interface.
- A porta LAN `38474` permanece apenas como fallback/API local e redireciona `/` para a URL oficial do Vercel quando configurada.
- O runtime V1.8 não usa Supabase. Configurações antigas são ignoradas e desaparecem no próximo salvamento; dispositivos pareados podem ser reaproveitados no Nexus Relay.
- Spotify Focus, iPad Mobile First, macros, perfis, widgets e integrações existentes permanecem.

## Estrutura

```text
apps/deck/        Nexus Web/PWA + API/Nexus Relay para Vercel
apps/companion/   Nexus Windows Bridge em Go
packages/         protocolo/documentação compartilhada
docs/             arquitetura e deploy
```

## Deploy web

No Vercel, mantenha o **Root Directory** em `apps/deck`. A V1.8 usa Vite 8 + Nitro 3 para servir a PWA e os endpoints `/api/config` e `/api/relay`.

## Configuração do Windows Bridge

1. Instale e abra o Windows Bridge.
2. Acesse `http://127.0.0.1:38473` no PC.
3. Informe a URL HTTPS do Nexus publicada no Vercel, por exemplo `https://seu-nexus.vercel.app`.
4. Salve e gere um código de pareamento.
5. Abra a URL do Vercel no iPad e informe o código de 6 dígitos em **Computadores**.

Depois do primeiro pareamento, o Bridge reconecta automaticamente. Alterações apenas na UI são entregues pelo Vercel e não pedem um novo `.exe`.

## Quando atualizar o Bridge

Atualize o Windows Bridge somente quando uma release alterar código nativo do Windows, protocolo ou integrações locais — por exemplo áudio, abertura de aplicativos, OBS local, captura de janela ou novas capacidades do sistema.

## Segurança

O Nexus não oferece shell arbitrário. Ações locais são tipadas e allowlisted. Consulte [SECURITY.md](SECURITY.md) para o modelo de transporte, pareamento e fallback local.
