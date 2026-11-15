# Registro de Validação — P26-2B-273A-9914-8600-DE35

Evidências produzidas pelo agente de teste e validação. Cada entrada diz o que
foi executado, o que contaria como falha, e o que de fato aconteceu.

Um teste que não pode falhar não prova nada — por isso o critério de falha está
escrito antes do resultado, e não depois.

---

## V1 — Restrição de voto único no banco

**Data:** 10/11/2026
**Agente:** `qa-validacao`
**Harness:** Claude (sessão com acesso ao sistema de arquivos da máquina)
**Ambiente:** Cloudflare D1 local (`wrangler d1 execute DB --local`)

### Por que este teste existe

O enunciado exige que cada estudante vote **apenas uma vez** em cada
publicação. A pergunta não é se a interface esconde o botão depois do voto — é
se o sistema recusa o segundo voto quando alguém chama o banco ou o endpoint
diretamente, por fora da tela.

### Preparação

```
INSERT INTO discord_users (user_id, username, avatar) VALUES ('111', 'teste', NULL);
INSERT INTO publicacoes (autor_id, tipo, titulo, conteudo, categoria)
  VALUES ('111', 'snippet', 'Teste', 'console.log(1)', 'JavaScript');
INSERT INTO votos (publicacao_id, usuario_id) VALUES (1, '111');
```

Resultado: `3 commands executed successfully.` — o primeiro voto é aceito, como
deve ser.

### O teste

```
INSERT INTO votos (publicacao_id, usuario_id) VALUES (1, '111');
```

**O que contaria como falha:** o comando ser aceito. Se o segundo voto entrasse,
a restrição não estaria valendo e o requisito não estaria cumprido, mesmo que a
interface escondesse o botão.

### Resultado observado

```
ERROR  UNIQUE constraint failed: votos.publicacao_id, votos.usuario_id:
SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)
```

**Situação: aprovado.** A recusa vem do banco, na camada mais baixa, e portanto
vale independentemente de qualquer erro nas camadas acima.

Evidência em imagem: [`validacao/v1-voto-unico.png`](./validacao/v1-voto-unico.png)

### O que este teste NÃO cobre

- Não testa o endpoint HTTP de voto: isso é o V-futuro, depois que
  `functions/api/votos` existir. O endpoint precisa capturar este erro e
  responder 409, em vez de deixar vazar um 500.
- Não testa o banco remoto, só o local. A migration ainda não foi aplicada em
  produção.

---

## V2 — Deploy online e conexão com o D1 de produção

**Data:** 10/11/2026
**Agente:** `qa-validacao`
**Harness:** Claude (navegador integrado + sistema de arquivos)
**URL:** https://p26-2b-273a-9914-8600-de35.pages.dev

### Por que este teste existe

O item 1 da rubrica é eliminatório: sem a aplicação no ar e funcionando, os
outros 75 pontos não contam. Além disso, o `validar-local.mjs` busca a URL do
README e confere se a chave aparece no HTML que voltou — ou seja, a verificação
é automática e não aceita a palavra do aluno.

### O que foi verificado

**Chave no rodapé.** Lido do HTML servido pelo site publicado, não da
aparência da tela:

```
Chave Única de Auditoria: P26-2B-273A-9914-8600-DE35 · Turma 2B · Licenciado sob MIT
```

**O que contaria como falha:** a chave estar apenas no arquivo local e não na
resposta do servidor.

**Banco em produção.** `GET /api/status` respondeu:

```json
{"ok":true,"chave":"P26-2B-273A-9914-8600-DE35","projectId":19,
 "d1Connected":true,"discordOAuthConfigured":false,"totalRegistros":0}
```

**O que contaria como falha:** `d1Connected: false`, que indicaria binding
ausente — o erro clássico de aplicar as migrations só no banco local e publicar
sem as tabelas.

**Situação: aprovado** nos dois pontos.

### Configuração registrada

- Projeto Pages: `p26-2b-273a-9914-8600-de35`
- Production branch: `main`
- Root directory: `P26-2B-273A-9914-8600-DE35`
- Build output directory: `public`
- Build command: vazio
- Banco D1 `db-p26-2b-273a-9914-8600-de35`, binding `DB`, migrations 0001 e
  0002 aplicadas em `--local` e `--remote`

