# Nexus Deck v1.4.0 — iPad / Mobile First

A V1.4 transforma o iPad no ambiente principal de uso do Nexus Deck. A interface web continua funcionando no Vercel e no desktop, mas dispositivos touch recebem uma experiência própria de **control surface**, com comportamento mais próximo de um aplicativo dedicado.

## Mobile First

- grade independente por orientação: configuração própria para iPad vertical e horizontal;
- escala das teclas: compacta, normal ou grande;
- swipe horizontal para trocar de página;
- long press em uma tecla para entrar na edição e abrir suas propriedades;
- bloqueio de edição para uso diário sem mudanças acidentais;
- modo controle imersivo, reduzindo cabeçalhos e elementos de configuração;
- diálogos e editor em **bottom sheet** no iPad;
- safe areas, PWA standalone e layout otimizado para Tela de Início;
- navegação inferior compacta e teclas dimensionadas especificamente para toque;
- preferências mobile preservadas no Backup V2.

## Fundação preservada

Nexus Local, Companion Windows, macros, perfis inteligentes, integrações profissionais, Layout Engine, biblioteca de ícones, diagnóstico, backup, tray e instalador continuam disponíveis.

## Uso local sem Supabase

1. Instale o Nexus Companion no Windows.
2. PC e iPad devem estar na mesma rede privada.
3. Abra no Safari do iPad o endereço `http://IP-DO-PC:38474` mostrado pelo Companion.
4. Gere o código de pareamento no Windows e informe no iPad.
5. Opcionalmente use **Compartilhar → Adicionar à Tela de Início** para abrir em modo standalone.

Supabase é opcional e não participa do modo Nexus Local.

## Vercel

- **Root Directory:** `apps/deck`
- **Framework Preset:** Other
- **Build Command:** desativado
- **Output Directory:** desativado

## Qualidade

```bash
npm run check
npm run sync:local-deck
cd apps/companion
go test ./...
go vet ./...
```
