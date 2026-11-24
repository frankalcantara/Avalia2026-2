# Documentação de Engenharia de Agentes e Harness (P26-2C-7C14-BF94-17E7-8463)

## 1. Harness utilizado
- **Harness:** opencode (terminal) para o desenvolvimento.
- **Modelo(s):** opencode/big-pickle (OpenCode Zen, modelo gratuito)
- **Como foi usado:** um agente por tarefa, com prompts que mandam ler as skills pelo caminho em skills/.

## 2. Agentes
### Agente 1: Backend (Functions, D1 e sessão)
- **Skills:** skills/serverless-d1-discord, skills/cloudflare
- **O que fez:** migração 0002_kanban.sql, rotas /api/cards, validação no servidor e sessão assinada com HMAC (functions/api/_lib/session.js).

### Agente 2: Interface (HTML, CSS e Vanilla JS)
- **Skills:** skills/vanilla-dom-ui, skills/frontend-design
- **O que fez:** quadro com três colunas, cabeçalho com perfil do Discord e rodapé com a chave.

### Agente 3: Kanban (Drag and Drop e integração com a API)
- **Skills:** skills/vanilla-dom-ui
- **O que fez:** arrastar e soltar nativo e chamadas PATCH ao servidor.

### Agente 4: Testes e validação (não edita arquivos)
- **Skills:** skills/teste-validacao
- **O que fez:** auditoria de segurança e relatório: 9/9 no `validar-local.mjs`, 81/81 na suíte de correções, 68/70 na suíte de regressão (as 2 falhas são asserções obsoletas que confirmam a correção de `/api/status`), XSS aprovado e logout validado no navegador.

### Agente 5: Modernização da interface (temas e acessibilidade)
- **Skills:** skills/frontend-design, skills/vanilla-dom-ui
- **O que fez:** sistema de tokens em CSS, temas claro e escuro com `data-theme`, alternância persistida em `localStorage`, layout responsivo sem rolagem horizontal, foco visível, regiões `aria-live`, botões de mover cartão por teclado e restauração de foco após mover, editar e apagar. Nenhuma chamada de API foi alterada.

### Agente 6: Testes da modernização (não edita o produto)
- **Skills:** skills/teste-validacao
- **O que fez:** criou e executou a suíte de tema/acessibilidade e o fluxo só de teclado, repetiu as suítes de regressão e a validação da rubrica, e registrou a correção de foco encontrada durante os testes.

## 3. Testes executados e resultados

### 3.1 Testes manuais no site publicado

Executados por mim no console do navegador, no endereço principal do projeto:

| Teste | Resultado esperado | Resultado obtido |
|---|---|---|
| Login com Discord | Nome e avatar no cabeçalho | Ok |
| `POST /api/cards` logado | 201 | Ok |
| `GET /api/cards` logado | 200 com a lista | Ok |
| Coluna inválida | 400 | Ok |
| Excluir id inexistente | 404 | Ok |
| Cookie `discord_session` alterado | 401 | Ok |
| `GET /api/cards` sem login (janela anônima) | 401 | Ok |
| Criar, editar, apagar e arrastar cartões, recarregando a página | Dados persistem no D1 | Ok |

### 3.2 Auditoria do agente de testes (primeira rodada)

O agente de testes e validação auditou o projeto sem editar nenhum arquivo. Resultado: `validar-local.mjs` com 9 de 9 itens ok e 68 de 70 verificações da suíte antiga da API. As 2 falhas são asserções obsoletas que esperavam o comportamento vulnerável antigo de `/api/status`; o resultado atual (401 sem sessão e nenhum registro de terceiros) confirma a correção. Passaram o isolamento por usuário, a sessão assinada, a validação no servidor, o SQL parametrizado, a proteção contra XSS e a ausência de frameworks e segredos no código.

A auditoria encontrou um problema grave no endpoint `/api/status`, herdado do template: ele aceitava gravações sem login e expunha registros de outros usuários. Foi corrigido para exigir sessão e filtrar por usuário. Também foi criada a rota `POST /api/auth/logout` e o botão "Sair". A segunda rodada confirmou as correções: a suíte de correções passou 81/81, a suíte antiga ficou 68/70 apenas pelas 2 asserções obsoletas de `/api/status`, o teste de XSS passou e o logout foi validado no navegador (27/28, sendo a única falha o log do 500 simulado pelo próprio teste). O deploy publicado também já responde com o fallback 404, o logout e o botão "Sair".

### 3.3 Rodada de modernização da interface

Bateria completa repetida contra os arquivos finais de `public/` (Wrangler local + Chrome headless). Nenhum arquivo de `functions/`, `migrations/` ou `wrangler.jsonc` foi alterado.

| Suíte | Cobertura | Resultado |
|---|---|---|
| `ui-flow.mjs` | criar, editar, apagar e arrastar; 401/400/404; mobile | 49/49 |
| `ui-tema-a11y.mjs` | tema pelo sistema, alternância e persistência, contraste nos dois temas, semântica, tabulação, teclado, movimento reduzido e alt | 54/54 |
| `teclado-only.mjs` | criar, editar, mover e apagar usando só o teclado, no tema escuro | 10/10 |
| `logout-ui.mjs` | sair, erro simulado e limpeza do cookie | 28/28 |
| `ui-xss.mjs` | XSS e ausência de bibliotecas externas | PASS |
| `layout-check.mjs` | rolagem horizontal e alturas em desktop e mobile | 0 de overflow |
| `cards-api-check.mjs` | API de cartões | 70/70 |
| `fix-status-fallback-logout.mjs` | correções de `/api/status` e logout | 81/81 |
| `validar-local.mjs` | pré-requisitos da rubrica | 9/9 |

Os 54 itens de tema e acessibilidade cobrem: primeira visita seguindo `prefers-color-scheme`, alternância por teclado com `aria-pressed` e rótulo correto, persistência após recarregar, contraste mínimo de 4,5:1 em 23 elementos nos dois temas, três `section` com `aria-labelledby` apontando para `h2`, cartões em `ul`/`li`, ordem de tabulação, foco visível, movimento por teclado usando o mesmo `PATCH /api/cards/:id` (sem rota nova), `role="alert"` para erros, alvos de 44px no mobile, `prefers-reduced-motion` e alt descritivo do avatar.

A primeira medição de contraste da coluna vazia no tema escuro indicou 2,05:1, mas era artefato da transição de 140ms do fundo: com a transição concluída, a taxa fica em aproximadamente 7,9:1. O teste passou a aguardar o fim da animação.

O fluxo só de teclado revelou que o foco caía no `<body>` quando a confirmação de exclusão substituía os botões do cartão. A interface foi ajustada para focar "Cancelar" (ação segura) e o teste de logout passou a ignorar apenas o log de rede do 500 que ele mesmo injeta; qualquer outro erro de página continua reprovando a verificação. A suíte antiga da API fechou esta rodada em 70/70.

## 4. Origem das skills de terceiros
- frontend-design: github.com/anthropics/skills
- cloudflare: github.com/cloudflare/skills