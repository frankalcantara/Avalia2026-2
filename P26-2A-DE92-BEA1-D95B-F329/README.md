# Trajetória — Construtor de Portfólio e Currículo Acadêmico

**Projeto oficial #39 · Luiz Henrique Weinert Jardwski · Turma 2A**

- **Chave Única:** `P26-2A-DE92-BEA1-D95B-F329`
- **URL_CLOUDFLARE:** https://trajetoria-luiz-2026.pages.dev
- **Demonstração pública:** https://trajetoria-luiz-2026.pages.dev/?user=524599377784733696 (currículo fictício usado na validação).
- **Repositório de entrega:** [lulujardwski-ship-it/Avalia2026-2](https://github.com/lulujardwski-ship-it/Avalia2026-2), fork público do repositório oficial.
- **Licença:** [MIT](LICENSE).

## Funcionalidades implementadas

Editor com dados profissionais, formação, experiências, projetos, habilidades e links. A prévia acompanha o preenchimento em tempo real e oferece os temas Moderno, Clássico e Minimalista. O botão Exportar PDF abre a impressão nativa do navegador, com CSS A4 específico.

A autenticação usa exclusivamente Discord OAuth2 e importa `user_id`, nome e avatar. O proprietário salva e edita seu currículo no Cloudflare D1. Currículos começam privados; publicar exige ativar a opção e salvar. O link `/?user=ID` carrega pela API apenas currículos publicados. A interface explica que publicar inclui informações de contato.

O exemplo fictício permite explorar a interface. Ele não simula login nem gravação em banco. Um rascunho temporário em `sessionStorage` é utilizado somente para preservar conteúdo durante o redirecionamento de login; o armazenamento definitivo é D1.

## Arquitetura e segurança

- `public/`: HTML5 semântico, CSS3 e JavaScript puro, sem frameworks ou dependências remotas de interface.
- `functions/`: APIs serverless de sessão, OAuth2, currículo, logout e diagnóstico.
- `migrations/0001_init.sql`: oito tabelas relacionais com chaves estrangeiras e índices.
- Sessões aleatórias assinadas com HMAC-SHA256; apenas o hash do token é salvo no banco. Cookies HttpOnly, Secure e SameSite=Lax; logout revogável e expiração.
- `state` OAuth2 assinado e com prazo de validade. Tokens de acesso Discord não são persistidos nem enviados ao navegador.
- CSRF e verificação de Origin nas mutações; identidade obtida da sessão, nunca do corpo da requisição.
- Queries parametrizadas e lotes transacionais; limites de tamanho/tipo e URLs HTTP(S) sem credenciais.
- Renderização de conteúdo com `textContent`; leitura pública de rascunhos bloqueada no servidor.
- [Contrato da API](docs/API.md), [documentação dos agentes](AGENTS.md) e [relatório de validação](docs/VALIDACAO.md).

## Executar localmente

Recomenda-se Node.js 24 para a suíte com `node:sqlite`. O frontend não exige build. Dentro desta subpasta:

```bash
npm ci
npm run db:local
```

Copie `.env.example` para `.dev.vars` e preencha as credenciais de desenvolvimento. Gere `SESSION_SECRET` com pelo menos 32 caracteres aleatórios. Não publique `.dev.vars`, `.env`, senhas ou tokens. Depois:

```bash
npm run dev
npm test
```

Para testar autenticação, use um domínio HTTPS e cadastre no Discord o callback exato daquele ambiente. Os cookies de produção exigem HTTPS. O editor e o exemplo funcionam sem autenticação; salvar e publicar exigem a integração real.

Nos laboratórios Windows, se o PowerShell bloquear scripts de npm, use `npm.cmd` e `npx.cmd`. Os scripts oficiais do professor devem ser executados com `node`.

## Publicar no Cloudflare Pages com D1

1. No seu fork público de `Avalia2026-2`, mantenha todos os arquivos deste projeto dentro de `P26-2A-DE92-BEA1-D95B-F329/`.
2. No Cloudflare Pages, conecte o fork. Configure:
   - Diretório raiz: `P26-2A-DE92-BEA1-D95B-F329`.
   - Build command: vazio.
   - Build output directory: `public`.
   - As Functions são detectadas no diretório `functions/` desta mesma subpasta.
3. Crie o banco D1 `db-p26-2a-de92-bea1-d95b-f329`, substitua o UUID de exemplo em `wrangler.jsonc` pelo `database_id` real e aplique a migração:

```bash
npx wrangler d1 migrations apply DB --remote
```

4. Confirme o binding D1 chamado exatamente `DB` no projeto Pages e aponte para o banco criado.
5. No Discord Developer Portal, crie uma aplicação OAuth2. Cadastre o callback exato `https://trajetoria-luiz-2026.pages.dev/api/auth/discord/callback`. Não é necessário criar bot nem solicitar permissões de servidor; o escopo usado é `identify`.
6. Configure no ambiente de produção do Pages:

| Variável | Conteúdo |
| --- | --- |
| `DISCORD_CLIENT_ID` | ID da aplicação Discord; pode ser cadastrado como Secret |
| `DISCORD_CLIENT_SECRET` | Segredo da aplicação, cadastrado como Secret |
| `SESSION_SECRET` | Valor aleatório com pelo menos 32 caracteres, cadastrado como Secret |

Quando o painel informar que as variáveis são gerenciadas pelo Wrangler, cadastre os três valores como **Secrets**. Os nomes e o acesso em `context.env` permanecem os mesmos.

7. Reimplante o projeto depois de configurar banco e variáveis. Verifique `/api/status`: `database`, `discord`, `sessions` e `ready` devem ser `true`. O diagnóstico indica configuração, mas não substitui o teste real de login.
8. Teste o login Discord; salve um currículo, recarregue, publique e abra o link em outra sessão; despublique e confira o bloqueio do link. Exporte os três temas por Salvar como PDF.
9. Substitua `URL_CLOUDFLARE` no topo deste README pela URL pública real.

## Validação e entrega

A partir da raiz do repositório:

```bash
node validar-local.mjs P26-2A-DE92-BEA1-D95B-F329
```

A suíte independente tem **17 testes aprovados**, com SQLite real em memória e chamadas externas ao Discord controladas. As Functions também foram compiladas pelo Wrangler. Confira os detalhes e os limites no relatório; estes testes não constituem prova de login ou persistência em produção.

Antes da entrega, completar:

- [x] Chave validada na API oficial e pasta criada pelo `iniciar.mjs` do professor.
- [x] Interface, backend, migração, três agentes reais, skills oficiais, licença e documentação.
- [x] Testes de integração e compilação das Functions.
- [x] Fork público na conta do aluno e código enviado na subpasta oficial.
- [x] Banco D1 remoto criado e esquema SQL aplicado pelo Console do Cloudflare.
- [x] Primeira implantação do Cloudflare Pages concluída, conforme confirmação no painel.
- [x] Credenciais Discord e SESSION_SECRET configurados em produção; diagnóstico `ready: true`.
- [x] Login Discord real e persistência após recarregamento verificados em produção.
- [x] Currículo público aberto em janela anônima sem autenticação.
- [x] Prévia nativa de PDF conferida em uma página, sem controles do editor.
- [x] Três temas e layout de 390 px conferidos em prévia local.
- [x] URL pública real registrada neste README.
- [x] Validador oficial executado com 9 de 9 itens aprovados, incluindo deploy online. Fluxos reais também conferidos no navegador do aluno.
- [ ] URLs do projeto online e do repositório publicadas no AVA.

A entrega oficial exige Pull Request do fork para `frankalcantara/Avalia2026-2` contendo somente esta pasta e o registro das URLs no AVA. O relatório distingue testes locais de verificações em produção.

## Fontes técnicas

- [Documentação OAuth2 do Discord](https://github.com/discord/discord-api-docs/blob/main/developers/topics/oauth2.mdx).
- [API de banco de dados D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).
- [Instruções oficiais de entrega](https://github.com/frankalcantara/Avalia2026-2).
