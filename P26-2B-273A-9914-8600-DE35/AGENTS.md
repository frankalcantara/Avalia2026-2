# Documentação de Engenharia de Agentes e Harness (P26-2B-273A-9914-8600-DE35)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

Este projeto usa **sete agentes**, cada um com uma fronteira de pastas
explícita. Cada ficha abaixo marca a **Situação** do agente: `operou` quando o
trabalho já foi feito e está no histórico de commits, `previsto` quando ainda
não aconteceu. Nenhuma entrega está descrita antes de existir — essa é uma
regra do próprio projeto, documentada na seção de regras comuns.

---

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** **Claude (Cowork)**, com acesso ao sistema de arquivos
  da máquina de desenvolvimento e a um navegador integrado. O navegador foi o
  que permitiu configurar o Cloudflare Pages e o Discord Developer Portal sem
  intervenção manual, parando apenas nos pontos que exigem decisão humana
  (aceite de termos, digitação de senha, cópia do Client Secret).
- **Harness Secundário:** **GitHub Copilot (agentes em `.github/agents/`)** no
  VS Code, usado no projeto anterior da disciplina e disponível aqui para as
  etapas de interface.
- **Modelo Base:** Claude Opus 5.
- **Execução:** os comandos de terminal (`wrangler`, `git`, `node`) foram
  executados pelo estudante na própria máquina; o agente redigiu e explicou
  cada um. Nenhum agente teve permissão de executar comandos destrutivos.
- **Estratégia de Coordenação:** os agentes não conversam entre si. O estudante
  é o barramento: leva a saída de um como entrada do próximo. A coordenação é
  feita por fronteira de pastas e por um contrato escrito — o agente de
  arquitetura define o modelo de dados e o formato da API; os demais
  implementam contra o que está escrito, sem inventar formato.

### Regras comuns a todos os agentes

1. **Honestidade.** Nenhum agente afirma ter testado o que não executou. Quando
   não validou, escreve "não validado". Toda verificação registrada em
   `docs/validacao.md` declara **o que contaria como falha** antes de declarar
   o resultado — um teste que não pode falhar não prova nada.
2. **Segredos.** Nenhum agente escreve o *valor* de um segredo em arquivo,
   commit, log ou mensagem de erro. Escreve o *nome*: `env.DISCORD_CLIENT_SECRET`.
   Os valores vivem em variáveis de ambiente na máquina e no cofre do
   Cloudflare Pages. O agente nunca leu o Client Secret: ele aparece como
   "Oculto por segurança" no portal do Discord e foi copiado pelo estudante.
3. **A regra de ouro da arquitetura.** As regras de negócio vivem no servidor.
   A autoria de uma publicação vem da sessão verificada, nunca de um campo
   enviado pelo cliente. O voto único é garantido por restrição no banco, não
   por esconder um botão na tela.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto de Dados e Contrato da API

- **Situação:** operou.
- **Harness:** Claude (Cowork).
- **Papel:** definir o modelo relacional e o formato das respostas da API, e
  registrar as decisões com as alternativas consideradas. Não escreve código de
  funcionalidade.
- **Skill Utilizada:** [`skills/arquitetura-contrato/SKILL.md`](./skills/arquitetura-contrato/SKILL.md)
- **Entregas Realizadas:**
  - Modelo com `publicacoes` e `votos`, apoiado na tabela `discord_users` que
    já existia, tendo o `user_id` do Discord como chave — e não o nome, que
    muda quando a pessoa troca o apelido e levaria a autoria junto.
  - Decisão sobre a contagem de votos: **calculada na consulta** com
    `LEFT JOIN + COUNT`, e não armazenada numa coluna. O contador
    desnormalizado seria mais rápido, mas exigiria manter dois lugares em
    sincronia. A decisão e o motivo estão em comentário dentro do próprio
    `migrations/0002_resumos_snippets.sql`.
  - Decisão sobre onde validar categoria: lista fechada em
    `functions/_lib/categorias.js`, e não `CHECK` no banco, porque a lista muda
    a cada semestre e um `CHECK` exigiria migration nova a cada mudança. O
    `tipo` (resumo/snippet), que não muda nunca, tem `CHECK` no banco.

