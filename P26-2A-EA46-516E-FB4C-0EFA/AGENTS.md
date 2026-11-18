# Documentação de Engenharia de Agentes e Harness (P26-2A-EA46-516E-FB4C-0EFA)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness dos agentes revisores:** ChatGPT (OpenAI), conta gratuita, em interface de chat no navegador. Os três agentes foram acionados em sequência na mesma conversa, cada um com um prompt de papel próprio, o texto da sua skill (`skills/`) e os arquivos da sua área colados na mensagem.
- **Modelo dos agentes revisores:** modelo padrão da conta gratuita do ChatGPT (o nome da versão não é exibido pela interface).
- **Assistente de desenvolvimento do projeto:** Claude (Anthropic), em conversa de chat, usado para escrever o código, os comandos de execução e o roteiro de trabalho. Modelo: Claude Sonnet 5.5.
- **Ambiente de execução:** GitHub Codespaces (VS Code web) com Wrangler CLI para migrações do D1, testes locais e deploy no Cloudflare Pages.
- **Estratégia de Coordenação:** os agentes operaram sobre a subpasta `P26-2A-EA46-516E-FB4C-0EFA/`. Cada um recebeu os arquivos da sua área e produziu um relatório de achados. As recomendações foram triadas: o que procedia foi aplicado e publicado, e o que não procedia foi descartado com justificativa. A verificação final usou `validar-local.mjs`.

---

## 2. Agentes Criados e Responsabilidades (3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** revisar segurança e arquitetura do backend (`functions/_lib/sessao.js`, `functions/api/auth/discord.js`, `functions/api/auth/discord/callback.js`, `functions/api/disciplinas.js`) e as migrações do D1 (`migrations/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Achados e decisões:**
  - *Falta de verificação de origem (CSRF) em POST/PUT/DELETE:* **aplicado.** Requisições com cabeçalho `Origin` diferente do site respondem 403.
  - *Validação numérica fraca (conversões de `null`, `NaN`, tipos):* **aplicado.** Validação estrita de tipos com `Number.isFinite`.
  - *Atualização e exclusão sem atomicidade:* **aplicado.** Uso de `env.DB.batch()`; na criação, a disciplina é removida se a inserção das avaliações falhar.
  - *Extras aplicados:* limite de 100 KB no corpo da requisição e `Cache-Control: no-store` nas respostas.
  - *Cookie de `state` OAuth2 e segredo de sessão:* já atendidos (cookie temporário de 10 minutos, `HttpOnly`, `Secure`, apagado no callback; o callback recusa a execução sem `SESSION_SECRET`).
  - *Índices e exclusão em cascata:* os índices já existem na migração `0002`; a exclusão das avaliações é feita explicitamente no código.
  - *Rate limiting:* registrado como melhoria futura, por ser configuração do painel da Cloudflare.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** revisar responsividade, acessibilidade, uso exclusivo de HTML/CSS/JavaScript puro e a correção dos cálculos de média parcial e nota mínima (`public/index.html`, `public/styles.css`, `public/app.js`).
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Achados e decisões:**
  - *Divisão por zero no cálculo da nota mínima:* o fluxo já evitava o caso quando todas as notas estavam lançadas; **aplicada trava adicional** no cálculo.
  - *Dados inválidos no cálculo:* **aplicado.** O resumo mostra aviso quando há nota fora de 0 a 10; o bloqueio definitivo continua no servidor.
  - *Acessibilidade:* **aplicados** `aria-label` nos campos criados dinamicamente, `aria-live` e `role="alert"` nas mensagens e `:focus-visible` nos controles.
  - *Telas pequenas:* **aplicado** layout de coluna única até 420 px.
  - *Feedback durante operações:* **aplicado** bloqueio dos botões durante salvar e excluir, e mensagem de sucesso em verde.
  - *Limite de avaliações na interface:* **aplicado** (30, igual ao servidor).
  - *Ocultar o `user_id` do perfil:* **descartado**, pois o enunciado exige importar e exibir `user_id`, nome e avatar do Discord.
  - *Conformidade com a skill:* sem frameworks, sem `text-shadow` ou `drop-shadow` e com a Chave Única no `<footer>`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** elaborar a bateria de testes, apontar o que foi comprovado e o que ainda faltava, e auditar a aderência à rubrica. O agente recusou marcar como aprovado o que não tinha evidência de execução, e a lista de pendências dele orientou os testes abaixo, executados depois no terminal e no site.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Testes executados no site publicado (`https://projeto-p26-2a-ea46-516e-fb4c-0efa.pages.dev`):**

| Teste | Resultado obtido |
|---|---|
| `GET /api/me` sem cookie | 401 |
| `GET /api/disciplinas` sem cookie | 401 |
| `GET /api/disciplinas` com cookie inventado (`abc.def`) | 401 |
| `GET /api/disciplinas` com payload válido e assinatura HMAC falsa | 401 |
| Callback OAuth2 com `state` inválido | 302 para `/?auth_error=invalid_state` |
| `POST /api/disciplinas` com `Origin` de outro site | 403 |
| `DELETE /api/disciplinas` sem login | 401 |
| Login com Discord e persistência no D1 após recarregar | aprovado |
| Cálculo conferido à mão (média parcial, pontos acumulados e nota mínima) | aprovado |
| `node validar-local.mjs P26-2A-EA46-516E-FB4C-0EFA` | 9 de 9 itens OK |
| Validação no servidor pela interface (nota 11, peso 0, média de exame maior que a de aprovação) | aprovado: os três casos foram recusados pelo servidor com mensagem de erro |

- **Não executados, com justificativa:**
  - *Isolamento entre dois usuários com contas reais:* não executado; garantido por inspeção do código (todas as consultas filtram por `user_id`, e PUT e DELETE em disciplina de outro usuário respondem 404, sem revelar se o id existe).
  - *Sessão expirada:* verificada por inspeção do código (`exp` conferido a cada leitura da sessão).
- **Limitação conhecida:** a sessão é um cookie assinado sem registro no servidor, portanto o logout apaga o cookie no navegador, mas uma cópia do cookie continua válida até expirar (24 horas).
- **Decisão:** o agente sugeriu avaliar `403` para disciplina de outro usuário; foi mantido `404`, que não revela a existência do recurso.