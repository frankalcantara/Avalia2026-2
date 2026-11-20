# Contexto: deploy do Cloudflare Pages e o erro de UUID do D1

Registro do problema que derrubava a publicação das Pages Functions e da solução aplicada.

## O erro

```text
Error: Failed to publish your Function.
Error 8000022: Invalid database UUID (00000000-0000-0000-0000-000000000000).
```

Os assets eram publicados, mas as Functions falhavam. O UUID zero era o marcador deixado no `wrangler.jsonc`; em outros commits o arquivo tinha um UUID real de outra conta. Em ambos os casos, o Cloudflare Pages lia o `d1_databases` do arquivo e validava o `database_id` **a cada deploy**.

## A correção aplicada

- O Wrangler foi **removido do projeto**: não existe mais `wrangler.jsonc` nem `wrangler.local.jsonc`. Sem arquivo de configuração de Wrangler, o Pages usa as configurações de build do painel (root `P26-2B-4D68-AE13-8030-7D10`, build command vazio, output `public`) e não valida UUID nenhum.
- O binding de produção passou a ser configurado no painel: **Pages → Settings → Bindings → Add → D1 database bindings**, variável `DB`.
- O schema do banco ficou documentado em Markdown e em SQL executável: [schema-d1-e-orientacoes.md](./schema-d1-e-orientacoes.md) e [`../schema.sql`](../schema.sql). As tabelas são criadas pelo Console do D1.
- Os testes unitários (`npm test`) não dependem de banco nem de ferramenta de deploy: o D1 é simulado.

## Por que não voltar atrás

Reintroduzir um `wrangler.jsonc` com `database_id` reintroduz exatamente a falha: o valor precisa existir na conta que hospeda o Pages e ser idêntico em todo deploy. A configuração pelo painel elimina essa dependência do repositório.

## Critérios de verificação

- O log de deploy mostra **Assets published** e **Functions published**.
- Nenhum erro `8000022` aparece.
- `GET /api/health` retorna `status: ok` com o binding `DB` criado no painel.
- Se `/api/health` responder `no such table`, falta aplicar o schema no Console do D1 — isso é schema, não UUID.

## Cuidados

- Não leia nem publique `.env`, prints de secrets ou credenciais OAuth do Discord.
- As credenciais do Discord nunca causam o erro de UUID.
- Aplicar comandos no banco remoto altera dados persistentes: faça pelo Console do D1 e com atenção.
