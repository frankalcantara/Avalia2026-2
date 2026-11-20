# Agentes do Projeto #39

O Codex Cloud é o harness. O coordenador usa agentes especializados do Codex com o modelo herdado da sessão, um checkout compartilhado e atribuição exclusiva de arquivos. Os agentes leem as skills locais antes de implementar e comunicam mudanças no contrato ao coordenador e aos agentes afetados.

Todos trabalham dentro de `P26-2B-924C-3BB5-F4E1-8DAC/`. Push e deploy exigem autorização expressa.

## AUTORIZAÇÃO EXCLUSIVA DO PROPRIETÁRIO

Esta política permanente vincula o Codex, o coordenador, os agentes DevOps, Front-End, Back-End e Tester, seus subagentes e qualquer automação do projeto. É proibido criar, abrir, aprovar ou realizar merge de Pull Requests sem solicitação explícita e específica do proprietário para a respectiva operação.

Somente após a revisão final do projeto pelo proprietário e mediante **nova instrução explícita dele autorizando especificamente a criação do Pull Request final** o Codex poderá criá-lo. A autorização para criar o PR limita-se a essa operação. Aprovação e merge exigem solicitação própria para cada operação. Autorizações anteriores não permitem criar o PR final.

Nenhuma das seguintes situações autoriza a criação ou abertura de um PR:

- Conclusão da implementação.
- Aprovação dos testes.
- Validação oficial do projeto.
- Finalização do deploy.
- Autorização para commit ou push.
- Confirmação de prontidão pelo ChatGPT.
- Solicitação genérica para finalizar ou entregar o projeto.

Antes de usar um comando, ferramenta ou automação capaz de criar um PR, verifique se a revisão final ocorreu e se há a nova autorização específica. Enquanto faltar qualquer uma dessas condições, é proibido acionar a criação, inclusive por delegação. Ao atribuir trabalho, transmita a mesma regra aos subagentes e automações.

## Agente DevOps

Cuida de `wrangler.jsonc`, `README.md`, `.gitignore` da pasta e da [skill DevOps](skills/devops/SKILL.md). Define os comandos locais de Pages e D1 e documenta os bindings e a configuração Discord. Aplica a política acima aos fluxos de commit, push e deploy.

## Agente Front-End

Cuida de `public/` com a [skill de UI Vanilla](skills/vanilla-dom-ui/SKILL.md). Implementa o editor, o dashboard, a visualização em tempo real, a página pública e a impressão em PDF. Ao concluir a interface, segue a política de Pull Requests acima.

## Agente Back-End

Cuida de `functions/` e `migrations/` com a [skill Serverless](skills/serverless-d1-discord/SKILL.md). Implementa OAuth2, sessões, validação e persistência dos currículos no D1. Ao concluir a API ou as migrações, segue a política de Pull Requests acima.

## Agente Tester

Cuida de `tests/` com a [skill de testes](skills/teste-validacao/SKILL.md). Verifica os contratos, a validação, a privacidade e o fluxo no navegador. Reporta falhas ao dono do código para correção. Ao comunicar resultados de testes e validação, segue a política de Pull Requests acima.

## Integração

O coordenador mantém este documento e o [registro de progresso](PROGRESSO.md), revisa a integração e executa o validador oficial. A estrutura gerada é a base da aplicação. A licença, as três skills geradas e a migração inicial são preservadas.

| Rota | Contrato |
| --- | --- |
| `GET /api/auth/discord` e `GET /api/auth/discord/callback` | Login Discord OAuth2, escopo `identify` |
| `GET /api/session` | `{ user: null }` ou `{ user: { id, username, avatar } }` |
| `POST /api/auth/logout` | Encerra a sessão atual |
| `GET /api/resume` | `{ resume }`, com `null` enquanto não houver currículo |
| `PUT /api/resume` | Recebe o currículo completo e devolve `{ resume }` |
| `GET /api/public-resume?user=<id>` | Devolve `{ resume }` se publicado, ou HTTP 404 |

O currículo contém `profile` (nome, título, email, localidade, resumo), `education`, `projects`, `skills`, `links`, `theme`, `colors` e `published`. A publicação é opt-in. A página compartilhada usa `/?user=<id>`. Os erros de API usam `{ error }`. O D1 usa o binding `DB`.
