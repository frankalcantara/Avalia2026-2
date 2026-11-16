# Projeto #7: Jogo da Memória Temático

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Julia Letícia Ribeiro de Paula
- **Turma:** 2A
- **Chave Única:** `P26-2A-A113-CCFD-DC47-AC0A`
- **URL_CLOUDFLARE:** `https://p26-2a-a113-ccfd-dc47-ac0a.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## O Jogo

**Código ↔ Saída:** o jogador vira duas cartas por vez e deve combinar cada trecho de código JavaScript com o valor que ele produz (8 pares por partida, sorteados de um banco de 12).

- O embaralhamento acontece no servidor (`crypto.getRandomValues`); o navegador recebe só tokens opacos.
- Cada par de cartas é conferido pelo servidor (`POST /api/game/pick`), que incrementa os movimentos no Cloudflare D1.
- Ao descobrir todos os pares, a eficiência (pares ÷ movimentos × 100) é gravada e entra no ranking.
- Login obrigatório via Discord OAuth2 (`user_id`, nome e avatar no cabeçalho). Sessão em cookie assinado com HMAC.

## Estrutura

```
public/                 interface (HTML5, CSS3, JS puro)
functions/api/          Cloudflare Pages Functions (auth, me, game/*, status)
functions/_lib/         utilitários (sessão assinada, sorteio, pares)
migrations/             esquema do D1
skills/ e AGENTS.md     agentes, harness e skills
tests/run-tests.mjs     suíte do agente de teste
```

## Rodar localmente

```powershell
cd P26-2A-A113-CCFD-DC47-AC0A
copy .dev.vars.example .dev.vars        # preencha DISCORD_CLIENT_SECRET e SESSION_SECRET
wrangler d1 migrations apply DB --local
wrangler pages dev --port 8788
```

Abra http://localhost:8788. Redirect do Discord: `http://localhost:8788/api/auth/discord/callback`.

## Testes

```powershell
node tests/run-tests.mjs
```

## Publicar no Cloudflare Pages + D1

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, escolha o fork. Nome do projeto: `p26-2a-a113-ccfd-dc47-ac0a`.
2. Root directory: `P26-2A-A113-CCFD-DC47-AC0A`. Build command: vazio. Build output directory: `public`.
3. Aplique as migrações no banco remoto: `wrangler d1 migrations apply DB --remote`.
4. Em **Settings → Bindings** (ou Functions), adicione o D1 com variável `DB` apontando para `db-p26-2a-a113-ccfd-dc47-ac0a`.
5. Em **Settings → Variables and Secrets**, crie `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` (como Secret).
6. No Discord Developer Portal, adicione o redirect `https://p26-2a-a113-ccfd-dc47-ac0a.pages.dev/api/auth/discord/callback`.
7. Atualize **URL_CLOUDFLARE** no topo deste arquivo e rode `node validar-local.mjs P26-2A-A113-CCFD-DC47-AC0A` na raiz do repositório.

## Licença

MIT (ver `LICENSE`). Chave Única: `P26-2A-A113-CCFD-DC47-AC0A`.
