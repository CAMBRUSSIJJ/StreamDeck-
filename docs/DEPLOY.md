# Deploy, instalação e uso — Nexus Deck v1.1

## Windows — caminho recomendado

1. Execute `NexusDeck-Setup-v1.4.0.exe`.
2. Confirme a instalação.
3. O Companion será instalado em `%LOCALAPPDATA%\\Programs\\NexusDeck`.
4. O Companion iniciará e abrirá `http://127.0.0.1:38473`.
5. O startup com Windows fica ativado por padrão e pode ser desligado no painel.
6. O ícone da bandeja permite reabrir o painel, abrir o Deck local ou encerrar.

Também existe um executável portátil do Companion para quem não quiser instalar.

## Modo local sem Supabase

1. No painel do Windows, copie o endereço LAN, por exemplo `http://192.168.1.20:38474`.
2. No iPad conectado ao mesmo Wi‑Fi, abra esse endereço no Safari.
3. Clique em **Gerar código local** no Windows.
4. No iPad, toque no status do PC e informe o código de 6 dígitos.
5. O status deve mudar para Online/Local.

Na primeira execução, permita o Companion no Firewall apenas para **redes privadas**. Se o iPad não abrir a porta 38474, use **Saúde do Nexus → Executar diagnóstico** no painel do Windows.

## Interface Vercel

1. Envie o repositório para o GitHub.
2. Importe no Vercel.
3. Defina **Root Directory** como `apps/deck`.
4. Use **Framework Preset: Other**.
5. Deixe Build Command e Output Directory sem override.

## Transferir layout Vercel ↔ Local

Em Ajustes, use **Exportar deck** e **Importar deck**. A V1.4 usa Backup V2 com verificação de integridade e preview da quantidade de páginas, controles, macros e perfis. Dispositivos pareados permanecem no iPad e não são substituídos.

## Diagnóstico

- Windows: painel `127.0.0.1:38473` → **Saúde do Nexus**.
- iPad: Ajustes → Conectividade → **Diagnóstico rápido**.

Ambos podem exportar relatórios sem incluir chaves ou senhas.
