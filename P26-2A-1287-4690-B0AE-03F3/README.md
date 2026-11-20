# Kudos Board — Mural de Reconhecimento

**Projeto #29** · Turma 2A · Bruno Augusto · RA 2026107709

> **Chave Única Oficial (Hash): `P26-2A-1287-4690-B0AE-03F3`**

Aplicação para enviar mensagens públicas de agradecimento e reconhecimento entre membros de equipes de desenvolvimento.
Login via **Discord OAuth2**, cartões gravados no **Cloudflare D1** e exibidos em grade (CSS columns/masonry).

- **URL do projeto (Cloudflare Pages):** https://p26-2a-1287-4690-b0ae-03f3.pages.dev
- **Repositório:** _(preencher)_
- **Licença:** MIT (veja `LICENSE`)

## Funcionalidades
- Login exclusivo com Discord (importa `user_id`, nome de usuário e avatar).
- Escolher colega, selo visual (ex.: "Resolveu um Bug Crítico", "Ótima Explicação", "Ajuda no Projeto") e escrever mensagem de até 280 caracteres.
- Mural em grade na página principal.
- Filtros: todos, recebidos ou enviados por um perfil específico.
- **Regra no servidor:** não é possível enviar elogio para o próprio ID do Discord (validação na Function + `CHECK` no banco). O remetente vem sempre da sessão.

## Stack
| Camada | Tecnologia |
|---|---|
| Cliente | HTML5, CSS3, JavaScript puro (sem frameworks) |
| Backend | Cloudflare Pages Functions (`functions/`) |
| Banco | Cloudflare D1 (`migrations/`) |
| Auth | Discord OAuth2 (escopo `identify`), sessão por cookie HttpOnly |
| Testes | `node --test` com D1 simulado em `node:sqlite` |

## Estrutura
```
public/        interface (index.html, css/, js/)
functions/     API serverless (api/*, _lib/*)
migrations/    schema D1
tests/         testes automatizados
docs/          API.md, DEPLOY.md, RELATORIO-QA.md
agents/ skills/ AGENTS.md   agentes, skills e documentação de harness
```

## Como rodar e publicar
Veja [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Agentes de IA
O desenvolvimento usou 3 agentes (backend, frontend e teste/validação). Detalhes, harness e skills em [`AGENTS.md`](AGENTS.md).

## Testes
```bash
npm test
```

---
Chave Única: `P26-2A-1287-4690-B0AE-03F3` · © 2026 Bruno Augusto · MIT
