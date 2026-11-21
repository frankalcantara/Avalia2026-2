# Batalha Naval Tático

Jogo de Batalha Naval (malha 10x10) com HTML, CSS e JavaScript puro, login via Discord OAuth2, Cloudflare Pages Functions e Cloudflare D1.

**Chave de auditoria:** `P26-2B-1768-7598-7D8E-716E`

Aluno: Lucas Carneiro Schuindt · Turma 2B · RA 2026108691

## Como funciona
- O servidor valida o posicionamento da frota e processa todos os tiros.
- A frota inimiga é gerada e guardada no servidor e nunca é enviada ao cliente durante a partida.
- A API responde apenas `agua`, `acerto` ou `afundado`.

## Configuração no Cloudflare
- Build output directory: `public`
- Binding D1 com nome `DB`
- Variáveis: `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (secret)
- URL_CLOUDFLARE:** `https://avalia2026-2-6bv.pages.dev`

## Licença
MIT
