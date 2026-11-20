# Relatório de QA — Gerenciador de Fichas e Rolagens

**Data:** 20/11/2026  
**Site testado:** <https://avalia2026-2-1uj.pages.dev>  
**Escopo estático:** `functions/api/` e `public/`  
**Limitação:** não foi usado login Discord válido. Portanto, fluxos autenticados em produção, criação persistente de fichas e rolagens reais não foram executados; esses aspectos foram avaliados somente pela implementação.

## Parte A — Testes reais no site publicado

As chamadas foram feitas sem sessão, sem seguir redirecionamentos automaticamente. Nos testes de POST foram enviados corpos JSON válidos para garantir que a falta de autenticação fosse o motivo da recusa.

| Item | O que foi testado | Resultado esperado | Resultado obtido | Status | Reprodução |
|---|---|---|---|---|---|
| A1 | `GET /api/me`, `GET /api/characters` e `GET /api/rolls`, sem cookie | Cada rota responde `401` | As três responderam `401` | **PASSOU** | `curl -i https://avalia2026-2-1uj.pages.dev/api/me` e repetir para `/api/characters` e `/api/rolls` |
| A2 | `POST /api/characters` e `POST /api/rolls`, sem cookie, com JSON válido | Cada rota responde `401` e não processa a operação | Os dois POSTs responderam `401` | **PASSOU** | Enviar JSON válido com `curl -i -X POST -H "Content-Type: application/json" --data '<JSON>' https://avalia2026-2-1uj.pages.dev/api/characters` e repetir em `/api/rolls` |
| A3 | Cookie `discord_session` forjado com JSON e com ID hexadecimal inventado; GET e POST nas rotas de fichas/rolagens e GET `/api/me` | Sessões inexistentes ou malformadas continuam sem autenticar (`401`) | Todas as chamadas testadas responderam `401` | **PASSOU** | Repetir os testes anteriores com `-H "Cookie: discord_session=%7B%22user_id%22%3A%22forged%22%7D"` e depois com `-H "Cookie: discord_session=<64 caracteres hexadecimais inventados>"` |
| A4 | `GET /api/auth/discord/callback?code=qa-code&state=qa-invented-state`, sem cookie de state | Recusar e redirecionar com `auth_error` | Respondeu `302`, `Location: /?auth_error=invalid_state` | **PASSOU** | `curl -i --max-redirs 0 "https://avalia2026-2-1uj.pages.dev/api/auth/discord/callback?code=qa-code&state=qa-invented-state"` |
| A5 | `POST /api/status` | Método não permitido (`405`) | Respondeu `405` | **PASSOU** | `curl -i -X POST https://avalia2026-2-1uj.pages.dev/api/status` |
| A6 | GET de `/wrangler.jsonc`, `/.dev.vars` e `/migrations/0002_fichas.sql` | Não revelar conteúdo de configuração, segredos ou migrações | Cada caminho respondeu `200 text/html`, com corpo de 6.582 bytes e SHA-256 igual ao da página `/`. Nenhum conteúdo dos arquivos foi servido; o host devolveu a página inicial como fallback | **PASSOU, com observação** | `curl -i https://avalia2026-2-1uj.pages.dev/wrangler.jsonc` e repetir para `/.dev.vars` e `/migrations/0002_fichas.sql`. Comparar o corpo com o de `/` |

**Nota sobre A6:** os caminhos protegidos não expuseram seus arquivos, mas responderam `200` em vez de `404`. Isso pode confundir verificações automatizadas de exposição; recomenda-se retornar `404` explícito para arquivos inexistentes ou não publicados.

## Parte B — Revisão estática de `functions/api/` e `public/`

Esta parte é uma leitura do código, não uma confirmação de comportamento autenticado no ambiente publicado.

