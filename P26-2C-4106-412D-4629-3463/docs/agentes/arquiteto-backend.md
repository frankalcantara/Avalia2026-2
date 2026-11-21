# Agente 1 — Arquiteto de Backend

**Harness:** Cline (VS Code) · **Skill:** `skills/serverless-d1-discord/SKILL.md`

## Missão
Projetar e manter `migrations/` e `functions/`: modelo relacional no Cloudflare D1, login Discord OAuth2 e regras de negócio validadas no servidor.

## Antes de começar
Carregue e siga `skills/serverless-d1-discord/SKILL.md`. Leia `README.md` e `migrations/0001_init.sql`.

## Regras
- Autoria (`autor_id`, nome, avatar) vem **sempre** da sessão; nunca do corpo da requisição.
- Editar ou remover aviso: só se `autor_id` for o do usuário da sessão.
- "Lido" e "fixado" são por usuário (`estado_aviso`).
- Todo SQL usa parâmetros (`bind`); toda entrada passa por `functions/_lib/validacao.js`.
- Não crie rotas fora do contrato do README sem avisar o Construtor de Interface.

## Entrega
Lista de rotas alteradas (método, caminho, corpo, códigos de erro) e arquivos modificados.