### O que este teste NÃO cobre

- `discordOAuthConfigured: false` — o login do Discord ainda não existe. O
  perfil "Discord: Guilherme (discord_de35)" que aparece na tela é o placeholder
  do scaffold, não uma sessão real.
- Nenhuma funcionalidade do Projeto #19 foi implementada ainda: o que está no ar
  é o painel de diagnóstico gerado pelo `iniciar.mjs`.

---

## V3 — Login com Discord OAuth2 de ponta a ponta

**Data:** 10/11/2026
**Agente:** `auth-discord` implementou; `qa-validacao` verificou
**Harness:** Claude (sistema de arquivos + navegador integrado para configurar
o Discord Developer Portal); execução do servidor local pelo Guilherme
**Ambiente:** `wrangler pages dev` em `http://localhost:8788`

### Por que este teste existe

O item 2 da rubrica exige login **exclusivo** via Discord OAuth2 importando
`user_id`, nome e avatar. Chegar na tela inicial depois de autorizar não prova
nada: o redirect pode acontecer sem que a sessão tenha sido criada. A prova é
o servidor reconhecer a pessoa numa requisição seguinte.

### O teste

`GET /api/auth/eu` após completar o fluxo de autorização.

**O que contaria como falha:** `{"autenticado": false}`, ou ausência de
`avatarUrl` — que indicaria que o hash do avatar não foi convertido em URL.

### Resultado observado

```json
{
  "autenticado": true,
  "userId": "6990363395421xxxxx",
  "nome": "Guilherme Tyszkouski",
  "avatarUrl": "https://cdn.discordapp.com/avatars/6990363395421xxxxx/cd741ffc...png?size=128"
}
```

(identificador parcialmente omitido: o repositório é público)

**Situação: aprovado.** Uma única resposta prova cinco etapas: validação do
`state`, troca do `code` por `access_token`, segunda chamada a
`GET /users/@me`, gravação em `discord_users` e leitura do cookie assinado.

### Decisões de segurança verificadas no código

- `state` aleatório gerado no início e conferido no retorno, contra CSRF de
  login. A documentação do Discord o trata como opcional e recomendado.
- Troca do código feita servidor-a-servidor; o Client Secret nunca chega ao
  navegador.
- Corpo da troca em `application/x-www-form-urlencoded` — a documentação do
  Discord rejeita JSON nesse endpoint.
- Escopo `identify` apenas. `email` não foi solicitado: o projeto não precisa,
  e cada escopo a mais é dado pessoal sob nossa responsabilidade.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS, com expiração explícita.
- Chave do usuário é o `id` do Discord, não o nome: `global_name` e `username`
  mudam quando a pessoa troca o apelido, e a autoria dos resumos se perderia.
- `/api/auth/sair` é POST, não GET: com GET, uma tag `<img>` em qualquer site
  deslogaria quem visitasse a página.

### O que este teste NÃO cobre

- Produção: os segredos ainda não foram enviados ao Cloudflare Pages, então o
  login só funciona em `localhost`. `GET /api/status` em produção continua
  reportando `discordOAuthConfigured: false`.
- Expiração da sessão após sete dias não foi testada.
- A interface ainda mostra o perfil fictício do scaffold; ela não consome
  `/api/auth/eu` ainda.

---

## V4 — Login com Discord em produção

**Data:** 10/11/2026
**Agente:** `qa-validacao`
**URL:** https://p26-2b-273a-9914-8600-de35.pages.dev

Segredos enviados ao Cloudflare Pages por stdin
(`wrangler pages secret put`), de modo que os valores não passaram pela tela
nem pela linha de comando. Eles só valem a partir do deploy seguinte, e foi
por isso que este teste veio depois do merge.

**O que contaria como falha:** `discordOAuthConfigured: false` em
`/api/status`, ou `autenticado: false` em `/api/auth/eu` após autorizar.

### Resultado

`GET /api/status` → `"d1Connected": true, "discordOAuthConfigured": true`

`GET /api/auth/eu` após login → `autenticado: true`, com nome e URL de avatar
válida servida pelo CDN do Discord.

