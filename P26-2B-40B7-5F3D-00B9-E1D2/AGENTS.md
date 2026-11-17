# Documentação de Engenharia de Agentes e Harness (P26-2B-40B7-5F3D-00B9-E1D2)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Chat do Claude (claude.ai) no navegador, com edição de arquivos no Bloco de Notas e execução de comandos (Git e Node.js) no PowerShell. Nenhum agente teve acesso direto ao repositório: o código foi proposto nas conversas e aplicado pela estudante, que enviou cada mudança por commit.
- **Modelo(s) Base:** Claude Sonnet 5.5 (nível de esforço "Médio"), nas duas conversas.
- **Organização das conversas:** os Agentes 1 e 2 foram conduzidos na conversa principal, cada um com foco e skill próprios; o Agente 3 foi uma conversa separada, que só recebeu os arquivos colados pela estudante e instruções baseadas no protocolo da skill de teste.
- **Estratégia de Coordenação:** Os agentes operaram de forma modular sobre a subpasta `P26-2B-40B7-5F3D-00B9-E1D2/`, compartilhando especificações de banco de dados D1, contratos JSON das Cloudflare Pages Functions e verificação automatizada via `validar-local.mjs`.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Projetar o banco no Cloudflare D1, implementar o login exclusivo pelo Discord OAuth2 e escrever as rotas serverless em `functions/`, com toda a validação feita no servidor. Conduzido na conversa principal (Claude Sonnet 5.5), que propôs o código; a estudante aplicou os arquivos, rodou os comandos, configurou o painel da Cloudflare e do Discord e testou cada etapa no site publicado.
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md) (validação na borda, queries parametrizadas e sessão assinada em cookie `HttpOnly`).
- **Entregas Realizadas:**
  - Banco D1 com a tabela `entradas` (`migrations/0002_entradas.sql`): dono obrigatório, nível de impedimento limitado por `CHECK` e `created_at` em UTC com valor padrão do banco, para o cliente nunca informar a data.
  - Login Discord OAuth2 (`functions/api/auth/discord.js` e `functions/api/auth/discord/callback.js`), com parâmetro `state` aleatório conferido na volta, escopo mínimo (`identify`) e usuário gravado em `discord_users`.
  - Sessão em cookie assinado com HMAC-SHA256 (`lib/session.js`), validade de 24 horas, `HttpOnly`, `Secure` e `SameSite=Lax`. O segredo fica só nas variáveis do Cloudflare.
  - Rotas `POST` e `GET /api/entradas`: o dono vem sempre do cookie assinado, nunca do corpo; toda consulta filtra por `user_id`; SQL sempre com `prepare` e `bind`; busca por palavra-chave e por intervalo de datas.
  - `functions/api/auth/logout.js` e `functions/api/status.js` (este reduzido a diagnóstico e sessão atual, sem listar dados de outras pessoas e sem aceitar gravação).
- **Correções após a revisão do Agente 3:** o `session.js` passou a exigir `userId` e `exp` válidos e token com exatamente duas partes; o `callback.js` passou a falhar o login se o banco falhar e a validar o `access_token` e o `id`; o `status.js` passou a devolver só `userId`, `username` e um avatar do CDN do Discord, com `Cache-Control: no-store`.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construir a interface com HTML5 semântico, CSS3 e JavaScript puro, consumindo as rotas serverless via `fetch`. Conduzido na conversa principal (Claude Sonnet 5.5), que propôs os arquivos; a estudante os aplicou e testou no navegador.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md) (zero frameworks, tipografia sem sombra em texto, Chave Única no rodapé).
- **Entregas Realizadas:**
  - `public/index.html`: formulário de nova entrada (texto e nível de impedimento), busca por palavra-chave e datas, lista em `<ol>` e rodapé com a Chave Única `P26-2B-40B7-5F3D-00B9-E1D2`. Idioma `pt-BR`, campos com `label`, `maxlength` e `role="status"` na mensagem.
  - `public/styles.css`: linha do tempo vertical feita só com CSS (linha, marcadores coloridos por nível de impedimento), layout responsivo e tema claro/escuro pelo navegador, sem `text-shadow`.
  - `public/app.js`: JavaScript puro, sem bibliotecas. Todo texto vindo de pessoas ou do Discord entra com `textContent`, nunca como HTML. O navegador envia só o texto e o nível: dono e data são decididos pelo servidor. Mostra o avatar e o nome do usuário logado e tem botão de sair.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Revisão independente, sem escrever código do projeto. Rodou em uma **conversa separada** (Claude Sonnet 5.5), que recebeu instruções baseadas no protocolo da skill de teste e, depois, os arquivos colados pela estudante, um por vez. Para cada arquivo, devolveu os problemas por gravidade (crítico, médio, baixo), com linha, motivo e correção sugerida.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md) (isolamento de subpasta, teste anti-manipulação e conformidade com o `validar-local.mjs`).
