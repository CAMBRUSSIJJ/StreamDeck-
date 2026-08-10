# Nexus Deck v0.2.0

Nexus Deck transforma um iPad em um painel de controle remoto para Windows.

## Arquitetura

- **Deck (iPad):** PWA estática, otimizada para Safari/iPadOS e hospedável no Vercel.
- **Companion (Windows):** binário único em Go, sem runtime adicional.
- **Transporte:** Supabase Realtime Broadcast.
- **Segurança:** pareamento ECDH P-256 + HKDF-SHA256 e tráfego de comandos com AES-256-GCM.
- **Repositório:** pronto para GitHub Actions e Vercel.

## Fluxo

1. Crie um projeto Supabase.
2. No Vercel, configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` para o projeto em `apps/deck`.
3. Compile ou baixe o Companion gerado pelo GitHub Actions.
4. No Companion, informe a mesma URL e chave pública do Supabase.
5. Clique em **Iniciar pareamento** no Companion.
6. No iPad, abra **Dispositivos > Parear PC**, informe o código de 6 dígitos e conclua o pareamento.
7. Adicione a PWA à Tela de Início do iPad.

## Desenvolvimento local

### Painel web

O Deck é estático e não possui dependências de runtime. Para servir localmente:

```bash
cd apps/deck
python -m http.server 4173
```

Para conexão real ao Supabase em desenvolvimento, crie `apps/deck/api/config.local.json` com os mesmos campos do exemplo e use um servidor que encaminhe `/api/config` ou publique no Vercel.

### Companion

```bash
cd apps/companion
go test ./...
go run ./cmd/nexus-deck
```

O Companion abre o painel local em `http://127.0.0.1:38473`.

### Build Windows sem dependências externas

```bash
cd apps/companion
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o ../../dist/NexusDeck-Companion.exe ./cmd/nexus-deck
```

## GitHub + Vercel

- Envie este diretório para um repositório GitHub.
- No Vercel, importe o repositório e escolha `apps/deck` como **Root Directory**.
- Adicione as duas variáveis de ambiente.
- O arquivo `vercel.json` já contém os cabeçalhos e rotas necessários.
- O workflow `.github/workflows/ci.yml` testa o painel e o Companion e gera o `.exe` do Windows como artefato.

## Escopo da v0.2

- PWA para iPad, instalável na Tela de Início.
- Interface responsiva touch-first.
- Pareamento de 6 dígitos com ECDH.
- Persistência de dispositivos e decks no navegador.
- Comandos criptografados por dispositivo.
- Abertura de URL/aplicativo.
- Hotkeys e controles de mídia no Windows.
- Acknowledgement de comandos e status online/offline.
- Companion com painel administrativo local.
- CI de testes + build Windows.

## Segurança

O Deck nunca envia comandos de shell arbitrários. O Companion valida tipos de ação e executa apenas ações suportadas. A chave pública `anon` do Supabase é tratada como configuração pública; o segredo real do dispositivo é criado no pareamento e fica somente no iPad e no PC.

Veja `SECURITY.md` para detalhes e limitações.
