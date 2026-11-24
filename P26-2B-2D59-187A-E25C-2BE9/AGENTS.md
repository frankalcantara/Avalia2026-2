# Agentes e harness — P26-2B-2D59-187A-E25C-2BE9

## Harness

- **Harness principal:** Copilot SDK no VS Code.
- **Coordenação:** um agente coordenador definiu os contratos HTTP e D1; dois agentes de implementação trabalharam em escopos sem sobreposição (backend e interface), e um terceiro agente independente criou e executou os testes. O coordenador integrou os contratos e conferiu a validação local.
- **Modelos:** os nomes dos modelos dos agentes não são expostos pelo harness neste ambiente; nenhum modelo foi presumido ou atribuído manualmente.
- **Skills do projeto:** as diretrizes em `skills/serverless-d1-discord/SKILL.md`, `skills/vanilla-dom-ui/SKILL.md` e `skills/teste-validacao/SKILL.md` orientam, respectivamente, o backend, a interface e a validação.

## Agentes utilizados

### Agente 1 — Serverless-D1-Discord

- **Responsabilidade:** implementar o OAuth2 do Discord, cookies assinados, rotas das Pages Functions e persistência relacional no D1.
- **Escopo:** `functions/`, `migrations/0001_init.sql` e `wrangler.jsonc`.
- **Skill relacionada:** [serverless-d1-discord](./skills/serverless-d1-discord/SKILL.md).

### Agente 2 — Vanilla-Stock-UI

- **Responsabilidade:** implementar a interface responsiva em HTML5, CSS3 e JavaScript puro, conectada aos contratos das APIs.
- **Escopo:** `public/index.html`, `public/styles.css` e `public/app.js`.
- **Skill relacionada:** [vanilla-dom-ui](./skills/vanilla-dom-ui/SKILL.md).

### Agente 3 — Inventário-QA-Validator

- **Responsabilidade:** criar testes automatizados para sessão OAuth, autorização, validação de payload e movimentações usando mocks locais, sem credenciais ou chamadas externas.
- **Escopo:** `tests/`.
- **Skill relacionada:** [teste-validacao](./skills/teste-validacao/SKILL.md).
- **Validação executada:** treze testes locais passaram; o deploy público permanece pendente de configuração Cloudflare.

## Contratos compartilhados

- `POST /api/auth/register` e `POST /api/auth/login`: cadastro e autenticação por e-mail e senha; a senha é persistida somente como hash com salt.
- `GET /api/auth/me`: perfil da sessão autenticada, seja do Discord ou de uma conta local.
- `GET /api/auth/discord` e `GET /api/auth/discord/callback`: início e retorno do OAuth2 do Discord.
- `GET /api/items`: saldo atual, categoria e limite mínimo dos materiais.
- `POST /api/items`: cadastra um material autenticado; o D1 gera o código numérico e guarda o agente responsável.
- `GET /api/movements`: histórico persistido de movimentações.
- `POST /api/movements`: registra retirada ou devolução; a identidade é extraída da sessão assinada, nunca do payload do navegador.
- `migrations/0002_unified_auth.sql`: unifica contas locais e do Discord e adiciona o agente responsável aos materiais.
- A retirada e o lançamento no ledger são aplicados em lote transacional no D1 para impedir saldo negativo concorrente.
- A verificação do deploy público depende de configurar D1, credenciais OAuth e publicar o Pages; ela não é declarada como concluída por testes locais.
