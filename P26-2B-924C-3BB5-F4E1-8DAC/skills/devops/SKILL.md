---
name: devops-pages-d1
description: Execução local de Cloudflare Pages e D1, configuração de OAuth2 e verificação da entrega.
---

# DevOps para Pages e D1

Trabalhe dentro da pasta oficial P26. Confira o `git status` na raiz e preserve o gerador, o validador e os arquivos dos outros agentes. A configuração versionada usa o binding `DB` e a saída `public`. Mantenha as credenciais em `.dev.vars` no computador local e no ambiente da Cloudflare em produção.

## Execução no Codex Cloud

Direcione os caches e os dados do Wrangler à pasta P26. Use o proxy e os certificados do ambiente para acessar o registro de pacotes.

```sh
mkdir -p .local/{tmp,config,cache,data,state}
export npm_config_cache="$PWD/.npm-cache" TMPDIR="$PWD/.local/tmp"
export XDG_CONFIG_HOME="$PWD/.local/config" XDG_CACHE_HOME="$PWD/.local/cache"
export XDG_DATA_HOME="$PWD/.local/data" XDG_STATE_HOME="$PWD/.local/state"
export WRANGLER_SEND_METRICS=false
npm exec --yes --package=wrangler@4.165.0 -- wrangler d1 migrations apply DB --local
npm exec --yes --package=wrangler@4.165.0 -- wrangler pages dev public --ip 127.0.0.1 --port 8788
```

Verifique a carga da página e as respostas de API com o servidor local. Execute o validador oficial da raiz do fork e registre os resultados observados. Dados em `.wrangler/`, credenciais e caches ficam fora da entrega. Push e deploy exigem autorização explícita. Para o PR final, siga a [política de autorização exclusiva do proprietário](../../AGENTS.md#autorização-exclusiva-do-proprietário).
