# Projeto #5 — Quiz Competitivo Temporizado

**Chave Única:** `P26-2A-C913-04B0-E3ED-3E05`  
**Aluno:** Mateus dos Reis Oliveira · **Turma:** 2A  
**URL Cloudflare Pages:** `https://p26-2a-c913-04b0-e3ed-3e05.pages.dev` *(deploy precisa ser confirmado)*

Plataforma de revisão acadêmica com login Discord OAuth2, categorias e questões de múltipla escolha. Cada questão é entregue individualmente; o cliente exibe um contador regressivo, enquanto a Cloudflare Pages Function mede o tempo no D1, verifica a resposta e calcula a pontuação. A alternativa correta não faz parte do payload da questão.

## Tecnologias

- Cliente em HTML5, CSS3 e JavaScript vanilla, sem frameworks de interface.
- Cloudflare Pages Functions para OAuth2, sessões assinadas e regras do quiz.
- Cloudflare D1 (SQLite) para perfil Discord, categorias, questões, tentativas e respostas.

## Configuração

O `wrangler.jsonc` já aponta para o banco D1 informado para este projeto. Confirme que esse ID corresponde ao banco da sua conta Cloudflare. A migração `0001_init.sql` cria as tabelas-base; aplique `0002_quiz.sql` para criar categorias, questões de exemplo e tabelas do quiz:

```powershell
npx.cmd wrangler d1 migrations apply db-p26-2a-c913-04b0-e3ed-3e05 --remote
```

Configure `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` como variáveis de ambiente no Cloudflare Pages. Configure também `SESSION_SECRET` com um segredo aleatório longo (ou mantenha a chave de sessão derivada do client secret). No Discord Developer Portal, cadastre como Redirect URI a URL exata `https://p26-2a-c913-04b0-e3ed-3e05.pages.dev/api/auth/discord/callback`.

Para desenvolvimento local, use `.dev.vars` (ignorado pelo Git) e cadastre também o callback local no Discord. Rode `npx.cmd wrangler pages dev public --port 8788`. Não publique valores de `.dev.vars` nem os inclua em commits.

## Rotas principais

- `GET /api/auth/discord` e `GET /api/auth/discord/callback`: fluxo OAuth2 com `state` assinado.
- `GET /api/auth/session` e `POST /api/auth/logout`: sessão HttpOnly assinada e saída.
- `GET /api/quiz/categories`, `POST /api/quiz/start`, `POST /api/quiz/answer`, `POST /api/quiz/next`: fluxo do quiz autenticado.
- `GET /api/status`: diagnóstico básico sem dados pessoais de outros usuários.

Todas as respostas e avanços de tentativa são associados ao usuário da sessão. O cliente não fornece identidade, tempo, correção ou pontuação confiáveis. A pontuação e o prazo são verificados no servidor a partir do horário registrado no D1.

## Publicação

No Cloudflare Pages, conecte o fork público de `Avalia2026-2`, selecione esta pasta como diretório raiz e use `public` como diretório de saída, sem comando de build. Configure o vínculo D1 com variável `DB` e as variáveis OAuth2/segredo de sessão. Depois do deploy, confirme o login e o quiz no endereço público e atualize a URL acima se o domínio final for diferente.

A entrega também requer publicar o fork/repositório no GitHub, abrir o Pull Request da subpasta e enviar no AVA as URLs do deploy e do repositório. Isso ainda depende das suas contas e da confirmação do deploy; este workspace não publica nem envia a entrega.

## Licença

MIT. Consulte [LICENSE](./LICENSE). A documentação de harness, agentes e skills está em [AGENTS.md](./AGENTS.md).
