# Entrelinhas · Acervo de Citações e Notas de Leitura

Projeto 41 de Bruno Ares, turma 3A. Chave oficial **P26-3A-0B52-37F5-117F-C915**.

**URL_CLOUDFLARE** — https://acervo-bruno-ares.pages.dev/

## Como usar

O feed da turma apresenta citações públicas. Digite o autor ou tema para filtrar as fichas ou use **Citação aleatória** para sortear uma leitura pública e ver a reflexão. Entre com Discord para registrar um trecho, a autoria original, a obra, a página e suas anotações. Palestras aceitam um marcador de tempo no lugar da página. A visibilidade inicial é privada. **Meu acervo** reúne as fichas públicas e privadas do leitor autenticado.

## Implementação

HTML5, CSS3 e JavaScript puro em `public/`. As Cloudflare Pages Functions obtêm ID, nome e avatar através do OAuth2 do Discord, validam a sessão assinada e restringem a leitura de citações privadas pelo identificador do criador. Os dados ficam em tabelas relacionais no D1. A busca instantânea filtra os registros que o servidor já autorizou. O sorteio consulta exclusivamente registros públicos no servidor.

## Desenvolvimento local

Use Node.js 24 ou superior nesta pasta. Execute `npm test` para os testes e `npx wrangler pages dev public` para iniciar o site. Para testar login local, configure as três variáveis descritas abaixo no ambiente de desenvolvimento e cadastre a URL de callback correspondente no Discord. Os testes automatizados usam SQLite local e respostas simuladas do provedor OAuth.

## Publicação no Cloudflare Pages

Conecte o fork ao Pages. Selecione a branch `projeto-41`, o diretório raiz `P26-3A-0B52-37F5-117F-C915` e a pasta de saída `public`. Deixe vazio o comando de build. O banco exclusivo do acervo está configurado no arquivo `wrangler.jsonc`, com o binding `DB`.

O identificador público da aplicação Discord Entrelinhas está em `vars.DISCORD_CLIENT_ID` no `wrangler.jsonc`. No ambiente de produção do Pages, use dois segredos: `DISCORD_CLIENT_SECRET` e `SESSION_SECRET`. O segredo de sessão deve ser aleatório, exclusivo deste projeto e ter ao menos 32 caracteres. Cadastre no Discord o endereço de retorno `https://acervo-bruno-ares.pages.dev/api/auth/discord/callback`. Após configurar os segredos, publique novamente para que o deploy os utilize.

O esquema inicial está em `migrations/0001_acervo.sql`. O servidor inicializa um banco existente e vazio quando encontra as tabelas ausentes. Para migrar explicitamente, execute `npx wrangler d1 migrations apply DB --remote`. Após alterar a migração inicial durante o desenvolvimento, rode `node scripts/gerar-schema.mjs` e `npm test`.

## Verificação e entrega

Os 10 testes locais passaram. Eles exercitam a persistência, o isolamento entre duas contas, o sorteio público e o fluxo OAuth com provedor simulado. Em produção, Bruno confirmou o login com Discord e a gravação de uma citação pública. Em uma sessão independente de visitante, a ficha de Macunaíma apareceu após recarregar. A busca a encontrou por autor e por tema, e uma consulta sem correspondência retornou zero fichas. O sorteio público exibiu o trecho e a nota de leitura. A chave oficial foi conferida no rodapé.

Rode `node validar-local.mjs P26-3A-0B52-37F5-117F-C915` na raiz do fork. A branch de entrega contém apenas a subpasta oficial sobre a base da disciplina.

As responsabilidades e skills dos três agentes estão em [AGENTS.md](AGENTS.md). Licença MIT em [LICENSE](LICENSE).
