# Relatório de Testes

## Rodada 1 — API e auditoria estrutural

- **Data/hora:** 2026-11-20 18:37:46 -03:00
- **Escopo:** primeira rodada contra a API implementada pelo Backend Sênior; testes executados localmente no Wrangler e no D1 local.
- **Segredos/dados:** foram usados apenas usuários e tokens fictícios. O servidor foi iniciado com `DISCORD_CLIENT_ID=test-client-id` para testar o redirecionamento sem ler credenciais locais nem contatar o Discord durante o callback.

### Comandos executados

```powershell
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler d1 execute DB --local --file tests/seed.sql
npx.cmd wrangler pages dev --binding DISCORD_CLIENT_ID=test-client-id
curl.exe -sS -o NUL -w "%{http_code}" http://localhost:8788/api/cartoes
node --test tests/api.test.mjs
cd ..; node validar-local.mjs P26-2A-86CE-58AE-853D-C5AB
git status --short --untracked-files=all
git ls-files --error-unmatch -- P26-2A-86CE-58AE-853D-C5AB/.dev.vars
```

As migrações locais já estavam aplicadas (“No migrations to apply”). A carga de teste foi aplicada ao D1 local. O comando de `git ls-files` não encontrou `.dev.vars` rastreado. O validador fez somente GET ao endereço público indicado no README; não foram enviados métodos de escrita ao deploy nem usados comandos `--remote`.

### Casos da API

| Caso | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|
| Sem cookie em `GET /api/cartoes` e `GET /api/sessao` | Ambos `401` | Ambos `401` | Aprovado |
| Token de sessão inexistente | `401` | `401` | Aprovado |
| Cookie legado `discord_session` com JSON base64 | `401`, sem acesso | `401` nas duas rotas protegidas | Aprovado |
| Isolamento entre usuários | B não lista o cartão de A; PATCH e DELETE de B dão `404`; cartão de A permanece intacto | Lista de B não continha o cartão; PATCH/DELETE `404`; cartão de A intacto | Aprovado |
| Validações: coluna/prioridade inválidas; título vazio ou >120; descrição >1000; posição não numérica; ID não numérico; JSON inválido; PATCH sem campo permitido | `400` | Todos os nove cenários retornaram `400` | Aprovado |
| `user_id` enviado pelo cliente | Proprietário continua sendo o usuário da sessão | O cartão permaneceu com `user_id=111` após POST e PATCH forjados | Aprovado |
| Persistência e ordenação | PATCH persiste coluna/posição; GET ordena por coluna e posição | GET confirmou os valores e a ordem esperada | Aprovado |
| Exclusão própria | DELETE `204`; cartão ausente no GET seguinte | `204`; cartão ausente | Aprovado |
| SQL Injection e texto HTML | Strings retornam como texto e tabela segue disponível | Ambos os títulos foram salvos/retornados; GET seguiu funcionando | Aprovado |
| Erros seguros | Sem stack trace, SQL, caminho interno ou segredo | Corpos dos erros não continham esses dados | Aprovado |
| Logout isolado | Sessão própria retorna `204`; token passa a receber `401`; outras sessões continuam válidas | `204`, depois `401`; `teste-a` permaneceu autenticada | Aprovado |
| OAuth2: início e callback com state divergente | Redirecionamento com `state`, `scope=identify` e cookie protegido; callback divergente recusado | `302`, URL/cookie com atributos esperados; callback `400` | Aprovado |

**Resumo da suíte:** 12 casos aprovados, 0 reprovados, 0 ignorados (`node --test tests/api.test.mjs`).

### Auditoria da entrega

O comando `node validar-local.mjs P26-2A-86CE-58AE-853D-C5AB`, executado na pasta acima do projeto, marcou **9/9 itens como OK**:

1. LICENSE MIT.
2. Chave no README.
3. Item de chave no HTML marcado como OK pelo validador.
4. AGENTS documenta pelo menos três agentes.
5. Agente de teste e validação documentado.
6. Skills presentes.
7. Estrutura HTML e ausência das dependências/frameworks proibidos pelo validador.
8. Cloudflare Functions, D1 e OAuth Discord presentes.
9. Deploy online na Cloudflare.

Verificações adicionais: o primeiro endereço `.pages.dev` do README é `https://projeto-p26-2a-86ce-58ae-853d-c5ab.pages.dev` e a chave consta no README; o LICENSE contém as cláusulas da licença MIT; AGENTS informa o harness, contém os três títulos requeridos e tem 2.632 caracteres; há quatro arquivos `SKILL.md`; as alterações reportadas pelo `git status` estão dentro da pasta do projeto; `.dev.vars` não está rastreado pelo Git.

**Limite do validador:** o item 3 confirma a presença da chave no HTML recebido, mas não valida semanticamente se ela está dentro de um elemento `<footer>`. Essa inspeção detalhada foi adiada com as demais verificações do frontend.

### Defeitos encontrados

Nenhum defeito confirmado nos casos de API executados; não há arquivo ou agente responsável por correção nesta rodada.