**Situação: aprovado.** O fluxo funciona no endereço público, não apenas em
`localhost` — distinção que importa porque o `validar-local.mjs` busca a URL
do README e o corretor avalia o site no ar.

### O que este teste NÃO cobre

- Nenhuma funcionalidade do Projeto #19 ainda: publicar, buscar, copiar e
  votar continuam por fazer.
- A interface ainda é a do scaffold e mostra um perfil fictício; não consome
  `/api/auth/eu`.

---

## V5 — Regras de negócio no servidor: voto único e autoria

**Data:** 10/11/2026
**Agente:** `api-functions` implementou; `qa-validacao` verificou
**Harness:** Claude (sistema de arquivos); execução pelo Guilherme no console
do navegador, chamando os endpoints **por fora da interface**

### Por que estes testes existem

O item 2 da rubrica exige validação das regras "no servidor, sem confiar apenas
no cliente". Testar clicando num botão da tela não prova isso — prova apenas
que a tela funciona. Estes testes chamam os endpoints diretamente, que é o que
um usuário mal-intencionado faria.

### Teste A — voto único no endpoint

Primeiro voto em `POST /api/publicacoes/1/voto`:

```json
{"publicacaoId": 1, "totalVotos": 2}
```

Segundo voto, mesmo usuário, mesma publicação:

```
HTTP/1.1 409 Conflict
{"erro": "Voce ja votou nesta publicacao."}
```

**O que contaria como falha:** o voto entrar de novo (regra ausente), ou vir
`500` (o erro do banco vazando sem tratamento, dizendo "o servidor quebrou"
quando na verdade ele funcionou como projetado).

**Situação: aprovado.** Fecha a pendência registrada em V1, que havia provado
a restrição apenas no nível do SQL.

### Teste B — autoria não pode ser forjada

`POST /api/publicacoes` com um campo `autor_id: "999"` enfiado no corpo, além
dos campos legítimos. Resposta: `{"id": 2}`.

Na listagem seguinte, a publicação 2 aparece com
`autor: "Guilherme Tyszkouski"` e `souAutor: true`.

**O que contaria como falha:** a publicação aparecer com autor `999`, ou com
qualquer autor que não fosse o dono da sessão.

**Situação: aprovado.** O campo foi silenciosamente ignorado: a autoria sai da
sessão verificada, e não existe caminho no código em que um valor vindo do
corpo chegue à coluna `autor_id`.

### Observação sobre a arquitetura

A Function de voto não implementa a regra — ela traduz a recusa do banco em
`409`. Se a regra vivesse no código, como um "já votou?" seguido de `INSERT`,
duas requisições simultâneas poderiam passar as duas pela verificação antes de
qualquer uma gravar. Com a restrição no banco, a segunda falha sempre.

### O que estes testes NÃO cobrem

- Os endpoints ainda não foram exercitados em produção.
- Limites de tamanho de título e conteúdo e categoria fora da lista foram
  implementados mas não testados.
- A interface ainda não consome nenhum destes endpoints.

---

## V6 — Interface consumindo os endpoints, em ambiente local

**Quando:** 15/11/2026, servidor `wrangler pages dev` em `localhost:8788`,
branch `feat/interface`.

**Agente responsável:** Agente 6 (Interface Vanilla), com o Agente 7 (Teste e
Validação) conduzindo os testes.

**Harness:** navegador integrado do Claude, apontado para o servidor local da
máquina do autor. Isso permitiu ler o DOM e o estado dos botões diretamente,
em vez de julgar por captura de tela.

**O que esta entrada prova:** que a interface em HTML5, CSS3 e JavaScript puro
exercita, pela tela, as mesmas regras que V5 provou por chamada direta.

### Teste A — sessão refletida no cabeçalho e no formulário

Página aberta sem sessão: aparece o botão "Entrar com Discord", o aviso de
login, e os campos do formulário chegam desabilitados. Depois do login pelo
Discord: o botão some, aparecem avatar e nome vindos de `/api/auth/eu`, e os
campos ficam habilitados.

**O que contaria como falha:** o formulário nascer habilitado para quem não
entrou, ou o nome e o avatar virem de algo guardado no navegador em vez de uma
resposta do servidor.

