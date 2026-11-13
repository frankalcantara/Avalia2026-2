# Projeto #16: Plataforma de Estudos por Flashcards (Repetição Espaçada)

**Chave Única Oficial:** `P26-2B-5901-26E6-F1AD-5F02`
**Aluno:** Kauã Fernando Fuckner · Turma 2B · RA 2026108321
**Licença:** MIT

**URL_CLOUDFLARE:** https://flashcards-p26-2b-5901.pages.dev
**Repositório:** https://github.com/kaua-fuckner/Avalia2026-2

## O que faz
Baralhos de cartões frente e verso. O cartão vira com animação CSS ao clique; depois de virar, aparecem **Difícil**, **Bom** e **Fácil**. A Function `/api/study/review` aplica um SM-2 simplificado e grava a próxima revisão no D1.

## Stack
HTML5, CSS3 e JavaScript puro · Cloudflare Pages Functions · Cloudflare D1 · Discord OAuth2 (`identify`).

## Regras no servidor (anti-manipulação)
- O cliente envia apenas `{card_id, rating}`. Ease, intervalo e `due_at` são calculados na borda.
- Toda query filtra pelo `user_id` da sessão (controle de autoria).
- Um cartão só pode ser avaliado se já estiver vencido; rating fora de `dificil|bom|facil` é rejeitado.
- Sessão em cookie `HttpOnly; Secure; SameSite=Lax` e `state` anti-CSRF no OAuth.
- Fila diária limitada a 50 cartões.

## Algoritmo (SM-2 simplificado)
| Avaliação | 1ª revisão | Demais | Ease |
|---|---|---|---|
| Difícil | 1 dia | volta a 1 dia, zera repetições | −0,2 (mín. 1,3) |
| Bom | 3 dias | intervalo × ease | igual |
| Fácil | 4 dias | intervalo × ease × 1,3 | +0,15 |

## Estrutura
`public/` frontend · `functions/` rotas serverless · `migrations/` esquema D1 · `AGENTS.md` agentes e harness · `skills/` skills usados · `tests/` testes.

## Publicação
```
npx.cmd wrangler d1 create db-p26-2b-5901-26e6-f1ad-5f02
# cole o database_id em wrangler.jsonc
npx.cmd wrangler d1 migrations apply DB --remote
```
Redirect no Discord: `https://flashcards-p26-2b-5901.pages.dev/api/auth/discord/callback`.

## Agentes
Veja [AGENTS.md](AGENTS.md).
