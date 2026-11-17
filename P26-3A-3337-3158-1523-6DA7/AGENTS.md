# Documentação de Engenharia de Agentes e Harness (P26-3A-3337-3158-1523-6DA7)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

Este projeto usou **6 agentes** em **3 harnesses** diferentes.

## 1. Ambientes de Orquestração (Harness Utilizado)

| Harness | Modelo(s) base | Agentes |
| :--- | :--- | :--- |
| **OpenCode** (agente de codificação com ferramentas de shell, edição de arquivos e subagentes) | `opencode/beam-free` (Beam Free) para orquestração e geração de código; subagentes `explore`/`general` para análise e validação | 1, 2 e 3 |
| **Google Gemini — Chat Web** (interface padrão) | Google Gemini | 4 |
| **Claude** (aplicativo web com ferramentas de arquivos, shell, busca na web e subagentes) | Anthropic Claude Sonnet 5.5 | 5 e 6 |

**Estratégia de coordenação:** os agentes operaram de forma modular sobre a subpasta `P26-3A-3337-3158-1523-6DA7/`, compartilhando as especificações do banco D1, os contratos JSON das Cloudflare Pages Functions e a verificação automatizada (`validar-local.mjs` e `tests/`). O código gerado por um agente foi revisado por outro: o Agente 5 auditou o que os Agentes 1 e 2 produziram e o Agente 6 tentou quebrar o resultado sem ter participado da escrita.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Harness / Modelo:** OpenCode · Beam Free
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Tabelas `discord_users` e `activities` (com `CHECK` de categoria e índices) no Cloudflare D1.
  - Rotas `/api/activities`, `/api/summary`, `/api/status` e fluxo OAuth2 (`/api/auth/discord` e `/callback`).
  - Regra de teto de 60 h por categoria validada no servidor antes da gravação.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Harness / Modelo:** OpenCode · Beam Free
- **Papel:** Construção da interface responsiva e acessível utilizando exclusivamente HTML5 semântico, CSS3 moderno (sem sombras em fontes) e JavaScript puro (Vanilla JS), consumindo as rotas serverless via `fetch`.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Componentes visuais em `public/index.html`, `public/styles.css` e `public/app.js`.
  - Cabeçalho de perfil do Discord (`user_id`, nome e avatar), painel de barras de progresso e rodapé oficial com a Chave Única `P26-3A-3337-3158-1523-6DA7`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Harness / Modelo:** OpenCode · subagentes `explore`/`general`
- **Papel:** Verificação de ponta a ponta: inspeção de contratos de API, auditoria da rubrica de 100 pontos e execução de `validar-local.mjs`.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Verificação de integridade dos endpoints e de conformidade com a rubrica (`validar-local.mjs`).
  - Checagem de ausência de frameworks proibidos e presença da licença MIT.

### Agente 4: Assistente de Arquitetura e Troubleshooting
- **Harness / Modelo:** Google Gemini · Chat Web (Interface Padrão)
- **Papel:** Atuou como consultor na fase de planejamento e configuração (setup). Analisou o repositório oficial e a rubrica do projeto para gerar um roteiro de execução detalhado. Também foi responsável pelo *troubleshooting* de problemas no ambiente de desenvolvimento local (resolução de caminhos no Node.js via Scoop), correção de sintaxe no arquivo `wrangler.jsonc` e orientação sobre a inserção de *Secrets* do Discord OAuth2 no painel da Cloudflare e entre outros.
- **Skill Utilizada:** [`skills/gemini-arquitetura/SKILL.md`](./skills/gemini-arquitetura/SKILL.md)

### Agente 5: Assistente de Diagnóstico de Deploy e Auditoria de Conformidade
- **Harness / Modelo:** Claude (aplicativo web com ferramentas) · Claude Sonnet 5.5
- **Papel:** Leu o README do repositório e os requisitos do Projeto #20, interpretou o log de falha do Cloudflare Pages (`Output directory "public" not found`) e identificou a causa na configuração de *Root directory* / *Build output directory* do projeto Pages. Em seguida auditou o código da pasta do projeto contra a rubrica e corrigiu as divergências encontradas.
- **Skill Utilizada:** [`skills/claude-auditoria-deploy/SKILL.md`](./skills/claude-auditoria-deploy/SKILL.md)
- **Entregas Realizadas:**
  - Diagnóstico do erro de deploy (Root directory deve ser a subpasta `P26-...`).
  - Sessão passou de cookie base64 sem assinatura (forjável) para cookie assinado com HMAC-SHA256 e expiração.
  - Inclusão do parâmetro `state` no OAuth2; remoção da rota `/api/auth/demo` (login exclusivo via Discord).
  - Teto por categoria tornado atômico (`INSERT ... SELECT ... WHERE`), eliminando a corrida *check-then-insert*.
  - Validação estrita de horas, categoria e URL; checagem de `Origin`; `/api/status` deixou de expor totais globais.
  - Interface: DOM sem `innerHTML`, barras de progresso acessíveis com "quanto falta", remoção de atividade, responsividade.
  - Suíte `tests/` e atualização de `README.md`, `AGENTS.md` e skills.