**Situação: aprovado.**

### Teste B — publicação e listagem ordenada

Publicado um snippet de categoria SQL. Resposta `201`, formulário limpo,
mensagem "Publicado.". Depois de recarregar a página, a lista voltou do
servidor com três publicações, na ordem **2, 1 e 0 votos**.

**O que contaria como falha:** a lista aparecer em ordem de criação, ou a
ordem só existir até o primeiro recarregamento — sinal de que estaria sendo
feita no JavaScript e não no SQL.

**Situação: aprovado.** Não existe `.sort()` no cliente; a ordem é a do
`ORDER BY total_votos DESC` da consulta.

### Teste C — busca dinâmica

Digitado `join` na caixa de busca, sem apertar nada. A listagem passou de três
para uma publicação, a que contém `LEFT JOIN` no título e no conteúdo.

**O que contaria como falha:** a filtragem acontecer no array já carregado no
navegador. Isso pareceria igual nesta escala e quebraria na primeira
paginação, além de nunca encontrar o que não tivesse sido baixado.

**Situação: aprovado.** O termo vai como `?q=` e é aplicado no SQL com
parâmetro vinculado.

### Teste D — voto pela interface e estado após recarregar

Clique no botão de voto: contador foi de 0 para 1 e o botão ficou verde e
desabilitado. Recarregando a página, ele **voltou já nesse estado**, porque o
`jaVotei` vem da consulta ao banco.

Em seguida, com a sessão já tendo votado, uma chamada direta ao endpoint a
partir do console da própria página devolveu:

```
409  {"erro": "Voce ja votou nesta publicacao."}
```

**O que contaria como falha:** o estado "já votei" existir apenas na memória
da página, sumindo ao recarregar — o que indicaria que o voto único estaria
sendo controlado pela tela e não pelo banco.

**Situação: aprovado.** O botão desabilitado é conveniência; quem recusa o
segundo voto é a restrição `UNIQUE (publicacao_id, usuario_id)`.

### Teste E — copiar para a área de transferência

Clique no botão "Copiar" de um snippet, feito por uma pessoa, seguido de colar
em outro campo: veio `console.log(1)`, o conteúdo da publicação.

Registrado também o caminho de erro: quando o clique é disparado por script em
vez de por uma pessoa, o navegador recusa com `NotAllowedError`, porque a API
exige gesto do usuário. Nesse caso a página seleciona o texto e troca o rótulo
do botão para "Selecione e copie", em vez de falhar calada.

**O que contaria como falha:** o botão não fazer nada quando a API é recusada,
deixando a pessoa sem saber se copiou.

**Situação: aprovado.**

### Dois defeitos encontrados e corrigidos durante estes testes

Ambos de texto, achados por ler o DOM e não por olhar a tela:

1. A contagem da lista saía como "2 publicacaes" — plural montado por
   concatenação dentro do template. Trocado por uma escolha explícita entre
   "publicacao" e "publicacoes".
2. Depois de votar, o rótulo continuava "votos" mesmo quando o total ia para
   1. O rótulo passou a ser atualizado junto com o número.

Registrados aqui porque uma validação que só lista acertos não é validação.

### O que este teste NÃO cobre

- Tudo isto é **local**. A mesma bateria precisa ser repetida no endereço
  público, com o banco de produção, que hoje está vazio.
- A interface não foi testada em tela de celular, nem com leitor de tela.
- Conteúdo com HTML dentro (`<script>`) não foi submetido como caso de teste;
  a defesa existe no código, que monta tudo por `textContent` e nunca por
  `innerHTML`, mas não há prova registrada.
- Não foi testado o comportamento com a sessão expirando no meio do uso.

---

## V7 — A aplicação inteira no endereço público

**Quando:** 15/11/2026, após o merge de `feat/interface` e `fix/acentos` no
`main`, com o deploy automático do Cloudflare Pages concluído.

**Onde:** `https://p26-2b-273a-9914-8600-de35.pages.dev`, banco D1 de produção.

**Agente responsável:** Agente 7 (Teste e Validação).

**Harness:** navegador integrado do Claude para as verificações automatizáveis,
e o Chrome do autor para as que exigem gesto humano.

