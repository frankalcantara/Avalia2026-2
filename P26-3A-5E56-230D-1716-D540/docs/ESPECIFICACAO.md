# Especificação — Vitrine de Achados e Perdidos do Campus (Projeto #34)

Chave: `P26-3A-5E56-230D-1716-D540`

Este é o **contrato único** entre os agentes. O back-end implementa exatamente estas rotas e
regras; o front-end consome exatamente estas rotas; o agente de teste valida exatamente estas
regras. Qualquer mudança no contrato precisa ser feita **aqui primeiro**.

## 1. Domínio

- **Item**: um objeto que alguém **perdeu** (`tipo = "perdi"`) ou **encontrou** (`tipo = "encontrei"`).
- **Categorias** (fechadas): `eletronicos`, `documentos`, `garrafas`, `vestuario`.
- **Status do item**: `aberto` → `em_devolucao` → `encerrado`.
- **Reivindicação**: um usuário diz "esse item é meu" (para `encontrei`) ou "eu encontrei o seu"
  (para `perdi`). Status: `pendente`, `aceita`, `recusada`, `cancelada`, `concluida`.
- **Contato**: o *username* do Discord de cada parte. É gravado **nas duas pontas da reivindicação**
  (`contato_autor` e `contato_reivindicante`) no momento em que ela é criada, e só é mostrado às
  duas partes envolvidas.

## 2. Banco (Cloudflare D1 / SQLite)

Tabelas: `usuarios`, `sessoes`, `itens`, `reivindicacoes` (ver `migrations/`).

- `usuarios(user_id TEXT PK, username, nome_exibicao, avatar_url, criado_em, atualizado_em)`
- `sessoes(token_hash TEXT PK, user_id FK, criado_em, expira_em)` — guarda **SHA-256** do token, nunca o token.
- `itens(id INTEGER PK, autor_id FK, tipo, categoria, titulo, descricao, local, data_ocorrencia, status, criado_em, atualizado_em, encerrado_em)`
- `reivindicacoes(id INTEGER PK, item_id FK, reivindicante_id FK, mensagem, status, contato_autor, contato_reivindicante, criado_em, atualizado_em)`
- CHECKs no banco para `tipo`, `categoria`, `status` e tamanhos; índice único parcial impede
  duas reivindicações **ativas** (`pendente`/`aceita`) do mesmo usuário no mesmo item.

## 3. Autenticação (Discord OAuth2)

- `GET /api/auth/discord` → gera `state` aleatório, grava no cookie `oauth_state` (HttpOnly, Secure,
  SameSite=Lax, 10 min) e redireciona para `https://discord.com/oauth2/authorize` com `scope=identify`.
- `GET /api/auth/discord/callback?code&state` → confere `state` (tempo constante), troca o `code`,
  busca `/users/@me`, faz *upsert* em `usuarios` (`user_id`, `username`, `global_name`, avatar),
  cria sessão (token aleatório de 32 bytes; grava o hash) e define o cookie `sessao`
  (HttpOnly, Secure, SameSite=Lax, Path=/, 7 dias). Redireciona para `/?login=ok`.
  Erros redirecionam para `/?erro_login=<codigo>`.
- `POST /api/auth/logout` → apaga a sessão no D1 e expira o cookie.
- `GET /api/me` → `200 { usuario: {user_id, username, nome_exibicao, avatar_url} | null }`.

## 4. API de negócio (JSON)

Todas as respostas são JSON. Erro: `{ "erro": "<codigo>", "mensagem": "<texto pt-BR>" }`.
Códigos: `400` dados inválidos · `401` não logado · `403` sem permissão · `404` não existe ·
`409` conflito de estado · `415` content-type errado · `429` limite de criação.

| Método e rota | Quem | O que faz |
|---|---|---|
| `GET /api/itens` | público | lista com filtros cruzados |
| `POST /api/itens` | logado | cadastra item |
| `GET /api/itens/:id` | público | detalhe; autor vê reivindicações recebidas, reivindicante vê a sua |
| `DELETE /api/itens/:id` | autor | apaga, só se `aberto` e sem reivindicação `aceita` |
| `POST /api/itens/:id/encerrar` | autor, ou reivindicante com reivindicação `aceita` | encerra o caso |
| `POST /api/itens/:id/reivindicacoes` | logado, não autor | abre reivindicação |
| `GET /api/reivindicacoes` | logado | `{ feitas: [...], recebidas: [...] }` |
| `POST /api/reivindicacoes/:id/aceitar` | autor do item | aceita; item vira `em_devolucao` |
| `POST /api/reivindicacoes/:id/recusar` | autor do item | recusa uma `pendente` |
| `POST /api/reivindicacoes/:id/cancelar` | reivindicante (`pendente`/`aceita`) ou autor (`aceita`) | cancela; se era a aceita, item volta a `aberto` |
| `GET /api/status` | público | saúde (D1 ok, OAuth configurado) |

### 4.1 `GET /api/itens` — filtros (todos opcionais e combináveis)
`tipo`, `categoria`, `status` (padrão: todos menos `encerrado`; `status=todos` inclui encerrados),
`q` (busca em título/descrição/local, até 60 chars), `local` (contém), `de` e `ate` (`YYYY-MM-DD`
sobre `data_ocorrencia`), `meus=1` (só do usuário logado), `ordem` (`recentes` | `antigos`),
`pagina` (1..), `por_pagina` (1..50, padrão 12).
Resposta: `{ itens: [Item], total, pagina, por_pagina, contagens: { por_categoria: {...}, por_tipo: {...} } }`.
Valor de filtro inválido → `400`.

