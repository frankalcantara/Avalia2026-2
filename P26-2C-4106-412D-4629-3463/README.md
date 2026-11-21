# Mural de Avisos Departamental por Disciplina

**Chave Única Oficial (Hash): `P26-2C-4106-412D-4629-3463`**

Projeto #18 — Turma 2C. Quadro de comunicados digitais organizado por disciplina. O estudante entra com o Discord, segue as disciplinas que cursa e monta um feed personalizado com avisos, lembretes de entrega e links úteis.

- URL_CLOUDFLARE: https://p26-2c-4106-412d-4629-3463.pages.dev
- Repositório: https://github.com/MatheusPetryk/Avalia2026-2

## O que o sistema faz

- Login obrigatório via **OAuth2 do Discord** (importa `user_id`, nome de usuário e avatar).
- Disciplinas por código (ex.: `ENG-SOFT`); qualquer usuário autenticado cria, segue e deixa de seguir.
- Publicação de **avisos**, **lembretes de entrega** (com data) e **links úteis**.
- Cada postagem guarda `autor_id`, nome público e avatar vindos da sessão OAuth2; o cliente não consegue informar a autoria, então não há postagem anônima.
- Só o autor edita ou remove o próprio aviso (verificado no servidor).
- Cada usuário marca avisos como **lidos** ou **fixados** na própria visão (tabela `estado_aviso`).

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Cliente | HTML5, CSS3 e JavaScript puro (`public/`), sem frameworks de interface |
| Backend | Cloudflare Pages Functions (`functions/`), com validação e regras de negócio no servidor |
| Banco | Cloudflare D1 (`migrations/0001_init.sql`) |
| Autenticação | Discord OAuth2 (authorization code + PKCE S256); sessão opaca em cookie `__Host-session` (só o hash SHA-256 fica no D1) |

Rotas: `GET /api/me`, `GET /api/auth/discord`, `GET /api/auth/discord/callback`, `POST /api/auth/logout`, `GET|POST /api/disciplinas`, `PUT|DELETE /api/inscricoes/:codigo`, `GET|POST /api/avisos`, `PATCH|DELETE /api/avisos/:id`, `PUT /api/avisos/:id/estado`.

Segurança: Content-Security-Policy restritiva (`public/_headers`), checagem de `Origin` em toda escrita (CSRF), saída no DOM só com `textContent`, SQL parametrizado.

## Testes

```bash
npm test                                                        # validação + fluxo completo da API (D1 simulado)
node tests/smoke.mjs https://p26-2c-4106-412d-4629-3463.pages.dev   # site publicado
```

## Agentes

Veja [`AGENTS.md`](AGENTS.md) (agentes, harness e registro de uso) e a pasta [`skills/`](skills/).

## Licença

MIT — veja [`LICENSE`](LICENSE).
