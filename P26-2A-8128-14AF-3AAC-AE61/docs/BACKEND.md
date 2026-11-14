# Backend do EntreLivros

O Agente 1 (`backend_d1_discord`) implementou este backend no harness Codex, usando a skill `skills/serverless-d1-discord/SKILL.md` e o contrato compartilhado em `docs/CONTRATO-API.md`.

## Estrutura

As Cloudflare Pages Functions em `functions/api/` chamam `lib/router.js`. A separação mantém autenticação, catálogo e pedidos em módulos pequenos. O frontend recebe JSON; nenhuma regra de permissão depende da interface.

A migração `migrations/0001_init.sql` cria usuários, sessões, states OAuth, livros, pedidos e travas de exemplares no D1. Não há dados de demonstração nem um modo alternativo de login.

## Autenticação

O login utiliza o fluxo authorization code do Discord com escopo `identify`. O perfil mantém `user_id`, handle `username`, `display_name` e URL do avatar. O token do Discord é utilizado apenas para consultar o perfil; não é enviado ao navegador nem persistido.

O state tem 256 bits aleatórios, validade de dez minutos, cookie HttpOnly e hash no D1. O callback exige cookie e query correspondentes, consumindo o registro com `DELETE RETURNING`, antes da troca de código. Uma sessão usa outro token de 256 bits, validade de sete dias e apenas seu SHA-256 armazenado no banco. Os cookies usam SameSite=Lax e Secure em HTTPS. Logout revoga a sessão no D1. Mutações exigem Origin exato e corpo JSON.

## Consistência

Um pedido é criado em uma única instrução SQL. Os triggers verificam disponibilidade e titularidade, criam uma trava única por exemplar e atualizam os estados. Se o segundo livro de uma troca não puder ser reservado, toda a instrução é revertida. Isso também impede um exemplar de estar simultaneamente em uma troca e em um empréstimo.

Transições usam atualização condicional pelo estado anterior. Os triggers atualizam estados, transferem a titularidade de ambos os livros em trocas concluídas e removem as travas no término. Pedidos preservam proprietário e solicitante originais. Exclusão de livros é lógica; livros ocupados não podem ser editados nem removidos.

Empréstimos exigem uma data válida posterior ao dia atual em São Paulo, até 365 dias. Títulos e autores têm até 200 caracteres, descrições 1200, mensagens 800 e corpos JSON 16 KiB.

## Referências consultadas

- [Cloudflare D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/): prepared statements e execução de batch transacional.
- [Cloudflare Pages Functions Routing](https://developers.cloudflare.com/pages/functions/routing/): rotas baseadas em arquivos.
- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2): authorization code, identify, state e endpoints oficiais.

O Agente 3 escreveu a suíte de integração; o agente principal concluiu sua execução e os ajustes do harness, conforme AGENTS.md. A publicação e o login real no Discord foram confirmados em 13/11/2026. Os ciclos entre dois usuários passaram nos testes locais com D1; o ensaio presencial com duas contas reais continua recomendado.