### Limitações e roteiro manual para a próxima rodada

As verificações comportamentais do frontend foram adiadas, conforme o escopo desta rodada e porque a interface ainda será refeita. O fluxo real de autorização/troca de token com o Discord também não foi executado; apenas o redirecionamento de início e a rejeição de state divergente foram testados. Não foram feitas alterações de dados no site publicado.

Após a implementação da interface, executar localmente, com o ambiente Discord de teste configurado sem expor credenciais:

1. Abrir `http://localhost:8788` e iniciar login pelo Discord; confirmar que o perfil autenticado aparece.
2. Criar um cartão e confirmar título, descrição e prioridade.
3. Arrastar o cartão para outra coluna e reordená-lo dentro da coluna.
4. Editar o texto e mudar a prioridade; confirmar a persistência após recarregar.
5. Excluir o cartão e confirmar que não reaparece após recarregar.
6. Repetir a inspeção numa largura de celular, verificando uso e legibilidade dos controles.

Não executar operações de escrita no site publicado; para estes passos, usar somente o ambiente local.

## Rodada 2 — API, frontend pronto e auditoria da entrega

- **Data/hora:** 2026-11-20 19:01 -03:00
- **Escopo:** segunda rodada solicitada após a conclusão da interface; API no Wrangler/D1 local, verificações estáticas do frontend, requisições GET locais e públicas, auditoria estrutural e registro do teste manual informado pelo usuário.
- **Segredos/dados:** migrações e seed foram aplicados somente ao D1 local. O servidor local usou `DISCORD_CLIENT_ID=test-client-id`; nenhum segredo real foi lido. No site publicado foram feitas exclusivamente requisições GET.

### Comandos e verificações executados

```powershell
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler d1 execute DB --local --file tests/seed.sql
npx.cmd wrangler pages dev --binding DISCORD_CLIENT_ID=test-client-id
node --test tests/api.test.mjs
node validar-local.mjs P26-2A-86CE-58AE-853D-C5AB
git status --short --untracked-files=all
git ls-files --error-unmatch -- P26-2A-86CE-58AE-853D-C5AB/.dev.vars
```

Também foram feitos GET para `/` no servidor local, para `/api/sessao` local com sessões fictícias, e para `/`, `/api/sessao` e `/api/cartoes` no deploy. A análise estática cobriu `public/index.html`, `public/app.js` e `public/styles.css`, buscando API HTML Drag and Drop, persistência PATCH, APIs de inserção HTML, bibliotecas/frameworks e sombras de texto.

**Inicialização local:** a primeira execução da suíte ocorreu antes de o servidor local estar disponível e falhou nos 12 casos com `ECONNREFUSED` em `localhost:8788`. Foi classificada como falha de ambiente, não como defeito. As migrações indicaram “No migrations to apply”; o seed local foi executado com sucesso. Após iniciar o Wrangler, o GET local respondeu 200 e a suíte foi repetida com sucesso integral.

### Resultados da API local

| Caso | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|
| 1. GET de sessão e cartões sem cookie | Ambos `401` | Ambos `401` | Aprovado |
| 2. Token de sessão inexistente | `401` | `401` | Aprovado |
| 3. Cookie legado `discord_session` forjado | Sem autenticação, `401` | `401` nas duas rotas | Aprovado |
| 4. Isolamento entre usuários | B não lista cartão de A; PATCH e DELETE de B recebem `404`; cartão de A não muda | Todos os resultados esperados | Aprovado |
| 5. Validações inválidas | Nove entradas inválidas recebem `400` | Todos os nove cenários retornaram `400` | Aprovado |
| 6. `user_id` enviado pelo cliente | Proprietário definido pela sessão permanece A | `user_id=111` preservado | Aprovado |
| 7. Atualização e ordenação | PATCH persiste coluna/posição; GET retorna dados ordenados | Valores e ordem confirmados no GET seguinte | Aprovado |
| 8. Exclusão própria | DELETE `204`; cartão ausente no GET | `204`; cartão ausente | Aprovado |
| 9. Texto de SQL e HTML | Conteúdo armazenado como texto; tabela permanece funcional | Ambos os títulos retornados sem interromper os GETs | Aprovado |
| 10. Erros seguros | Sem stack trace, SQL, caminho interno ou segredo | Corpos examinados sem esses dados | Aprovado |
| 11. Logout | DELETE de sessão `204`; token encerrado recebe `401`; outra sessão continua válida | Todos os resultados esperados | Aprovado |
| 12. OAuth2 e `state` | Redirect contém `state` e `identify`, cookie protegido; callback divergente recusado | Redirect `302` e callback divergente `400` | Aprovado |

**Resultado final da suíte após iniciar o servidor:** 12 aprovados, 0 reprovados, 0 ignorados (`node --test tests/api.test.mjs`).

### Verificações do frontend

