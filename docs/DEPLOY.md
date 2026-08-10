# Deploy: GitHub + Vercel + Supabase

## 1. GitHub

1. Crie um repositório vazio no GitHub.
2. Extraia o ZIP do Nexus Deck.
3. Na raiz do projeto:

```bash
git init
git add .
git commit -m "Nexus Deck v0.2.0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/nexus-deck.git
git push -u origin main
```

O workflow **Nexus Deck CI** executará os testes e disponibilizará o Companion Windows em **Actions > workflow > Artifacts**.

## 2. Supabase

1. Crie um projeto Supabase.
2. Copie o **Project URL**.
3. Copie a chave pública **anon/publishable**.
4. Não use a `service_role` em nenhum dispositivo.

A v0.2 usa somente Realtime Broadcast. Não é necessário criar tabelas.

## 3. Vercel

1. No Vercel, escolha **Add New > Project**.
2. Importe o repositório GitHub.
3. Configure **Root Directory** como `apps/deck`.
4. Framework Preset: **Other**.
5. Não é necessário Build Command.
6. Adicione variáveis:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
7. Faça o deploy.

A URL resultante será semelhante a `https://nexus-deck.vercel.app`.

## 4. Companion Windows

1. Baixe o artefato `NexusDeck-Companion-Windows-x64` do GitHub Actions ou use o `.exe` incluído em `dist`.
2. Execute `NexusDeck-Companion.exe`.
3. O painel abre em `http://127.0.0.1:38473`.
4. Informe o mesmo Project URL e anon/publishable key usados no Vercel.
5. Clique em **Iniciar pareamento**.

## 5. iPad

1. Abra a URL do Vercel no Safari.
2. Toque no indicador de dispositivo > **Parear novo computador**.
3. Digite o código de 6 dígitos do Companion.
4. Após parear, use **Compartilhar > Adicionar à Tela de Início**.

## Atualizações

Alterações enviadas ao GitHub podem ser implantadas automaticamente pelo Vercel quando o repositório estiver conectado ao projeto. O GitHub Actions recompila e retesta o Companion em cada push para a branch principal.
