# Relatório de QA — Kudos Board

## Resultado final dos testes
Comando: `npm test` (= `node --test tests/*.test.js`) em Node v22.23.5.

- Testes: 36 | Passaram: 36 | Falharam: 0

Arquivos: `tests/kudos.test.js` (regras de negócio, GET/POST, me/users/badges/logout), `tests/auth.test.js`
(OAuth login/callback com `globalThis.fetch` substituído para o Discord), `tests/static.test.js` (auditoria estática),
`tests/helpers/fake-d1.js` (D1 simulado sobre `node:sqlite`, aplica `migrations/0001_init.sql`; prepare/bind/first/all/run com
`meta.last_row_id` e `meta.changes`).

## Cobertura dos casos obrigatórios
Todos cobertos: kudo para si mesmo (400 + CHECK do banco), sem sessão/sessão expirada (401), selo inválido, mensagem vazia e
>280 (400; 280 exatos = 201), remetente forjado ignorado, destinatário inexistente (404), filtros received/sent, OAuth com state
inválido/reutilizado/expirado/ausente, `<script>` guardado como texto puro, cookie (HttpOnly, SameSite, Max-Age, Secure fora de localhost).

## Auditoria estática
- Nenhum `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval` em `public/` e `functions/`: OK.
- Sem frameworks nem scripts externos; `app.js` é Vanilla JS: OK.
- Chave `P26-2A-1287-4690-B0AE-03F3` no `<footer>` de `public/index.html` e em `README.md`: OK.
- `LICENSE` MIT: OK.
- Chamadas fetch de `public/js/app.js` (`/api/me`, `/api/users`, `/api/badges`, `/api/kudos` GET com filter/limit/user/before e POST
  `{to_user_id,badge,message}`, `/api/auth/logout` POST, link `/api/auth/login`) casam com os handlers e com `docs/API.md`: OK.

## Achados
| # | Problema | Arquivo | Correção | Status |
|---|---|---|---|---|
| 1 | `node --test tests/` falha no Node 22 (a pasta é tratada como módulo, "Cannot find module"); além disso não havia `package.json` com `"type": "module"`, necessário para os `import` ESM em Node. | `package.json` (novo) | Criado `package.json` mínimo (`type: module`, sem dependências, script `npm test` usando glob `tests/*.test.js`). Usar `npm test` ou `node --test` sem argumento. | Corrigido |
| 2 | Observação (baixa): o consumo do `state` no callback é SELECT + DELETE, não atômico; duas requisições simultâneas com o mesmo state poderiam ambas passar. Risco prático baixo (precisa do `code` válido do Discord). | `functions/api/auth/callback.js` | Não alterado (fora do mínimo necessário). Sugestão: `DELETE ... RETURNING`. | Aberto (informativo) |
| 3 | Observação (baixa): servidor conta caracteres por code point (`[...text].length`), o `maxlength` do textarea conta unidades UTF-16; emojis podem ser limitados mais cedo no cliente. Não causa erro. | `public/index.html` | Não alterado. | Aberto (informativo) |

Nenhum bug funcional ou de segurança encontrado em `functions/` ou `public/`.

## Limitações
Não foi possível abrir a interface em navegador (renderização, layout responsivo, interações de DOM e acessibilidade não foram
validados visualmente) nem usar o Discord real (o fluxo OAuth foi testado apenas com `fetch` simulado). O D1 é simulado via SQLite local,
não o D1 real da Cloudflare.
