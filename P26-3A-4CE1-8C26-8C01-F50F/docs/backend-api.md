# Backend do Bookmark Manager — Etapa 2

## Agentes e harness

Os três agentes operaram no harness Codex, dentro da pasta do projeto. O identificador
exato do modelo herdado pela sessão não foi disponibilizado e não foi inferido.

| Agente | Responsabilidade nesta etapa | Skill |
| --- | --- | --- |
| `/root` — Agente 1 | Arquitetura, implementação das rotas, validação e consultas D1 | [serverless-d1-discord](../skills/serverless-d1-discord/SKILL.md) |
| `/root/review_auth_contract` — Agente 2 | Revisão independente dos contratos e compatibilidade com a interface existente | [vanilla-dom-ui](../skills/vanilla-dom-ui/SKILL.md) |
| `/root/validate_auth` — Agente 3 | Criação dos testes em memória, execução e auditoria de propriedade dos dados | [teste-validacao](../skills/teste-validacao/SKILL.md) |

As migrações 0001/0002, `lib/auth.js`, o middleware de sessão e as rotas de
autenticação foram preservados. As novas rotas usam `context.data.user`.

## Contratos

| Caminho | Métodos |
| --- | --- |
| `/api/collections` | GET, POST |
| `/api/collections/:id` | GET, PATCH, DELETE |
| `/api/bookmarks` | GET, POST |
| `/api/bookmarks/:id` | GET, PATCH, DELETE |
| `/api/public/collections/:id` | GET |
| `/api/public/collections/:id/bookmarks` | GET |

Sucesso: `{data: ...}`; listagens: `{data: [...]}`; exclusão: 204 sem corpo.
Erro: `{error: {code, message, fields?}}`. Métodos não permitidos retornam 405 e
`Allow`. Todas as respostas novas usam `Cache-Control: no-store`.

Coleção: `name`, `is_public` opcional, privada por padrão.
Link: `url`, `title`, `collection_id`, `summary` opcional (padrão vazio), `status`
opcional (padrão `para_ler`). Status permitidos: `para_ler`, `lendo`, `concluido`.
PATCH aceita apenas os campos editáveis e exige ao menos um campo.

GET de links privados aceita `collection_id`, `status` e `limit`; os filtros são
combinados por AND. GET público de links aceita `status` e `limit`. O limite padrão
é 100, aceitando inteiros de 1 a 100, sem cursor ou offset. A ordenação é
`created_at DESC, id DESC`. As coleções privadas são listadas somente para seu dono.

O corpo JSON de POST/PATCH tem limite real de 32768 bytes, inclusive em streaming.
Nome, título e URL recebem trim; URLs exigem http/https absoluto sem credenciais.
IDs de entidades são gerados pelo servidor; IDs de referência devem ser UUIDs.
Identidade e timestamps do cliente são rejeitados. Origin externo em escrita é
rejeitado pelo helper da autenticação existente. Campos e parâmetros desconhecidos
são rejeitados; `is_public` exige booleano JSON.

## SQL e propriedade

Valores externos são passados exclusivamente por `prepare(...).bind(...)`.
As colunas de PATCH e as condições opcionais são construídas a partir de listas
permitidas no servidor. IDs e `updated_at` são definidos pelo servidor.

| Consulta de produção | Controle de propriedade ou publicação |
| --- | --- |
| INSERT de coleção | `user_id` vem exclusivamente de `context.data.user.user_id` |
| SELECT de coleções | `WHERE user_id = ?` |
| SELECT de uma coleção | `WHERE id = ? AND user_id = ?` |
| UPDATE de coleção | `WHERE id = ? AND user_id = ?` |
| DELETE de coleção | `WHERE id = ? AND user_id = ?`; FK impede exclusão não vazia (409) |
| SELECT da coleção usada como filtro | `WHERE id = ? AND user_id = ?`; coleção alheia/inexistente dá 404 |
| INSERT de link por SELECT | `WHERE c.id = ? AND c.user_id = ?`; proprietário e coleção são obtidos da linha autorizada |
| SELECT de links | `WHERE user_id = ?`, com `AND collection_id = ?` e/ou `AND status = ?` |
| SELECT de um link | `WHERE id = ? AND user_id = ?` |
| UPDATE de link | `WHERE id = ? AND user_id = ?`; mudança de coleção adiciona `EXISTS (... c.id = ? AND c.user_id = bookmarks.user_id)` |
| DELETE de link | `WHERE id = ? AND user_id = ?` |
| SELECT de coleção pública | `WHERE id = ? AND is_public = 1` |
| SELECT de links públicos | `WHERE c.id = ? AND c.is_public = 1`; JOIN exige `b.collection_id = c.id AND b.user_id = c.user_id` |
| COUNT de diagnósticos em GET `/api/status` | Agregado público, sem leitura ou retorno de registros pessoais |

INSERT/UPDATE/DELETE usam RETURNING para devolver o resultado do próprio comando.
As verificações de propriedade de inserção e movimentação de links são atômicas.
A listagem pública usa LEFT JOIN: coleção privada/inexistente não retorna linhas
(404); coleção pública sem links compatíveis retorna `{data: []}`. O filtro de
status fica no ON, preservando essa distinção. DTOs não incluem dados do dono.

## Diagnóstico e validação

O validador `../validar-local.mjs` foi apenas lido. Ele não exige os dados pessoais
do GET de status. Todos os campos existentes do GET foram mantidos, mas
`sessionUser` é sempre null e `ultimosRegistros` é sempre uma lista vazia.
A leitura do cookie legado e a consulta dos registros pessoais foram removidas.
O POST de status permanece com o contrato da Etapa 1. A interface existente ainda
usa o perfil demonstrativo e mostra a lista de diagnósticos vazia.

Comando executado pelo agente de validação:

```text
node --test tests/*.test.mjs
```

Resultado: 38 testes aprovados (23 de API e 15 de autenticação), sem falhas.
SQLite roda exclusivamente em memória; o Discord é simulado nos testes de login.
Os testes cobrem isolamento entre usuários, filtros combinados, criação e
movimentação não autorizadas, publicação/revogação, validações e limites HTTP,
SQL parametrizado e ausência de dados pessoais no diagnóstico público.
Nenhuma migração foi aplicada e nenhum deploy foi executado nesta etapa.
