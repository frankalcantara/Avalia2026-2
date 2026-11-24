# Checklist manual — Bookmark Manager (Projeto #42)

Chave única: **P26-2A-567B-6EC5-D24D-9098**

Como usar: execute cada item, marque ☐ → ✅ (passou) ou ❌ (falhou) e anote a evidência (print, trecho de console, nome do arquivo do print). Itens que falharem entram em `RELATORIO_QA.md`. Não marque nada que você não executou.

**Ambiente**: Chrome ou Firefox recentes (o cookie `Secure` funciona em `http://localhost` nesses dois; o Safari pode recusá-lo). Servidor local: o mesmo `npx wrangler ...` que você já usa (PowerShell: `npx wrangler ...`; se bloquear scripts, `npx.cmd`). Login real com Discord exige `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` no `.dev.vars` e o redirect `http://localhost:PORTA/api/auth/discord/callback` cadastrado no Discord Developer Portal.

Preparação: 1 conta Discord real, uma aba normal e uma janela anônima.

---

## A. Fluxo completo

| ID | Passo | Resultado esperado | Resultado | Evidência |
|----|-------|--------------------|-----------|-----------|
| F-01 | Abrir `/` sem sessão e clicar em **Entrar com Discord**; autorizar | Volta para `/` já logado: avatar e username no cabeçalho, URL sem `?login=` | ☐ | |
| F-02 | Criar coleção "Compiladores" com descrição | Aparece na barra lateral, selecionada, contador 0, sem selo "Pública" | ☐ | |
| F-03 | Tentar criar outra coleção com o mesmo nome | Erro do servidor no diálogo ("Já existe uma coleção com esse nome"); diálogo continua aberto | ☐ | |
| F-04 | Adicionar 3 links na coleção, um em cada status (Para Ler, Lendo, Concluído), um deles com resumo | Cards aparecem com a pílula do status certa; contador da coleção = 3 | ☐ | |
| F-05 | Criar 2ª coleção "Redes" com 2 links (um Lendo, um Concluído) | Contadores corretos; "Todas as coleções" = 5 | ☐ | |
| F-06 | Filtro combinado: selecionar "Compiladores" + status "Lendo" | Só o link Lendo de Compiladores. Troque para "Redes" mantendo "Lendo": só o de Redes | ☐ | |
| F-07 | "Todas as coleções" + status "Concluído" | Os 2 links concluídos das duas coleções, com a linha "Coleção: ..." | ☐ | |
| F-08 | Combinação sem resultado (ex.: Redes + Para Ler) | Mensagem de lista vazia coerente com o filtro | ☐ | |
| F-09 | Editar um link: mudar status e **apagar o resumo** | Salva; o card deixa de mostrar o resumo | ☐ | |
| F-10 | Editar um link e mover para outra coleção | Contadores das duas coleções atualizam sem recarregar a página | ☐ | |
| F-11 | Excluir um link | Pede confirmação (foco em Cancelar); Cancelar não apaga; Excluir apaga e atualiza contador | ☐ | |
| F-12 | Renomear a coleção (alterar nome e descrição) | Título e barra lateral atualizam | ☐ | |
| F-13 | Em "Compiladores": **Tornar pública** | Aparecem o link `.../colecao.html?s=...`, os botões "Copiar link" e "Tornar privada"; selo "Pública" na lateral | ☐ | |
| F-14 | Clicar **Copiar link** e colar na barra de endereço de uma **janela anônima** | Mensagem "Link copiado!"; a página pública abre **sem login** | ☐ | |
| F-15 | Conferir a página pública | Título, descrição, autor (avatar + username), links agrupados em Para Ler / Lendo / Concluído, grupos vazios escondidos, sem botões de editar/excluir | ☐ | |
| F-16 | Na janela anônima abrir `/api/collections` | JSON `{"error":"Não autenticado"}` (401) | ☐ | |
| F-17 | Voltar à aba logada: **Tornar privada** (confirmar) e recarregar a página pública na anônima | Mensagem de erro (coleção não encontrada); nada de dados | ☐ | |
| F-18 | **Tornar pública** de novo | Novo link com `s=` diferente; o antigo continua dando erro | ☐ | |
| F-19 | Adicionar um link novo à coleção pública e recarregar a anônima | O link novo aparece (comportamento esperado: tudo da coleção é público) | ☐ | |
| F-20 | Excluir a coleção "Redes" | Confirmação cita a quantidade de links; ao confirmar, volta para "Todas" e os links de Redes somem | ☐ | |
| F-21 | Clicar **Sair** | Volta à tela de login; cabeçalho sem usuário | ☐ | |
| F-22 | Após sair, abrir `/api/collections` e usar o botão "voltar" do navegador | 401 na API; nenhuma lista de links visível | ☐ | |
| F-23 | Entrar com Discord e **cancelar** a autorização | Volta para `/` com a mensagem "Você cancelou a autorização no Discord."; URL limpa | ☐ | |
| F-24 | Com sessão ativa, no DevTools apagar o cookie `discord_session` e clicar em qualquer ação | Mensagem "Sua sessão expirou. Entre novamente." e tela de login | ☐ | |
| F-25 | Parar o servidor (ou DevTools → Offline) e clicar em uma ação | Mensagem de falha de conexão, sem tela quebrada | ☐ | |