### Agente 2: Especialista em Cloudflare D1 e Migrations

- **Situação:** operou.
- **Harness:** Claude (Cowork).
- **Papel:** esquema relacional, migrations numeradas e forward-only, e as
  restrições que carregam as regras do enunciado.
- **Fronteira:** `migrations/`.
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - `migrations/0002_resumos_snippets.sql` com `publicacoes`, `votos` e a view
    `publicacoes_com_votos`, usada pela listagem para não repetir o `JOIN` em
    cada endpoint.
  - **`UNIQUE (publicacao_id, usuario_id)`** na tabela `votos` — é esta linha
    que cumpre o requisito de voto único do enunciado.
  - Índices em `publicacoes(categoria)`, `publicacoes(autor_id)` e
    `votos(publicacao_id)`, este último porque contar votos por publicação é o
    caminho mais percorrido da aplicação.
  - Migrations aplicadas e conferidas em `--local` e `--remote`.

### Agente 3: Especialista em Autenticação Discord OAuth2

- **Situação:** operou.
- **Harness:** Claude (Cowork), incluindo o navegador integrado para configurar
  o Discord Developer Portal.
- **Papel:** fluxo OAuth2 completo e gestão de sessão.
- **Fronteira:** `functions/api/auth/`, `functions/_lib/sessao.js`.
- **Skill Utilizada:** [`skills/discord-oauth2/SKILL.md`](./skills/discord-oauth2/SKILL.md)
- **Entregas Realizadas:**
  - `GET /api/auth/discord` — monta a autorização com `state` aleatório contra
    CSRF de login.
  - `GET /api/auth/discord/callback` — confere o `state`, troca o código por
    token servidor-a-servidor, e faz a **segunda chamada** a
    `GET /users/@me`, necessária porque o Discord, diferente do Google, não
    devolve `id_token`.
  - `GET /api/auth/eu` e `POST /api/auth/sair`. O `sair` é POST e não GET: com
    GET, uma tag `<img>` em qualquer site deslogaria quem visitasse a página.
  - Sessão como cookie assinado com HMAC-SHA256, `HttpOnly`, `SameSite=Lax`,
    `Secure` em HTTPS, com expiração explícita. Não há tabela de sessões; o
    cookie carrega apenas o que pode ser público, porque ele não é
    criptografado.
  - Escopo `identify` apenas. `email` não foi solicitado: o projeto não precisa,
    e todo escopo a mais é dado pessoal sob responsabilidade do sistema.

### Agente 4: Especialista em Pages Functions e Regras de Negócio

- **Situação:** operou.
- **Harness:** Claude (Cowork).
- **Papel:** endpoints de publicar, listar, buscar e votar, com validação no
  servidor.
- **Fronteira:** `functions/api/publicacoes/`, `functions/_lib/categorias.js`.
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - `GET /api/publicacoes` — listagem ordenada por votos **no SQL**, com busca
    por `?q=` e filtro por `?categoria=`. A busca usa `LIKE` com parâmetro
    vinculado: a caixa de busca é texto do usuário indo direto para uma
    consulta, e é o caminho óbvio de injeção neste projeto.
  - `POST /api/publicacoes` — valida tamanho de título e conteúdo, tipo e
    categoria. O autor vem da sessão; um campo `autor_id` enviado pelo cliente
    é ignorado.
  - `POST /api/publicacoes/:id/voto` — **não implementa** a regra de voto
    único: captura a recusa do banco e traduz para `409 Conflict`. Se a regra
    vivesse no código, como um "já votou?" seguido de `INSERT`, duas
    requisições simultâneas poderiam passar as duas pela verificação antes de
    qualquer uma gravar.