**Por que esta entrada existe:** V6 provou a interface em `localhost`, contra o
banco local. Um projeto que só funciona na máquina de quem escreveu não está
entregue. Esta entrada repete a bateria no endereço que o avaliador vai abrir.

### Teste A — login em produção

`GET /api/auth/eu` no endereço público: `autenticado: true`, nome
`Guilherme Tyszkouski`, URL de avatar presente, e o cabeçalho da página
mostrando os dois.

**O que contaria como falha:** `autenticado: false` depois de um login
aparentemente bem-sucedido — o caso em que o redirect acontece mas o cookie
não é gravado, ou é gravado com domínio errado.

**Situação: aprovado.**

### Teste B — publicação em produção

Seis publicações criadas pelo endpoint, todas com resposta `201` e id
sequencial de 1 a 6. O banco de produção estava vazio até então.

**O que contaria como falha:** `500` por tabela ausente — o caso em que as
migrations foram aplicadas apenas em `--local` e esquecidas em `--remote`.

**Situação: aprovado.**

### Teste C — busca em produção, e uma sondagem de injeção

| Consulta | Resultado |
|---|---|
| sem filtro | 6 publicações |
| `?q=ponteiro` | 1 — casou pelo título |
| `?q=COUNT` | 1 — casou pelo conteúdo, texto que só existe dentro do código |
| `?categoria=Redes` | 1 |
| `?q=' OR 1=1 --` | **0** |

A última linha é o ponto. Buscar literalmente `' OR 1=1 --` devolveu zero
resultados, não seis. Se o termo fosse concatenado na consulta, aquilo teria
encerrado a string e tornado a condição sempre verdadeira, trazendo a tabela
inteira. Zero é a resposta de quem procurou esse texto dentro dos títulos e
não o encontrou — que é o comportamento de um parâmetro vinculado.

**O que contaria como falha:** essa consulta devolver qualquer resultado.

**Situação: aprovado.** Vale registrar o limite: isto é uma sondagem de um
caso, não uma auditoria de segurança.

### Teste D — voto, ordenação e voto repetido em produção

Três votos dados pela interface, pelo autor, em três publicações distintas. A
listagem seguinte veio com as três votadas (1 voto cada) antes das três não
votadas (0 votos).

Tentativa de votar de novo em uma já votada, chamando o endpoint por fora da
tela:

```
409  {"erro": "Você já votou nesta publicação."}
```

**O que contaria como falha:** o segundo voto entrar, ou a ordenação não
refletir os votos depois de recarregar a página.

**Situação: aprovado.**

### Teste E — copiar em produção, e uma recusa que valeu a pena

Clique humano em "Copiar", no Chrome: o conteúdo da publicação foi para a área
de transferência e colou íntegro, com acentos.

Antes disso, o mesmo clique no navegador integrado **falhou**. A investigação
mostrou `navigator.permissions.query({name: "clipboard-write"})` devolvendo
`denied` naquele navegador, e a escrita falhando com `NotAllowedError`. Não é
defeito da aplicação: aquele navegador embutido não concede a permissão para
origens HTTPS comuns, enquanto `localhost` é tratado de forma permissiva por
padrão — o que explica V6 ter passado e esta tentativa não.

O caminho de erro se comportou como projetado: a página trocou o rótulo para
"Selecione e copie" e selecionou o texto, em vez de não fazer nada.

**O que contaria como falha:** o botão ficar inerte quando a API é recusada.

**Situação: aprovado**, com a observação de que a cópia depende de uma
permissão do navegador de quem usa, e por isso o plano B existe.

### O que esta bateria NÃO cobre

- Um segundo usuário. Tudo foi exercitado com uma conta só, então o caso de
  duas pessoas votando na mesma publicação só foi provado em `localhost`
  (V1 e V5), nunca em produção.
- Concorrência real: dois votos simultâneos. O argumento de que a restrição no
  banco resolve isso é estrutural, não medido.
- Conteúdo malicioso submetido de verdade (`<script>` dentro de um resumo). A
  defesa está no código, que monta tudo por `textContent`, mas não há prova
  registrada.
- Celular e leitor de tela.
- Comportamento quando a sessão expira com a página aberta.