## B. Responsividade (DevTools → modo dispositivo; recarregue a página a cada tamanho)

Pontos de quebra do CSS: 768px (barra lateral ao lado) e 1100px (2 colunas de cards). Em todos: **sem rolagem horizontal**, texto legível, botões com área de toque ≥ 44px, rodapé visível.

| ID | Tamanho | Tela | Esperado | Resultado | Evidência |
|----|---------|------|----------|-----------|-----------|
| R-01 | 360px | Login | Painel centralizado, botão cabe na largura | ☐ | |
| R-02 | 360px | App (com 3+ links e coleção pública) | Barra lateral **acima** do conteúdo; botões de ação quebram linha; cards em 1 coluna; link público longo quebra (não estoura) | ☐ | |
| R-03 | 360px | Diálogos (link, coleção, confirmação) | Cabem na tela, rolam internamente se preciso, botões visíveis | ☐ | |
| R-04 | 360px | `colecao.html` | Cabeçalho da coleção, grupos e cards em 1 coluna | ☐ | |
| R-05 | 768px | Login | Layout correto | ☐ | |
| R-06 | 768px | App | Barra lateral ao lado (≈17rem) e conteúdo à direita; cards em 1 coluna; filtro em linha | ☐ | |
| R-07 | 768px | Diálogos | Campos "Coleção" e "Status" lado a lado | ☐ | |
| R-08 | 768px | `colecao.html` | Centralizada, largura confortável | ☐ | |
| R-09 | 1280px | Login | Layout correto | ☐ | |
| R-10 | 1280px | App | Lateral ≈19rem; cards em **2 colunas** | ☐ | |
| R-11 | 1280px | Diálogos | Largura máxima ≈560px, centralizados | ☐ | |
| R-12 | 1280px | `colecao.html` | Cards em 2 colunas dentro de cada grupo | ☐ | |
| R-13 | qualquer | Zoom do navegador em 200% | Continua usável, sem sobreposição de texto | ☐ | |

## C. Navegação só por teclado (não use o mouse)