### Agente 6: Agente de Teste Independente (Obrigatório — segundo agente de validação)
- **Harness / Modelo:** Claude (subagente isolado, sem ver o raciocínio do Agente 5) · Claude Sonnet 5.5
- **Papel:** Auditar o projeto já corrigido como um revisor externo: tentar contornar autenticação e regras do servidor, verificar a rubrica item a item e relatar o que encontrou.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:** ver a seção 3.

---

## 3. Resultados de Teste e Validação

### 3.1 Suíte automatizada (`node --test`, dentro da pasta do projeto)
- **37 testes, 37 aprovados, 0 falhas** (Node 22, SQLite real via `tests/d1-shim.mjs`).
- Cobertura: sessão forjada/adulterada/expirada/assinada com outro segredo (`401`); payloads inválidos (`400`); teto de 60 h por categoria (exato, excedente `409`, soma fracionária, 8 requisições concorrentes → somente 3 de 20 h aceitas); isolamento entre usuários (`404`); injeção de SQL; `Origin` externo (`403`); OAuth2 com `state` (ausente/divergente/válido, `user_id` não numérico, erro do Discord); logout só por `POST`; conformidade da entrega (chave no rodapé e no README, licença MIT, sem frameworks/CDNs, agentes e skills existentes).
- **Nota:** use `node --test`. O comando `node --test tests/` falha no Node 22 com `MODULE_NOT_FOUND` (a pasta é tratada como módulo).

### 3.2 Teste de ponta a ponta no navegador (Chromium) — 25 verificações de interface aprovadas
Funções reais + D1 simulado atrás da interface: login/estado deslogado, cabeçalho com nome/`user_id`/avatar, barras de progresso por eixo e total ("quanto falta"), mensagem de erro `409` ao exceder o teto sem alterar o total, título com HTML exibido como texto (sem XSS), rejeição de URL `javascript:` e de 3 casas decimais, remoção de atividade, layout em 390 px sem rolagem horizontal, logout e ausência de exceções de JavaScript. As únicas mensagens de rede no console foram os `400`/`409` provocados de propósito e o avatar do CDN do Discord (sem acesso à internet no ambiente de teste).

### 3.3 Auditoria independente (Agente 6)
O Agente 6 recebeu apenas a pasta e a rubrica, executou `node --test` (34/34 na ocasião), escreveu scripts de ataque próprios e **não conseguiu quebrar** autenticação, sessão assinada, `state` do OAuth, teto de 60 h (30 POSTs concorrentes, 650 × 0,1 h, 6 100 × 0,01 h, 150 usuários simulados), isolamento entre usuários nem SQL injection. Rodou também o `validar-local.mjs`: **8 de 9 itens OK**; o item 9 (deploy online) fica pendente apenas por falta de acesso à internet no ambiente de teste.

Achados e correções feitas em seguida (cada uma com teste de regressão):

| Achado do Agente 6 | Gravidade | Correção |
| :--- | :---: | :--- |
| `category` aceitava array (`["ensino"]`) | baixa | só strings são aceitas (`400` caso contrário) |
| Horas com mais de 2 casas eram arredondadas em silêncio (`59,999` → `60`) | baixa | passam a ser rejeitadas (`400`) |
| Logout respondia a `GET` (CSRF de logout) | baixa | somente `POST`, com checagem de `Origin`; botão "Sair" usa `fetch` |
| `callback` repassava o texto livre do parâmetro `error` para a tela | baixa | apenas códigos conhecidos (`access_denied`, `oauth_error`) |
| Seção de resultados deste documento vazia | média | preenchida (esta seção) |
| Escrita sem cabeçalho `Origin` é aceita | baixa | mantido: o cookie `SameSite=Lax` já bloqueia POST/DELETE entre sites |
| Nome em `activities.username` pode ficar desatualizado; sessão sem revogação no servidor (apenas 24 h) | informativo | mantido; nenhuma tela usa a coluna e a sessão expira sozinha |

Após as correções a suíte foi executada novamente (37/37) e o teste de navegador repetido.
