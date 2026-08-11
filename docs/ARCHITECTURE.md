# Arquitetura Nexus Deck v1.1

```text
                         ┌────────────────────┐
                         │ Vercel · opcional  │
                         │ preview / edição   │
                         └─────────┬──────────┘
                                   │ backup V2
                                   ▼
┌───────────────────┐       Wi‑Fi / LAN      ┌────────────────────────┐
│ iPad / Safari     │ ◀────────────────────▶ │ Nexus Companion        │
│ Deck local :38474 │                        │ Admin 127.0.0.1:38473 │
└───────────────────┘                        └───────────┬────────────┘
                                                       │
                              ┌────────────────────────┼────────────────────┐
                              ▼                        ▼                    ▼
                         Windows APIs            Integrações          Perfis/estado
                                             OBS / Spotify /       foreground app
                                             Discord / Browser
```

## Processo Windows

A V1.4 usa uma única instância do Companion. Um segundo lançamento detecta o painel em `127.0.0.1:38473`, abre a instância existente e encerra o novo processo.

No Windows, o Companion também cria um ícone de bandeja. O menu oferece:

- Abrir painel administrativo;
- Abrir Nexus Deck local;
- Sair do Companion.

A inicialização automática é registrada em `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run` com o argumento `--background`, evitando abrir o navegador em cada login.

## Serviços

- `127.0.0.1:38473`: painel administrativo e APIs de configuração/diagnóstico.
- `0.0.0.0:38474`: interface do Deck e API de controle; middleware rejeita IPs externos à rede privada/loopback/link-local.

## Pareamento e transporte

- código temporário de 6 dígitos;
- segredo aleatório por dispositivo;
- IDs e timestamps para proteção contra replay;
- AES-256-GCM em contexto seguro;
- fallback LAN autenticado por token para Safari sobre HTTP local.

## Ações e macros

Ações são tipadas e validadas. Não existe ação de shell genérica. Macros aceitam até 20 etapas, atrasos limitados e condições simples, reutilizando as mesmas ações allowlisted.

## Integrações

O `integrations.Manager` isola adaptadores:

```text
Integration Manager
 ├─ OBS Adapter ───── obs-websocket 5.x
 ├─ Spotify Adapter ─ OAuth PKCE + Web API
 ├─ Discord Adapter ─ hotkeys configuráveis
 └─ Browser Adapter ─ hotkeys allowlisted
```

## Diagnóstico V1.4

O painel administrativo testa localmente:

- disponibilidade do painel;
- permissão de escrita no diretório de configuração;
- validade do endereço LAN;
- disponibilidade TCP da porta `38474`;
- presença de iPads autorizados;
- estado da inicialização automática;
- plataforma de execução.

O relatório exportado é sanitizado e não inclui credenciais.

## Backup V2

O backup portátil do iPad contém páginas, controles, macros, perfis e preferências visuais. A V2 inclui checksum para detectar arquivo incompleto/corrompido. Dispositivos, segredos e tokens continuam fora do backup.

## Atualizações

O Companion consulta a release mais recente de `CAMBRUSSIJJ/StreamDeck` pelo GitHub Releases apenas quando o usuário solicita. A V1.4 informa se há versão nova e abre a release; não substitui o executável silenciosamente.