| Item | O que foi verificado | Resultado esperado | Resultado observado no código | Status |
|---|---|---|---|---|
| B1 | Sessão e propriedade nas rotas de ficha | Validar a sessão; listar/criar/ler/editar/excluir somente fichas do usuário autenticado; nunca aceitar dono do corpo | O helper valida uma sessão existente e não expirada no D1. A listagem filtra por `owner_id`; a criação define o dono pelo usuário da sessão e rejeita campos extras; as operações por ID incluem o dono no filtro | **PASSOU** |
| B2 | Sessão e identidade nas rolagens | Validar sessão; associar a rolagem ao usuário autenticado; conferir propriedade do personagem | O POST confere que o personagem pertence ao usuário da sessão e grava `user_id`/`username` obtidos da sessão, não do corpo. O GET retorna as últimas rolagens de todos os jogadores, conforme o requisito do log compartilhado da mesa; não é uma rota anônima, pois a verificação de sessão ocorre antes | **PASSOU, conforme requisito; observar compartilhamento** |
| B3 | Validação de entrada | Rejeitar dados incompletos, tipos incorretos, intervalos inválidos, dados e atributos desconhecidos | A ficha valida textos, nível inteiro de 1–20 e atributos inteiros de 1–30. A rolagem valida `characterId`, whitelist dos seis atributos e whitelist `d4`, `d6`, `d8`, `d10`, `d12`, `d20`. Corpos inválidos resultam em `400` | **PASSOU** |
| B4 | Aleatoriedade e modificador | Gerar o resultado no servidor sem viés; calcular modificador com o atributo salvo | A função usa `crypto.getRandomValues` e rejeita os valores fora do intervalo divisível pelo número de lados antes do módulo. O modificador é calculado no servidor com `Math.floor((valor_salvo - 10) / 2)` | **PASSOU** |
| B5 | SQL injection / interpolação | Usar parâmetros vinculados; validar qualquer identificador SQL dinâmico antes de interpolar | As operações usam `prepare(...).bind(...)`. A única interpolação identificada na consulta de rolagem é o nome do atributo, que é validado contra a whitelist antes de compor a coluna. Não foi identificado caminho de entrada arbitrária para a consulta | **PASSOU** |
| B6 | Cookies e state OAuth | Cookie de sessão protegido; state aleatório enviado e validado no callback | O state é gerado com 32 bytes aleatórios, enviado na URL OAuth e guardado em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=600`. O callback exige igualdade exata com o cookie. O cookie de sessão contém ID aleatório hexadecimal e usa `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=86400`; logout remove a sessão e expira o cookie | **PASSOU** |
| B7 | Renderização de dados da API | Usar APIs seguras de texto, sem injetar HTML recebido | A interface renderiza texto com `textContent` e elementos DOM; não foi encontrada ocorrência de `innerHTML`, `insertAdjacentHTML` ou `outerHTML` em `public/` | **PASSOU** |
| B8 | Tratamento de exclusão HTTP 409 | Mostrar a mensagem solicitada quando a ficha tem rolagens | O servidor retorna `409` para ficha com rolagens associadas. A interface reconhece esse status e mostra “Esta ficha já tem rolagens registradas e não pode ser excluída” | **PASSOU** |

Arquivos de evidência: [`functions/api/`](../functions/api/), [`public/app.js`](../public/app.js) e [`public/index.html`](../public/index.html).

## Parte C — Conferência da rubrica

| Item | O que foi conferido | Resultado esperado | Resultado observado | Status |
|---|---|---|---|---|
| C1 | Licença MIT | Licença MIT presente | O arquivo [`LICENSE`](../LICENSE) consta no inventário do projeto, mas seu conteúdo não foi lido nesta execução; não é possível confirmar o texto/licença somente pela presença do arquivo | **NÃO VERIFICADO** |
| C2 | Chave única no README | `P26-2C-4AD5-930A-A7BE-770B` aparece no README | O arquivo [`README.md`](../README.md) consta no inventário, mas seu conteúdo não foi lido nesta execução | **NÃO VERIFICADO** |
| C3 | Chave, turma e licença no rodapé | Rodapé contém a chave `P26-2C-4AD5-930A-A7BE-770B`, Turma 2C e MIT | O rodapé da interface contém os três itens | **PASSOU** |
| C4 | Ausência de framework de UI | Interface em HTML, CSS e JavaScript puro | A página carrega o CSS e `app.js`; não há framework nem biblioteca de UI referenciada | **PASSOU** |
| C5 | Arquivos de agentes e skills | Arquivos em `.github/agents/` e diretórios em `skills/` | A listagem do projeto mostrou `backend.agent.md`, `frontend.agent.md`, `qa.agent.md` e as skills `serverless-d1-discord`, `teste-validacao` e `vanilla-dom-ui` | **PASSOU (existência)** |

## Recomendações, ordenadas por gravidade

1. **Baixa — confirmar/documentar a visibilidade do log:** `GET /api/rolls` inclui rolagens e nomes de todos os jogadores autenticados, conforme o requisito de log compartilhado. Confirmar que os usuários da mesa estão cientes desse compartilhamento.
2. **Baixa — respostas para caminhos de arquivos:** configurar os caminhos de arquivos não publicados para responder `404`, evitando `200` com fallback da página inicial em `/wrangler.jsonc`, `/.dev.vars` e `/migrations/0002_fichas.sql`.
3. **Pendente de verificação — conclusão da rubrica:** revisar o conteúdo de `LICENSE` e `README.md` para confirmar a licença MIT e a chave do README. Essa leitura ficou fora do escopo de arquivos definido para esta auditoria.
4. **Pendente de ambiente — autenticação real:** executar uma rodada autenticada de staging com conta de teste para validar persistência D1, edição, rolagem e logout de ponta a ponta. Não foi possível fazer isso sem credenciais Discord.

## Limites e conclusão

Os testes reais sem sessão passaram: as rotas protegidas recusaram acesso, cookies forjados não autenticaram, o callback recusou state sem cookie, `POST /api/status` retornou `405` e os caminhos de arquivos não revelaram conteúdo. A revisão estática também passou nos controles de autorização, validação, SQL parametrizado, geração de rolagens, state/cookies e renderização. A auditoria não confirma fluxos com sessão legítima e deixa dois itens da rubrica inconclusivos por não ter lido o conteúdo do README e da licença.