`Item` = `{ id, tipo, categoria, titulo, descricao, local, data_ocorrencia, status, criado_em,
encerrado_em, autor: { user_id, username, nome_exibicao, avatar_url }, total_reivindicacoes }`.

### 4.2 Validação de `POST /api/itens` (servidor é a fonte da verdade)
- `tipo` ∈ {perdi, encontrei}; `categoria` ∈ categorias.
- `titulo` 3–80 chars; `descricao` 10–1000; `local` 3–120 (texto, sem controle de caractere).
- `data_ocorrencia` `YYYY-MM-DD` válida, **não futura** e **não anterior a 1 ano**.
- Strings são `trim()` e têm caracteres de controle removidos. Campos extras são ignorados.
- Limite: no máximo **10 itens por usuário por hora** → `429`.

### 4.3 Regras de reivindicação
- Não pode reivindicar o próprio item → `403`.
- Item precisa estar `aberto` → `409`.
- Uma reivindicação ativa por usuário por item → `409`.
- `mensagem` 10–500 chars.
- Ao criar, grava `contato_autor` = username do autor e `contato_reivindicante` = username do reivindicante.
- Aceitar: só `pendente`, item `aberto`; reivindicação → `aceita`, item → `em_devolucao`.
- Encerrar: item `em_devolucao` → `encerrado`, reivindicação aceita → `concluida`, demais `pendente` → `recusada`.
  O autor também pode encerrar um item `aberto` sem reivindicação (ex.: resolveu por fora).
- Os contatos (`contato_autor`, `contato_reivindicante`) só aparecem nas respostas para as duas partes.

## 5. Segurança (obrigatório)
- Toda requisição que **altera estado** (`POST`/`DELETE`) exige `Origin` igual à origem do site
  (CSRF) e, quando tem corpo, `Content-Type: application/json` (senão `415`).
- Corpo limitado a 8 KB.
- SQL sempre com `prepare().bind()` — nunca concatenação.
- Front-end: dados de usuário só entram no DOM por `textContent`/atributos — **nunca `innerHTML`** com dado do servidor.
- Cabeçalhos: CSP restrita (`default-src 'self'`, imagens de `cdn.discordapp.com`), `X-Content-Type-Options`,
  `Referrer-Policy`, `frame-ancestors 'none'`, `Permissions-Policy`, HSTS.
- Segredos (`DISCORD_CLIENT_SECRET`) só como *secret* do Cloudflare Pages; nunca no repositório.

## 6. Decisões de implementação (registradas pelo Agente Programador Back-end)

1. Middleware em `functions/api/_middleware.js` (só `/api/*`): CSRF por `Origin`, `415` para corpo não-JSON,
   **`413 corpo_grande`** acima de 8 KB, `500 interno` genérico, `405` para método errado, `404` JSON para rota inexistente.
2. Sessão: hash = SHA-256 (hex minúsculo) dos bytes UTF-8 do token; cookie aceita `[A-Za-z0-9_-]{16,128}`.
3. Erro `400` traz também `campos: { campo: "mensagem" }`. Id não numérico → `400`; inexistente → `404`.
4. Texto: `\t\n\r` viram espaço, demais controles e caracteres bidi removidos; tamanho em *code points*.
   "Hoje" = data em `America/Sao_Paulo`; intervalo aceito [hoje − 1 ano, hoje].
5. Filtros: valor vazio = ausente; `q` > 60 → `400`; `de > ate` → `400`; `meus=1` sem login → `401`;
   `contagens` aplicam os filtros antes da paginação; `total_reivindicacoes` ignora `cancelada`.
   Tetos de entrada: `pagina` 1..10000 e `local` (filtro) até 120 caracteres — acima disso → `400`.
6. `GET /api/itens/:id` → `{ item, reivindicacoes, permissoes: { eh_autor, pode_reivindicar, pode_encerrar, pode_apagar } }`.
   Criar → `201 { item }` / `201 { reivindicacao }`; aceitar/recusar/cancelar → `{ reivindicacao, item }`;
   encerrar → `{ item }`; DELETE e logout → `{ ok: true }`.
7. Encerrar item `aberto` só pelo autor e só sem reivindicação `pendente` (senão `409`).
8. Limite de 10/h: contagem + inserção numa única instrução (sem corrida).
9. Dois índices únicos parciais: 1 reivindicação ativa por usuário/item e 1 `aceita` por item.
10. OAuth: cookie `oauth_state` com `Path=/api/auth/discord`, sempre expirado no callback; login apaga a sessão anterior.
    Erros: `negado`, `state_invalido`, `oauth_nao_configurado`, `troca_falhou`, `perfil_falhou`, `interno`.
11. (Auditoria de segurança) No máximo **5 reivindicações por usuário no mesmo item** (qualquer status, inclusive
    `cancelada`) → `429 limite_excedido`; checado na mesma instrução do INSERT. O resumo `item` dentro de cada
    reivindicação traz também `autor: { user_id, username, nome_exibicao, avatar_url }` (mesmos campos públicos de `Item.autor`).
