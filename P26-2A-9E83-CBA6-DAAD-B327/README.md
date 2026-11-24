# Projeto #20 â€” Gerenciador de Horas Complementares

**Nome:** Gabriel Martins dos Santos Garai  
**RA:** 2026108062  
**Turma:** 2A  
**Chave Ãšnica Oficial:** P26-2A-9E83-CBA6-DAAD-B327  
**URL_CLOUDFLARE:** https://horas-complementares-garai.pages.dev  
**RepositÃ³rio:** https://github.com/Gabriel-Garai/Avalia2026-2

## Objetivo
Sistema responsivo em HTML5, CSS3 e JavaScript puro com login Discord OAuth2, cadastro de eventos/cursos/projetos de extensÃ£o, certificado externo, dashboard com barras de progresso por ensino, pesquisa e extensÃ£o e persistÃªncia D1.

## Arquitetura
- `public/`: frontend estÃ¡tico Vanilla JS.
- `functions/api/auth/discord/`: inÃ­cio do OAuth2 e callback.
- `functions/api/auth/logout.js`: logout por POST.
- `functions/api/me.js`: usuÃ¡rio autenticado.
- `functions/api/activities/`: listagem, inclusÃ£o e exclusÃ£o restritas ao dono.
- `functions/api/health.js`: diagnÃ³stico de disponibilidade do D1.
- `lib/`: validaÃ§Ã£o de negÃ³cio e sessÃ£o assinada.
- `migrations/`: tabelas D1.
- `AGENTS.md`, `.opencode/agents/`, `skills/` e `.opencode/skills/`: configuraÃ§Ã£o para o harness OpenCode.

## Premissa acadÃªmica explÃ­cita
O enunciado exemplifica teto de **60 horas em uma Ãºnica modalidade**, sem apresentar limites oficiais nem meta curricular exata. Para uma demonstraÃ§Ã£o, adotamos **60h para cada eixo e 180h como meta demonstrativa**. Os registros sÃ£o somados como contabilizados automaticamente dentro do teto; nÃ£o existe aprovaÃ§Ã£o administrativa. Essa regra deve ser revisada se o professor fornecer valores definitivos.

## SeguranÃ§a
- OAuth2 `authorization_code` Discord, scope `identify`, checagem de `state` e troca de token no servidor.
- Cookie de sessÃ£o assinado com HMAC SHA-256, HttpOnly, Secure, SameSite=Lax e expiraÃ§Ã£o de 7 dias.
- Autoria derivada do Discord, consultas D1 parametrizadas por `user_id`.
- ValidaÃ§Ãµes feitas no servidor; INSERT condicionado ao teto por categoria.
- Segredos exclusivamente em variÃ¡veis do Cloudflare: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` (chave longa aleatÃ³ria).
- NÃ£o publicar segredos e nÃ£o versionar `.dev.vars`.

## ConfiguraÃ§Ã£o Cloudflare Pages
1. Crie um banco D1 chamado `db-horas-garai` e copie o `database_id` em `wrangler.jsonc`.
2. Dentro deste diretÃ³rio, com Node.js instalado, execute `npx.cmd wrangler login` (Windows), depois `npx.cmd wrangler d1 migrations apply DB --remote`.
3. No Cloudflare, conecte **o fork** `Gabriel-Garai/Avalia2026-2` ao Pages: **Root directory** `P26-2A-9E83-CBA6-DAAD-B327`, **Build command** vazio, **Build output** `public`.
4. Confirme o binding do banco `DB` em **Settings â†’ Functions â†’ D1 bindings**, caso o painel nÃ£o o tenha associado a partir do arquivo de configuraÃ§Ã£o.
5. Crie uma aplicaÃ§Ã£o em https://discord.com/developers/applications. Em OAuth2, adicione exatamente `https://<seu-dominio>/api/auth/discord/callback`.
6. Configure os trÃªs segredos como **Environment variables** no Pages. `SESSION_SECRET` deve ser uma sequÃªncia aleatÃ³ria longa, exclusiva.
7. FaÃ§a redeploy. Teste login, cadastro, consulta, exclusÃ£o e endpoint `/api/health` (esperado `{"ok":true,"db":true}`).
8. Atualize `URL_CLOUDFLARE` acima; execute `node ../validar-local.mjs P26-2A-9E83-CBA6-DAAD-B327` a partir da raiz do fork (nÃ£o desta subpasta), conforme README oficial do professor.
9. Abra Pull Request para o repositÃ³rio original e entregue URLs no AVA.

## ValidaÃ§Ã£o local
Execute `node --test tests/*.test.mjs` neste diretÃ³rio. Estes testes cobrem validaÃ§Ãµes puras e totalizaÃ§Ã£o, **nÃ£o substituem testes de integraÃ§Ã£o no Discord ou Cloudflare**.

## Engenharia de agentes
Veja `AGENTS.md` para responsabilidades, harness, skills e instruÃ§Ãµes de execuÃ§Ã£o. **Agentes configurados nÃ£o sÃ£o agentes executados**: Ã© obrigatÃ³rio invocÃ¡-los no OpenCode e registrar evidÃªncias reais.

## PendÃªncias para finalizar a entrega
- Executar `iniciar.mjs` oficial e preservar a estrutura esperada; **nÃ£o sobrescrever arquivos do professor sem conferir**.
- Configurar D1 e OAuth2 com credenciais prÃ³prias.
- Publicar na Cloudflare, verificar funcionamento, atualizar URL.
- Executar os trÃªs agentes via OpenCode e registrar evidÃªncias.
- Rodar validador oficial e corrigir o que for apontado.
- PR e postagem das URLs no AVA.

