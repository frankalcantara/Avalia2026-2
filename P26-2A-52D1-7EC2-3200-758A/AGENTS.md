# Engenharia de Agentes e Harness — P26-2A-52D1-7EC2-3200-758A

> Projeto #25 · Catálogo de Filmes e Séries com Avaliações da Turma · Sophia Vitoria Kramer de Liz · Turma 2A

Este documento explica quais agentes foram usados para construir o projeto, em qual *harness* eles operaram,
quais *skills* cada um seguiu e como o trabalho foi dividido entre os agentes e a estudante.

## 1. Harness utilizado

| Item | Valor |
| :--- | :--- |
| **Harness** | **Claude (app claude.ai / Claude Desktop)** no modo agêntico, construído sobre o **Claude Agent SDK** (as mesmas ferramentas do Claude Code: leitura e escrita de arquivos, terminal, busca, lista de tarefas). |
| **Modelo base** | **Claude Opus 5.5** (Anthropic) |
| **Ferramentas disponíveis aos agentes** | Terminal Linux isolado (Node.js 22, `wrangler` 4, Python + Playwright/Chrome headless), edição de arquivos, navegador embutido do app Claude (para o painel da Cloudflare e o Discord Developer Portal) e ponte de arquivos com o computador da estudante. |
| **Skills** | Arquivos `SKILL.md` em [`skills/`](./skills), um por agente. Cada agente carregava a sua skill antes de começar. |

### Como os agentes foram organizados

Os três agentes são **papéis separados**, executados pelo mesmo modelo no mesmo harness, cada um com responsabilidade, skill e
critério de "pronto" próprios. A ordem foi sequencial e cada agente entregava artefatos concretos para o próximo:

```
 Agente 1 (Arquiteto Serverless)  ──►  contrato da API + esquema D1
            │
            ▼
 Agente 2 (Interface Vanilla)     ──►  public/ consumindo a API
            │
            ▼
 Agente 3 (Teste e Validação)     ──►  bugs encontrados ──► voltam para o Agente 1 ou 2
```

A estudante atuou como **humana no circuito**: decidiu o que fazer em cada etapa, executou os comandos de Git e de deploy no
próprio computador, fez os logins (Cloudflare, Discord, GitHub) e aprovou cada acesso que os agentes pediram.

---

## 2. Agentes criados

### Agente 1: Arquiteto Serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)

- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Papel:** modelar o banco, escrever as rotas serverless e garantir que **toda regra de negócio rode no servidor**.
- **Entregas:**
  - `migrations/0001_init.sql`: tabelas `discord_users`, `sessoes`, `titulos` e `avaliacoes`, esta com
    **chave primária composta `(user_id, filme_id)`**, `CHECK (nota BETWEEN 1 AND 5)` e lista base de 12 títulos.
  - `functions/api/auth/discord.js` e `callback.js`: OAuth2 do Discord com parâmetro `state` anti-CSRF,
    importação de `user_id`, nome e avatar, e **sessão guardada no D1** (o cookie só tem um token aleatório).
  - `functions/api/titulos/index.js`: galeria com **média aritmética (`AVG`) e total (`COUNT`) agregados no D1** e
    ordenação por nota média, popularidade ou lançamentos recentes; cadastro de títulos com validação e bloqueio de duplicados.
  - `functions/api/titulos/[id]/avaliacao.js`: avaliação com **UPSERT** (`ON CONFLICT(user_id, filme_id) DO UPDATE`),
    que transforma uma segunda nota da mesma pessoa em edição; o `user_id` sai sempre da sessão, nunca do corpo da requisição.
  - `lib/servidor.js`: funções compartilhadas (sessão, cookies seguros, limpeza de texto, respostas JSON).
- **Decisão importante:** o esqueleto inicial guardava o usuário inteiro num cookie em Base64 sem assinatura, então qualquer
  pessoa poderia editar o cookie e avaliar no nome de outra. O Agente 1 trocou isso por sessões no D1.

### Agente 2: Interface Web Vanilla (HTML5, CSS3 e DOM)

- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Papel:** construir a interface só com HTML, CSS e JavaScript puro, consumindo a API do Agente 1.
- **Entregas:**
  - `public/index.html`: estrutura semântica, `<dialog>` nativos para detalhes e cadastro, rodapé com a chave única.
  - `public/styles.css`: tema "sala de cinema", grid responsivo (desktop e celular), seletor de estrelas só com CSS,
    foco visível e respeito a `prefers-reduced-motion`.
  - `public/app.js`: galeria com abas de ordenação, filtro e busca; modal com média, distribuição das notas e resenhas;
    formulário de avaliação com edição e remoção; cadastro de títulos. Todo texto de usuário entra no DOM por
    `textContent` (nunca `innerHTML`), o que evita XSS.

### Agente 3: Teste e Validação (obrigatório)

- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** verificar o trabalho dos Agentes 1 e 2 de forma independente, tentando **quebrar** as regras.
- **Como testou:**
  1. Subiu o projeto localmente com `wrangler pages dev` e um D1 local com as mesmas migrações.
  2. Criou duas sessões de teste (pessoa A e pessoa B) direto no D1 local.
  3. Rodou a bateria [`testes/testar-api.mjs`](./testes/testar-api.mjs) (22 testes, zero dependências).
  4. Abriu a interface num Chrome headless (Playwright) em tamanho desktop e celular e conferiu as capturas de tela.
  5. Rodou `node validar-local.mjs P26-2A-52D1-7EC2-3200-758A` do repositório oficial.
- **Bugs encontrados e corrigidos:**

| # | Onde | Problema | Corrigido por |
| :- | :--- | :--- | :--- |
| 1 | `public/app.js` | O seletor de estrelas aparecia como texto `[object HTMLInputElement]`: o helper `el()` só "achatava" um nível de listas aninhadas. | Agente 2 (`flat(Infinity)`) |
| 2 | `public/styles.css` | As estrelas do formulário ficavam minúsculas porque a regra `.formulario label` tinha prioridade sobre `.seletor-estrelas label`. | Agente 2 (seletor mais específico) |
| 3 | `public/styles.css` | No celular, o botão "Entrar com Discord" quebrava em duas linhas. | Agente 2 (`white-space: nowrap`) |
| 4 | `functions/api/auth/discord.js` | `prompt=none` impediria a tela de autorização no primeiro login. | Agente 1 (parâmetro removido) |

- **Resultado final:** 22/22 testes aprovados localmente; `validar-local.mjs` aprovado em todos os itens determinísticos.

#### Casos de teste cobertos

| Categoria | Caso | Esperado |
| :--- | :--- | :--- |
| Público | Página inicial com a chave no `<footer>` | 200 |
| Público | `/api/status` com D1 conectado | `d1Conectado: true` |
| Galeria | Ordenação por média, popularidade e recentes | ordem decrescente correta |
| Galeria | Filtro `tipo=serie`; busca com `%' OR 1=1 --` | só séries; 0 resultados, sem erro |
| Galeria | Id inválido / inexistente | 400 / 404 |
| Segurança | Avaliar, cadastrar ou remover sem login | 401 |
| Segurança | Cookie de sessão inventado | 401 |
| Segurança | Callback OAuth com `state` forjado | recusado |
| Regras | Nota 0, 6, 3.5 ou `"5"` (texto) | 400 |
| Regras | Resenha com 501 caracteres | 400 |
| Regras | 1ª avaliação / 2ª da mesma pessoa | 201 / 200 (edição) |
| Regras | Chave composta: só uma nota por pessoa e obra | 1 registro |
| Regras | Pessoa B envia `user_id` da pessoa A no corpo | nota de A não muda |
| Regras | Média aritmética e total | iguais ao cálculo manual |

#### Como rodar os testes

```powershell
# Testes públicos e de bloqueio (contra o site no ar)
node testes/testar-api.mjs https://projeto-p26-2a-52d1-7ec2-3200-758a.pages.dev

# Bateria completa (local, com duas sessões de teste)
$env:SESSAO_A = "<token de sessão da pessoa A>"; $env:SESSAO_B = "<token da pessoa B>"
node testes/testar-api.mjs http://127.0.0.1:8788
```

---

## 3. Skills utilizadas

| Agente | Skill | Arquivo |
| :--- | :--- | :--- |
| 1. Arquiteto Serverless | `serverless-d1-discord` | [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md) |
| 2. Interface Vanilla | `vanilla-dom-ui` | [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md) |
| 3. Teste e Validação | `teste-validacao` | [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md) |