- **Critérios verificados em cada arquivo:** dono da entrada vindo só da sessão; toda consulta filtrada por `user_id`; data carimbada pelo banco; SQL parametrizado; cookie de sessão assinado.
- **Arquivos revisados (9):** `functions/api/entradas.js`, `lib/session.js`, `functions/api/auth/discord/callback.js`, `migrations/0002_entradas.sql`, `functions/api/auth/logout.js`, `functions/api/auth/discord.js`, `public/app.js`, `functions/api/status.js` e `public/index.html`.
- **Resultado:** nenhum problema crítico em nenhum arquivo. Os cinco critérios principais passaram em todo o fluxo (login, `state`, sessão assinada, entradas, logout).
- **Teste anti-manipulação executado:** em janela anônima (sem login), um `POST /api/entradas` pelo Console do navegador foi recusado com `401` e a mensagem "Faça login."

#### Achados de gravidade média e decisão tomada

| Arquivo | Achado | Decisão |
|---|---|---|
| `lib/session.js` | `verifySession` não validava o conteúdo (`userId`, tipo do `exp`) nem o número de partes do token | **Corrigido:** exige `userId` em texto, `exp` numérico e token com exatamente duas partes |
| `callback.js` | Falha ao gravar o usuário era engolida e o login seguia | **Corrigido:** falha de banco derruba o login (`db_error`); também valida `access_token` e `id` |
| `status.js` | Devolvia o conteúdo inteiro da sessão (inclusive `exp`) | **Corrigido:** devolve só `userId`, `username` e avatar do CDN do Discord, com `Cache-Control: no-store` |
| `migrations/0002_entradas.sql` | Apontou a tabela `discord_users` como fora do esquema | **Já resolvido:** ela está em `migrations/0001_init.sql`, que o agente não recebeu; o `CREATE TABLE` foi retirado do `callback.js` |
| `status.js` | Diagnóstico (`d1Connected`, chave do projeto) público | **Mantido de propósito:** são as informações que o validador e a avaliação conferem, e nenhuma é segredo |
| `callback.js` e `discord.js` | Dependência do `state` e das flags do cookie | **Confirmado:** o `discord.js` gera `crypto.randomUUID()` e o cookie sai com `HttpOnly; Secure; SameSite=Lax; Max-Age=600` |

#### Itens de gravidade baixa tratados como limitação conhecida
Revogação de sessão antes dos 24 h (a sessão é sem estado, e o logout apaga o cookie no navegador), cabeçalhos de segurança como CSP e o prefixo `__Host-` nos cookies, paginação da lista (o servidor devolve no máximo 100 entradas) e a ausência de edição e exclusão de entradas.

#### Verificação de conformidade
`node validar-local.mjs P26-2B-40B7-5F3D-00B9-E1D2` executado em 17/11/2026: **9 de 9 itens aprovados** (licença MIT, Chave Única no README e no rodapé, `AGENTS.md`, agente de teste, skills, frontend sem frameworks, backend com Functions + D1 + Discord OAuth2 e deploy online em https://diario-de-bordo-k6c.pages.dev).