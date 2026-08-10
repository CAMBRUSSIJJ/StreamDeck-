# Deploy da interface do Nexus Deck

## Vercel

A interface do iPad não depende de Supabase para abrir, editar páginas ou personalizar controles.

1. Envie o repositório para o GitHub.
2. Importe o repositório no Vercel.
3. Configure **Root Directory** como `apps/deck`.
4. Use **Framework Preset: Other**.
5. Deixe **Build Command** e **Output Directory** sem override.
6. Faça o deploy.

## Atualizações

Quando o repositório estiver conectado ao Vercel, um push para a branch configurada cria um novo deployment automaticamente.

## Integração com PC

A V0.5 mantém a fundação anterior de conexão, mas a interface e o editor funcionam sem configuração de cloud. O modo local será tratado como camada independente nas próximas versões.
