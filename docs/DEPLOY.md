# Deploy e uso — Nexus Deck V1.8

## 1. Publicar a interface no Vercel

1. Envie a V1.8 para o repositório GitHub.
2. No projeto Vercel, mantenha **Root Directory** como `apps/deck`.
3. A V1.8 contém `package.json`, Vite 8, Nitro 3 e `vercel.json` dentro dessa pasta.
4. O build é `npm run build`.
5. Não configure Supabase.
6. Depois do deploy, confirme que `https://SEU-DOMINIO/api/config` responde com `mode: nexus-relay` e uma `relayUrl` em `wss://`.

O Nexus Relay usa WebSockets do Vercel. O projeto precisa estar com Fluid Compute habilitado para essa capacidade.

## 2. Instalar o Nexus Windows Bridge

1. Execute `NexusDeck-Setup-v1.8.0.exe`.
2. Abra o painel em `http://127.0.0.1:38473`.
3. Em **URL do Nexus no Vercel**, informe exatamente o domínio publicado, por exemplo `https://nexus-exemplo.vercel.app`.
4. Clique em **Salvar**.
5. O Bridge passa a usar `wss://nexus-exemplo.vercel.app/api/relay` automaticamente.

O startup com Windows pode permanecer ativado. O ícone da bandeja abre o painel ou o Nexus oficial.

## 3. Parear o iPad

1. Abra a URL do Vercel no iPad.
2. Opcionalmente use **Compartilhar → Adicionar à Tela de Início**.
3. No Windows Bridge, clique em **Gerar código**.
4. No iPad, abra **Computadores → Parear novo computador**.
5. Digite o código de 6 dígitos.
6. Aguarde o PC aparecer como Online/Nexus Relay.

O primeiro pareamento precisa de internet porque o relay está no Vercel. Depois, o Bridge reconecta automaticamente enquanto a interface e o PC estiverem online.

## 4. Atualizações de UI

Para mudar layout, cores, teclas, editor, App Focus ou comportamento mobile:

```text
GitHub Desktop → Commit → Push origin → Vercel deploy
```

Não reinstale o Windows Bridge por causa de uma alteração exclusivamente web.

## 5. Quando instalar um novo Bridge

Instale uma nova versão do Setup somente quando a release informar mudança em recursos nativos, por exemplo:

- áudio/volume do Windows;
- abertura de aplicações;
- hotkeys;
- foreground app;
- OBS local;
- protocolo/segurança;
- novas capacidades do Windows.

## 6. Porta LAN 38474

A porta `38474` permanece como fallback local. Se você abrir `http://IP-DO-PC:38474/` e o Vercel estiver configurado, o Bridge redirecionará para a URL oficial do Nexus. As APIs `/api/local/*` continuam restritas a redes privadas.

## 7. Diagnóstico

- Windows: `http://127.0.0.1:38473` → **Saúde do Nexus**.
- Web/PWA: Ajustes → Conectividade → diagnóstico.
- Vercel: abra `/api/config` e confirme `configured: true` e `mode: nexus-relay`.

Se o site abrir mas o Bridge não ficar Online, verifique primeiro o deploy do `/api/relay` e se Fluid Compute/WebSockets está habilitado no projeto Vercel.