| ID | Passo | Esperado | Resultado | Evidência |
|----|-------|----------|-----------|-----------|
| T-01 | Recarregar e apertar Tab uma vez | Aparece "Pular para o conteúdo"; Enter leva o foco ao conteúdo principal | ☐ | |
| T-02 | Tab na tela de login | Ordem lógica: skip link → marca → "Entrar com Discord" | ☐ | |
| T-03 | Tab no app | Ordem: skip link → marca → Sair → Nova coleção → coleções → ações da coleção → Novo link → filtros → cards (Editar, Excluir) | ☐ | |
| T-04 | Observar o foco em **todos** os controles | Contorno visível e contrastado em cada um (nenhum controle "some") | ☐ | |
| T-05 | Enter/Espaço em botões (coleção, filtro, Novo link, Editar, Excluir) | Todos ativam; o filtro muda o `aria-pressed` | ☐ | |
| T-06 | Abrir "Novo link" por teclado | Foco vai para o campo URL; Tab fica **preso** dentro do diálogo; Esc fecha; foco **volta** ao botão que abriu | ☐ | |
| T-07 | Preencher o formulário só com teclado e enviar com Enter | Salva; campos inválidos mostram erro e o foco vai para o primeiro inválido | ☐ | |
| T-08 | Abrir "Excluir" de um link | Foco inicial em **Cancelar**; Esc cancela sem apagar | ☐ | |
| T-09 | Excluir um link por teclado e observar onde fica o foco | Anotar: se o foco cair no `<body>` (perdido), registrar como achado A11Y-01 | ☐ | |
| T-10 | Tab na página pública | Foco passa por cada link externo, com contorno visível | ☐ | |
| T-11 | Com leitor de tela (NVDA/VoiceOver), se disponível: ouvir lista de coleções e filtro | Coleção lida com nome, quantidade e "pública"; filtro lido como pressionado/não | ☐ | |

## D. XSS (conteúdo malicioso tem que aparecer como TEXTO e nunca executar)

Em cada caso: nenhum `alert` aparece, nenhum elemento novo é criado (inspecionar no DevTools → Elements) e o texto aparece literalmente.

| ID | Entrada | Onde conferir | Esperado | Resultado | Evidência |
|----|---------|---------------|----------|-----------|-----------|
| X-01 | Título: `<script>alert('xss')</script>` | Card, diálogo de edição, diálogo de exclusão | Texto literal; sem alerta | ☐ | |
| X-02 | Título: `<img src=x onerror=alert(1)>` | Idem | Texto literal; sem requisição a `x` na aba Network | ☐ | |
| X-03 | Resumo: `<b>negrito</b> <a href="javascript:alert(1)">clique</a>` | Card, página pública | Texto literal (sem negrito, sem link) | ☐ | |
| X-04 | Nome da coleção: `<svg onload=alert(1)>` | Barra lateral, título, diálogo "Excluir coleção", opções do select, página pública (título da aba também) | Texto literal em todos | ☐ | |
| X-05 | Descrição da coleção: `<script>alert(2)</script>` | Cabeçalho do conteúdo e página pública | Texto literal | ☐ | |
| X-06 | URL: `javascript:alert(1)` e `data:text/html,<script>alert(1)</script>` | Formulário de link | Servidor recusa (mensagem "URL inválida"); nada salvo | ☐ | |
| X-07 | URL válida com aspas e tags: `https://example.com/?a="><script>alert(1)</script>` | Card e página pública | Texto do link literal; clique abre a URL em nova aba; sem execução | ☐ | |
| X-08 | Abrir `/?auth_error=<script>alert(1)</script>` | Tela de login | Mensagem em texto (limitada a 60 caracteres); sem execução | ☐ | |
| X-09 | Abrir `/colecao.html?s=<script>alert(1)</script>` | Página pública | Mensagem de erro em texto; sem execução | ☐ | |
| X-10 | Via DevTools → Network ou `curl`, enviar um link com `href` perigoso direto na API (`url: "javascript:..."`) | `POST /api/links` com cookie válido | 400 (validação é do servidor, não só do cliente) | ☐ | |

## E. Chave no rodapé

| ID | Onde | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| K-01 | `index.html`, tela de login | `<footer>` com `P26-2A-567B-6EC5-D24D-9098` | ☐ | |
| K-02 | `index.html`, com usuário logado | Mesmo rodapé continua visível | ☐ | |
| K-03 | `colecao.html` | `<footer>` com a mesma chave | ☐ | |
| K-04 | `README.md` | Contém a chave e `URL_CLOUDFLARE` preenchida | ☐ | |
| K-05 | Rodapé em 360px | Chave quebra linha e não gera rolagem horizontal | ☐ | |
| K-06 | Comparar a chave dos arquivos com a do enunciado, caractere a caractere | Idêntica (`grep -rn "P26-2A-567B-6EC5-D24D-9098" .`) | ☐ | |