### Agente 5: Agente de Teste, Validação e Auditoria (obrigatório pela rubrica)

- **Situação:** operou.
- **Harness:** Claude (Cowork), com navegador integrado para verificar o site
  publicado; execução dos comandos pelo estudante.
- **Papel:** verificação independente. **Não edita código de funcionalidade** —
  relata, e quem corrige é o agente dono da pasta. Quem escreve não é quem
  valida.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:** cinco validações registradas em
  [`docs/validacao.md`](./docs/validacao.md), cada uma declarando o critério de
  falha **antes** do resultado, e o que o teste não cobre:
  - **V1** — restrição de voto único provada no banco: o segundo `INSERT`
    falha com `UNIQUE constraint failed`.
  - **V2** — deploy no Cloudflare e `d1Connected: true` em produção, com a
    chave lida do HTML servido pelo servidor, não da aparência da tela.
  - **V3** — login Discord completo em `localhost`, provado por
    `/api/auth/eu`, não pelo redirect.
  - **V4** — o mesmo login funcionando no endereço público.
  - **V5** — voto duplo recusado com **409** chamando o endpoint **por fora da
    interface**, e tentativa de forjar autoria enviando `autor_id: "999"` no
    corpo, que foi ignorada.
  - **V6** — a interface inteira exercitada em `localhost`: sessão refletida no
    cabeçalho, publicação, ordenação vinda do SQL, busca dinâmica, voto e
    cópia. Dois defeitos de texto encontrados e corrigidos na própria bateria.
  - **V7** — a mesma bateria repetida no endereço público, contra o banco de
    produção, incluindo uma sondagem de injeção de SQL (`' OR 1=1 --`), que
    devolveu zero resultados em vez da tabela inteira.
- **Observação metodológica:** os testes de regra de negócio foram executados
  pelo console do navegador, chamando os endpoints diretamente. Testar clicando
  num botão provaria apenas que a tela funciona, não que o servidor recusa
  quem passa por fora dela.

### Agente 6: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)

- **Situação:** operou.
- **Harness:** Claude (Cowork), com navegador integrado apontado para o
  servidor local e depois para o endereço público; execução dos comandos pelo
  estudante.
- **Papel:** construir a interface consumindo os endpoints já prontos, usando
  exclusivamente HTML5 semântico, CSS3 e JavaScript puro.
- **Fronteira:** `public/`.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:** `public/index.html`, `public/styles.css` e
  `public/app.js`, substituindo o painel de diagnóstico do scaffold:
  formulário de submissão categorizado por linguagem ou matéria, listagem
  ordenada pelos mais votados, busca dinâmica, botão de copiar com
  `navigator.clipboard`, botão de votar refletindo se o usuário já votou, nome
  e avatar do Discord no cabeçalho, e a Chave Única no rodapé.
- **Decisões que este agente defendeu:**
  - conteúdo de terceiros entra na tela por `textContent` e `createElement`,
    nunca por `innerHTML` — o texto foi escrito por outro estudante, e
    concatenar HTML abriria XSS armazenado;
  - nenhuma regra de negócio foi trazida para o cliente: não há `.sort()` nem
    filtro em memória, e o estado "já votei" vem do banco, por isso sobrevive
    ao recarregamento;
  - a busca numera os pedidos e descarta resposta atrasada, porque debounce
    sozinho não impede que a resposta de uma consulta antiga chegue depois e
    sobrescreva a tela.
- **Limite respeitado:** este agente não alterou nenhum arquivo em
  `functions/`. Quando precisou de um dado que a API não devolvia, a mudança
  foi pedida ao Agente 4, não feita por ele.

### Agente 7: Agente de Entrega e Auditoria da Rubrica