| Caso | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|
| GET local `/` sem login | HTTP `200`, sem redirecionamento automático ao Discord | `200`, sem cabeçalho `Location` | Aprovado |
| Rodapé e chave | Chave dentro de `<footer>` no HTML recebido e diretamente em `public/index.html` | Presente nas duas verificações | Aprovado |
| Acesso de visitante | Link “Entrar com Discord” para a rota de autenticação | Link presente em `index.html` e na resposta local | Aprovado |
| Drag and Drop | `draggable`, `dragstart`, `dragover` com `preventDefault()`, `drop` e `dragend`; sem Pointer Events/eventos de mouse como substitutos | API HTML nativa encontrada; não foram encontrados handlers alternativos | Aprovado |
| Inserção de conteúdo | Não usar `innerHTML`, `outerHTML`, `insertAdjacentHTML` ou `document.write` para dados | Nenhuma ocorrência nos arquivos frontend analisados; renderização de texto usa `textContent`/propriedades de formulário | Aprovado |
| Frameworks, bibliotecas e CDN | Nenhum framework/biblioteca de interface ou script externo; sem `package.json` com dependências | Nenhum framework/biblioteca ou script CDN encontrado; não há `package.json` no projeto | Aprovado |
| Sombras em texto | Sem `text-shadow` nem `filter: drop-shadow(...)` no CSS | Nenhuma ocorrência | Aprovado |
| Persistência de mudanças | Mover/posicionar, editar texto e alterar prioridade usam PATCH | Os handlers de arrasto, botões de mover, edição e prioridade convergem para PATCH `/api/cartoes/:id` | Aprovado |
| Perfil autenticado | Nome, avatar e botão Sair disponíveis após autenticação | Elementos e atualização do DOM encontrados; GET local de `teste-a` e `teste-b` respondeu `200` com nome/avatar | Aprovado |
| Colunas em celular | CSS adapta o quadro para uma coluna em telas menores | Regra responsiva define `grid-template-columns: 1fr` | Aprovado |

### Site publicado — somente GET

| Requisição | Resultado esperado | Resultado obtido | Status |
|---|---|---|---|
| GET `/` | HTTP `200` e chave no HTML | `200`; chave e link de visitante presentes | Aprovado |
| GET `/api/sessao` sem cookie | `401` | `401` | Aprovado |
| GET `/api/cartoes` sem cookie | `401` | `401` | Aprovado |

Não foram enviadas requisições POST, PATCH, PUT ou DELETE ao deploy.

### Auditoria da entrega

`node validar-local.mjs P26-2A-86CE-58AE-853D-C5AB`, executado na pasta pai, aprovou **9/9 itens**: LICENSE MIT; chave no README; chave no rodapé HTML; três agentes documentados; agente de teste/validação documentado; skills presentes; frontend sem frameworks proibidos; backend Functions/D1/OAuth; deploy Cloudflare online.

Verificações complementares:

- Primeiro endereço `.pages.dev` do README: `https://projeto-p26-2a-86ce-58ae-853d-c5ab.pages.dev`; chave presente.
- LICENSE contém o texto completo da licença MIT.
- AGENTS contém `### Agente 1`, `### Agente 2` e `### Agente 3`, identifica GitHub Copilot no VS Code como harness, descreve o Agente 3 e tem 2.677 caracteres (limite: 6.000).
- Encontrados quatro arquivos `SKILL.md` em `skills/`.
- `.dev.vars` não está rastreado pelo Git.
- O `git status` anterior ao registro estava limpo; após esta atualização, a única alteração esperada é este relatório em `docs/`, dentro da subpasta do projeto.

### Teste manual no site publicado — resultado informado pelo usuário

O usuário informou que executou o teste em uma aba anônima em **20/11/2026** e que todos os passos funcionaram. Este resultado é registrado como relato do usuário, não como execução independente desta rodada.

| Caso | Resultado esperado | Resultado informado | Status |
|---|---|---|---|
| Visitante sem login | Botão de entrada e rodapé com chave visíveis | Ambos visíveis | Aprovado — informado pelo usuário |
| Login real Discord | Nome e avatar no cabeçalho | Funcionou | Aprovado — informado pelo usuário |
| Criar cartão, editar título/descrição e mudar prioridade | Alterações disponíveis e salvas | Funcionou | Aprovado — informado pelo usuário |
| Arrastar entre colunas, reordenar na coluna e usar botões de mover | Todas as opções movimentam o cartão | Funcionou | Aprovado — informado pelo usuário |
| Recarregar com F5 | Estado permanece no lugar | Funcionou | Aprovado — informado pelo usuário |
| Excluir cartão | Cartão removido | Funcionou | Aprovado — informado pelo usuário |
| Visão de celular | Colunas empilhadas verticalmente | Funcionou | Aprovado — informado pelo usuário |
| Sair | Retorna à tela de visitante | Funcionou | Aprovado — informado pelo usuário |

### Defeitos e limitações

Nenhum defeito funcional confirmado nesta rodada. A única falha de execução foi a tentativa inicial da suíte antes de o servidor local iniciar; a repetição com o servidor ativo passou. O login real e os gestos de interface não foram reproduzidos independentemente nesta rodada; o resultado desses passos é o relato manual do usuário acima.
