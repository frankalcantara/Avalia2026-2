# Sorteador de equipes e apresentações

Trabalho do Projeto #43 da UniBrasil. O site permite montar equipes e definir a ordem de apresentação de uma turma. O organizador entra com Discord, adiciona os participantes e faz o sorteio.

- Nome — Beatrys Belo de Lira Esteves
- RA — 2026108406
- Turma — 2B
- Chave do projeto — `P26-2B-69DF-2DBB-E2A5-276B`
- **URL_CLOUDFLARE** — https://avalia2026-2-52p.pages.dev/

## Como usar

1. Entre com sua conta do Discord.
2. Crie uma sala e escolha entre equipes ou ordem de apresentação.
3. Digite um nome por linha ou envie o link da sala para os alunos entrarem com Discord.
4. Para equipes, informe o máximo de pessoas por grupo.
5. Confira a lista e clique em Realizar sorteio.

Depois do sorteio, a lista fica fechada. O resultado gera uma ata que pode ser consultada sem login pelo link ou pelo código. Também há uma opção para imprimir ou salvar em PDF.

## Como o sorteio funciona

O embaralhamento usa Fisher–Yates e acontece na Cloudflare Function. No modo de equipes, os participantes são distribuídos de forma equilibrada, respeitando o limite escolhido.

A ata fica salva no D1 com data, hora, participantes, resultado, código e hash SHA-256. O navegador calcula o hash novamente para conferir o conteúdo recebido. As rotas e os gatilhos do banco bloqueiam alterações na ata. Um novo clique no sorteio da mesma sala retorna o resultado já salvo.

Os nomes e IDs do Discord registrados na ata podem ser consultados por quem tiver o link.

## Tecnologias e arquivos

Usei HTML, CSS e JavaScript puro no front-end, Discord OAuth2 para login e Cloudflare Pages Functions com D1 no servidor.

| Pasta | Conteúdo |
| --- | --- |
| `public/` | Página, estilos e JavaScript da interface |
| `functions/` | Login e rotas da API |
| `lib/` | Algoritmo do sorteio e cálculo do hash |
| `migrations/` | Scripts SQL do banco |
| `tests/` | Testes da API e do sorteio |
| `skills/` | Instruções utilizadas pelos agentes |

O trabalho dos três agentes está descrito em [AGENTS.md](./AGENTS.md). Os testes realizados estão em [VALIDACAO.md](./VALIDACAO.md).

## Rodar no computador

Com Node.js 24 ou superior, abra o terminal dentro da pasta `P26-2B-69DF-2DBB-E2A5-276B` e execute:

```powershell
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler pages dev public
```

Abra o endereço mostrado no terminal. Para testar o login local, crie um arquivo `.dev.vars` nesta pasta com:

```text
DISCORD_CLIENT_ID=ID_DA_APLICACAO
DISCORD_CLIENT_SECRET=SEGREDO_DA_APLICACAO
```

Cadastre também o endereço local seguido de `/api/auth/discord/callback` nos Redirects do Discord. O arquivo `.dev.vars` está no `.gitignore`.

## Configuração da publicação

| Campo no Cloudflare Pages | Valor |
| --- | --- |
| Branch | `main` |
| Root directory | `P26-2B-69DF-2DBB-E2A5-276B` |
| Build command | vazio |
| Build output directory | `public` |
| Banco D1 | binding `DB` |

As variáveis `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` ficam nos Secrets de produção da Cloudflare. O ID do banco está no `wrangler.jsonc`. Nesta instalação, o esquema foi aplicado pelo Console D1.

O callback cadastrado no Discord é:

```text
https://avalia2026-2-52p.pages.dev/api/auth/discord/callback
```

## Testes

Dentro da pasta do projeto:

```powershell
node --test tests/api.test.mjs
```

Os oito grupos de testes passaram. Também foram conferidos o login, um sorteio publicado e a consulta da ata sem login. A impressão/PDF ainda precisa de conferência manual.

Para executar o validador do professor, abra o terminal na raiz do repositório:

```powershell
node validar-local.mjs P26-2B-69DF-2DBB-E2A5-276B
```

A entrega inclui o Pull Request para o repositório do professor e os links do site e do fork no AVA.

Licença [MIT](./LICENSE).