## F. Requisitos estáticos (rodar na raiz do repositório; PowerShell: use `Select-String` no lugar de `grep`)

| ID | Verificação | Comando / como | Esperado | Resultado | Evidência |
|----|-------------|----------------|----------|-----------|-----------|
| E-01 | Tudo dentro da pasta oficial | `git ls-files` (ou listar a raiz) | Nenhum arquivo do projeto fora de `P26-2A-567B-6EC5-D24D-9098/` | ☐ | |
| E-02 | Sem framework de UI | `grep -rniE "react\|vue\|angular\|svelte\|jquery\|tailwind\|bootstrap" public functions` | Nenhum resultado | ☐ | |
| E-03 | Sem `innerHTML` com dados | `grep -rnE "innerHTML\|outerHTML\|insertAdjacentHTML\|document.write" public` | Nenhum resultado | ☐ | |
| E-04 | Sem sombra em texto | `grep -rnE "text-shadow\|drop-shadow" public` | Nenhum resultado | ☐ | |
| E-05 | Sem CDN/recursos externos de UI | `grep -rnE "https?://" public` | Só o avatar do CDN do Discord e links dos usuários; nenhum `<script src>` / `<link>` externo | ☐ | |
| E-06 | SQL só com `bind()` | `grep -rn "prepare(" functions` e ler cada ocorrência | Valores sempre em `?`; só fragmentos constantes em template string | ☐ | |
| E-07 | Segredos fora do repositório | `git grep -n "DISCORD_CLIENT_SECRET"` e conferir `.gitignore` (`.dev.vars`, `.wrangler/`) | Só nomes de variável, nunca o valor | ☐ | |
| E-08 | Licença MIT | Abrir `LICENSE` | Texto da MIT com o nome do autor | ☐ | |
| E-09 | README | Abrir `README.md` | Chave e `URL_CLOUDFLARE` | ☐ | |
| E-10 | Repositório público | Abrir o repositório em janela anônima | Acessível sem login | ☐ | |
| E-11 | Conformidade de entrega | `node validar-local.mjs P26-2A-567B-6EC5-D24D-9098` | 100% nos itens determinísticos | ☐ | |
| E-12 | Migrations aplicadas | `npx wrangler d1 migrations list DB --local` (e `--remote`) | 0001 e 0002 aplicadas | ☐ | |
| E-13 | Codificação dos arquivos | `grep -rn "├" .` e conferir se "Concluído" aparece com acento nos arquivos | Nenhum "├"; acentos corretos (achado ENC-01) | ☐ | |
| E-14 | `functions/api/status.js` | Abrir o arquivo | Não referencia a tabela `project_records` (removida na migration 0002) | ☐ | |
| E-15 | Testes automáticos | `node --test tests/api.test.mjs` | Todos passam (ver `RELATORIO_QA.md`) | ☐ | |

## G. Produção (Cloudflare Pages — `URL_CLOUDFLARE`)

| ID | Passo | Esperado | Resultado | Evidência |
|----|-------|----------|-----------|-----------|
| D-01 | Variáveis `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` e binding `DB` configurados no projeto | Login não responde `not_configured` | ☐ | |
| D-02 | Redirect no Discord Developer Portal = `URL_CLOUDFLARE/api/auth/discord/callback` (idêntico) | Login conclui sem `token_exchange_failed` | ☐ | |
| D-03 | Fluxo A (F-01 a F-22) na URL de produção | Mesmos resultados do local | ☐ | |
| D-04 | DevTools → Application → Cookies | `discord_session`: HttpOnly ✔, Secure ✔, SameSite=Lax, Path=/ | ☐ | |
| D-05 | Janela anônima na página pública de produção | Abre sem login | ☐ | |
| D-06 | Migrations aplicadas no remoto | `npx wrangler d1 migrations list DB --remote` sem pendências | ☐ | |