- **Situação:** operou.
- **Harness:** Claude (Cowork); execução dos comandos pelo estudante.
- **Papel:** conferir cada item da rubrica contra o que existe, rodar
  `node validar-local.mjs P26-2B-273A-9914-8600-DE35`, manter o `README.md`
  com a chave e a URL pública, e abrir o Pull Request final.
- **Fronteira:** `README.md`, `LICENSE`, este arquivo.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - checklist da rubrica mantido item a item, com o estado de cada um e o que
    faltava para fechá-lo;
  - auditoria de isolamento por `git diff --name-only`, confirmando que nada
    fora de `P26-2B-273A-9914-8600-DE35/` foi tocado;
  - `node validar-local.mjs P26-2B-273A-9914-8600-DE35` executado na raiz do
    fork: **9 de 9** itens estruturais aprovados;
  - Pull Request final para `frankalcantara/Avalia2026-2`: PR #45, aberto e
    registrado pelo robô do repositório, com os cinco pré-requisitos técnicos
    marcados como OK no diagnóstico automático.
- **Ressalva que este agente fez questão de registrar:** o 9/9 do validador
  **não** é prova de que o projeto funciona. Ele confere presença, não
  substância: "Frontend Vanilla" passa porque existe um `.html` sem framework
  proibido, e "Deploy Online" passa porque a URL respondeu 200 com a chave no
  HTML. Houve um momento neste projeto em que o validador já devolvia 9/9
  enquanto o endereço público ainda servia o painel de diagnóstico do
  scaffold. A prova de funcionalidade são as sete validações em
  [`docs/validacao.md`](./docs/validacao.md), não este relatório.
- **Hipótese que este agente levantou e que estava errada:** durante todo o
  projeto, trabalhamos sob a premissa de que o robô do repositório oficial
  faria *squash merge* automático na abertura do Pull Request — ou seja, que
  abrir o PR seria entregar, sem volta. A premissa veio da leitura de
  `.github/scripts/avaliar-pr.mjs`, onde a chamada de merge foi interpretada
  como se rodasse na abertura.

  Ela custou uma decisão de projeto: o PR final foi deixado para depois da
  bateria V7 em produção, porque não haveria segunda chance.

  Ao abrir o PR, o robô respondeu que ele **permanece aberto**, que cada
  `git push` o atualiza sozinho, e que a avaliação e o merge oficial são
  feitos manualmente pelo professor a partir de 20/11/2026.

  Fica registrado em vez de apagado, porque é o tipo de erro que vale
  documentar: uma premissa lida de código, nunca confirmada contra o
  comportamento real, que guiou o planejamento até ser contrariada pelo
  próprio sistema. A ordem em que as coisas foram feitas continua defensável
  — entregar depois de validar em produção é melhor de qualquer forma —, mas
  ela foi escolhida pelo motivo errado.

---

## 3. Fluxo de trabalho adotado

Branch por frente de trabalho, com Pull Request interno para o `main` do fork,
em vez de commits diretos na branch principal. Até aqui:
`chore/estrutura-inicial`, `feat/esquema-d1`, `feat/api-publicacoes`,
`docs/agentes`, `feat/interface` e `fix/acentos`.

Uma correção de processo vale registro: a documentação dos agentes acabou
commitada dentro da branch `feat/api-publicacoes`, cujo nome não diz nada
sobre documentação. Em vez de abrir o Pull Request assim, os arquivos foram
levados para uma branch `docs/agentes` criada a partir do `main` atualizado.
Histórico em que o nome da branch mente sobre o conteúdo custa caro depois,
quando alguém procura quando uma decisão entrou.

O `main` é o que o Cloudflare publica. Nada entra nele sem passar por um Pull
Request, e o histórico fica auditável em
[`/commits/main`](https://github.com/Guilherme-Tyszkouski/Avalia2026-2/commits/main).

O Pull Request para `frankalcantara/Avalia2026-2` é **um só**, no fim, e toca
exclusivamente a pasta `P26-2B-273A-9914-8600-DE35/`.
