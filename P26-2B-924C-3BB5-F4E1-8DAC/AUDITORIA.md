# Auditoria pré-publicação do Projeto #39

20/11/2026 · Fork `eduardoaugustotferreira-hash/Avalia2026-2` · Branch `main` · Base `ab948a5`

**Resultado local:** 9 testes passaram, zero falhas e zero saltos. O validador oficial marcou 8 dos 9 itens como OK. A pendência é a URL do deploy. O aceite em produção depende de login real no Discord e de leitura e gravação no D1 remoto.

## Evidências

| Verificação | Resultado observado |
| --- | --- |
| Escopo e Git | Índice vazio. A pasta P26 contém toda a aplicação, testes, configuração, migrações e documentação. Gerador e validador permanecem na raiz oficial, íntegros. |
| Credenciais | Inspeção dos nomes e do conteúdo dos candidatos ao Git, incluindo arquivos ocultos, assinaturas de tokens, chaves privadas e atribuições de segredos. Os literais de credenciais encontrados são exemplos do README ou dados sintéticos de teste. Nenhuma credencial real identificada. Confirmadas as exclusões de arquivos de ambiente, caches e estado local. |
| Documentos | Presentes README.md, AGENTS.md, PROGRESSO.md, LICENSE MIT e quatro SKILL.md. Conferidos os hashes da licença, das três skills oficiais e da primeira migração contra o registro da geração. |
| Pages e Wrangler | Nome configurado `projeto-p26-2b-924c-3bb5-f4e1-8dac`, data de compatibilidade `2026-03-01`, saída `./public`, Functions em `functions/` e binding D1 `DB`. O Wrangler 4.165.0 compilou as Functions localmente. |
| Migrações | Wrangler aplicou `0001_init.sql` e `0002_portfolio.sql`, em ordem, em um D1 local vazio. A listagem seguinte retornou zero pendências. A execução independente em SQLite criou oito tabelas da aplicação. `integrity_check` retornou `ok` e `foreign_key_check` retornou zero ocorrências. |
| Discord OAuth2 | Os endpoints de autorização e de token usados pelo código coincidem com os metadados públicos do Discord. O fluxo pede `identify`, troca o código no servidor, consulta `/api/users/@me` e usa a mesma URI de callback na autorização e na troca. [Metadados do Discord](https://discord.com/.well-known/oauth-authorization-server) |
| Sessão | Estado OAuth aleatório de 32 bytes, cookie de estado por 10 minutos, comparação no callback e remoção ao concluir. Cookie de sessão `__Host-`, `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, assinatura HMAC-SHA256 e expiração de sete dias. O D1 guarda o hash do identificador e a expiração. Logout revoga a sessão. Salvar e sair exigem a origem do aplicativo. |
| Testes | `node --test tests/api.test.mjs tests/browser.test.mjs` na pasta P26. Oito testes de API e um fluxo em Chromium, com Discord simulado. Cobertura de autorização, isolamento entre usuários, expiração, revogação, rollback, publicação e retirada do ar, persistência, temas, cores, visualização móvel e PDF A4. |
| Validador | `node validar-local.mjs P26-2B-924C-3BB5-F4E1-8DAC` executado da raiz do fork. Todos os itens estruturais passaram. Uma chamada inicial dentro da subpasta não localizou o projeto por causa do diretório de trabalho. |

## Riscos e condições de aceite

1. O UUID atual do D1 é composto de zeros. Substitua-o pelo ID da base de produção e aplique as duas migrações antes de ativar o tráfego.
2. O cadastro do callback, as credenciais no Pages e o acesso ao D1 remoto continuam sem teste de ponta a ponta. O callback depende da origem visitada. Cadastre exatamente a origem HTTPS que será usada pelos estudantes.
3. A assinatura da sessão utiliza o segredo da aplicação Discord. A rotação desse segredo invalida as sessões existentes e exige novo login.
4. Ao publicar o currículo, o estudante torna visíveis os campos preenchidos, inclusive o e-mail. O formulário avisa sobre isso e a publicação exige ação explícita. Verifique a retirada do ar em uma janela anônima.

## Publicação pelo fork e Cloudflare Pages

Procedimento futuro para Bash, condicionado à autorização do proprietário. O fluxo utiliza a integração Git do Pages. Nesta auditoria não foi executado comando de escrita remota.

**1. Preparar o D1.** No computador com acesso à conta Cloudflare, execute a partir do fork. Se o banco já existir, use o UUID existente e pule a criação.

```bash
cd /workspace/Avalia2026-2
PASTA=P26-2B-924C-3BB5-F4E1-8DAC
cd "$PASTA"
w() { npx --yes wrangler@4.165.0 "$@"; }
w login
w whoami
w d1 list
# Apenas na primeira criação
w d1 create db-p26-2b-924c-3bb5-f4e1-8dac --update-config=false
```

No `wrangler.jsonc`, substitua o UUID de zeros em `d1_databases[0].database_id` pelo UUID real. Mantenha o binding `DB`. Confira o nome e a conta do banco antes de aplicar as migrações.

```bash
w d1 migrations list DB --remote
w d1 migrations apply DB --remote
w d1 migrations list DB --remote
node --test tests/api.test.mjs tests/browser.test.mjs
```

**2. Configurar Pages e Discord.** Use a integração Git com o fork, branch de produção `main`, raiz igual a `$PASTA` (insira o nome completo), saída `public`, sem framework e comando de build vazio. Use o nome de projeto do Wrangler ou atualize `name` para o nome efetivamente escolhido. Em produção, confira o binding `DB`, defina `DISCORD_CLIENT_ID` e cadastre `DISCORD_CLIENT_SECRET` como segredo. O diretório publicado deve ser `public`; as Functions ficam na pasta irmã `functions`. Para previews habilitados, configure um D1 separado ou desative os builds de preview.

No portal do Discord, registre em OAuth2 → Redirects a origem HTTPS real do Pages seguida de `/api/auth/discord/callback`. Para obter a URI exata a partir da URL mostrada pelo Pages, use:

```bash
read -rp 'Origem HTTPS de produção exibida pelo Pages: ' ORIGEM
ORIGEM="${ORIGEM%/}"
printf '%s/api/auth/discord/callback\n' "$ORIGEM"
```

**3. Enviar apenas a pasta P26.** Com produção já conectada, o push em `main` dispara o deploy. Em um projeto novo, envie a pasta ao fork e conclua a conexão Git no Pages para iniciar o primeiro build. Configure os bindings e segredos antes de testar o login e faça um novo deploy se os tiver alterado depois do build.

```bash
cd ..
node validar-local.mjs "$PASTA"
git remote get-url origin
git add -- "$PASTA"
git diff --cached --stat
git diff --cached --check
git commit --only -m "Entrega do Projeto 39" -- "$PASTA"
git push origin main
```

**4. Aceite no endereço publicado.** Confirme o resultado do deploy no Pages. Execute as consultas abaixo com a origem real.

```bash
curl --fail --show-error --silent "$ORIGEM/api/status"
curl --fail --show-error --silent "$ORIGEM/api/session"
```

Espere `{"ok":true,"projectId":39}` e `{"user":null}` nas consultas sem cookie. Entre pelo Discord no navegador, grave um currículo privado, recarregue e confira a persistência. Publique, abra o link em janela anônima, confira a impressão e retire a publicação. Reabra o link anônimo e confirme HTTP 404 na API pública. Saia e confirme que a leitura privada exige novo login. Após o aceite, preencha `URL_CLOUDFLARE` no README da pasta com a URL comprovada e execute o validador novamente da raiz. Para o PR final, siga a [política de autorização exclusiva do proprietário](AGENTS.md#autorização-exclusiva-do-proprietário).
