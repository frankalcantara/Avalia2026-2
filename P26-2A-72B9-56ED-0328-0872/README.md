# Projeto #40: Timesheet e Apontamento de Horas em Projetos de Software

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Laura Gois Casteleins
- **Turma:** 2A
- **Chave Única:** `P26-2A-72B9-56ED-0328-0872`
- **URL_CLOUDFLARE:** `https://p26-2a-72b9-56ed-0328-0872.pages.dev`
- **Repositório GitHub:** `https://github.com/Laura-Casteleins/Avalia2026-2`
- **Licença:** MIT

---

## 1. Especificação e Visão Geral

Aplicação web full-stack desenvolvida para o registro e acompanhamento de horas trabalhadas em equipes de Engenharia de Software. Autenticado exclusivamente via **Discord OAuth2**, o usuário pode iniciar um **cronômetro em tempo real** ao começar uma tarefa ou realizar o **lançamento manual** de um bloco de horas trabalhadas, vinculando cada registro a uma etapa do ciclo de vida de desenvolvimento (`Requisitos`, `Arquitetura`, `Codificação` ou `Testes`).

Todos os apontamentos são persistidos de forma relacional no **Cloudflare D1** e consolidados em um **Painel Analítico da Equipe**, que soma as horas reais registradas por etapa, compara com o tempo estimado inicialmente e destaca os desvios de cronograma.

---

## 2. Funcionalidades Implementadas e Regras de Negócio

- **Autenticação Exclusiva via Discord OAuth2:**
  - Fluxo completo de autorização com o Discord, exibindo nome e avatar do usuário autenticado no cabeçalho da aplicação.
  - Sessão protegida por cookie `HttpOnly` e verificada no servidor antes de qualquer gravação no banco de dados.
- **Cronômetro em Tempo Real:**
  - Contagem contínua (`HH:MM:SS`) com controles de **Iniciar** e **Parar & Salvar**.
  - Converte automaticamente os segundos decorridos em horas decimais (mínimo de `0.01h` para registros válidos) e persiste o apontamento na etapa selecionada.
- **Lançamento Manual de Horas:**
  - Formulário para registro direto de horas trabalhadas por etapa do ciclo de vida (`Requisitos`, `Arquitetura`, `Codificação`, `Testes`).
  - Validação no cliente e no servidor rejeitando usuários não autenticados, etapas inválidas ou valores menores ou iguais a zero.
- **Painel Analítico da Equipe:**
  - Tabela dinâmica que consolida o tempo real gasto em cada etapa diretamente do Cloudflare D1 e calcula o desvio (`Tempo Estimado - Tempo Real`) em relação às estimativas base (`Requisitos: 20h`, `Arquitetura: 15h`, `Codificação: 40h`, `Testes: 25h`).

---

## 3. Estrutura de Arquivos da Subpasta

    P26-2A-72B9-56ED-0328-0872/
    ├── functions/
    │   └── api/
    │       ├── auth/
    │       │   └── discord/
    │       │       ├── callback.js     # Troca o código OAuth2 por token e cria cookie de sessão HttpOnly
    │       │       └── discord.js      # Inicia o redirecionamento OAuth2 para o Discord
    │       ├── apontamentos.js         # Consulta consolidada (GET) e gravação validada (POST) no D1
    │       └── status.js               # Retorna os dados da sessão autenticada do usuário
    ├── migrations/
    │   └── 0001_init.sql               # Criação das tabelas estimativas e apontamentos + carga inicial
    ├── public/
    │   ├── app.js                      # Cronômetro, lançamentos, integração via fetch e painel analítico
    │   ├── index.html                  # Interface HTML5 semântica com Chave Única no rodapé
    │   └── styles.css                  # Estilização responsiva em CSS3 puro (sem frameworks)
    ├── skills/
    │   ├── serverless-d1-discord/
    │   │   └── SKILL.md                # Padrões para Cloudflare Functions, D1 e Discord OAuth2
    │   ├── teste-validacao/
    │   │   └── SKILL.md                # Protocolo de testes de segurança, integridade e auditoria
    │   └── vanilla-dom-ui/
    │       └── SKILL.md                # Diretrizes de frontend em HTML5, CSS3 e Vanilla JS
    ├── AGENTS.md                       # Documentação do harness, dos 3 agentes e casos de teste
    ├── LICENSE                         # Licença MIT
    ├── README.md                       # Documentação completa do projeto, arquitetura e deploy
    └── wrangler.jsonc                  # Configuração do Cloudflare Pages e binding DB (timesheet-db)

---

## 4. Arquitetura Técnica, Banco D1 e Rotas da API

### Banco de Dados Relacional (`migrations/0001_init.sql`)
- **Banco Cloudflare D1:** `timesheet-db` (`database_id`: `b951ae65-a26e-444c-8f6d-93808f368ebd`)
- **Tabela `estimativas`:** Armazena as etapas do ciclo de vida (`etapa`) e as horas inicialmente planejadas (`horas_estimadas`).
- **Tabela `apontamentos`:** Registra cada lançamento vinculado ao `user_id` e `username` do Discord, `etapa`, `horas` gastas, `tipo` (`manual` ou `cronometro`) e `criado_em`.
- **Segurança SQL:** Todas as consultas utilizam *prepared statements* parametrizados (`env.DB.prepare(...).bind(...)`).

### Endpoints Serverless (`functions/api/`)
- **`GET /api/auth/discord`:** Redireciona o navegador para a tela de autorização OAuth2 do Discord.
- **`GET /api/auth/discord/callback`:** Valida o retorno do Discord, obtém o perfil do usuário (`id`, `username`, `avatar`) e grava o cookie de sessão seguro.
- **`GET /api/status`:** Verifica se há sessão ativa e devolve os dados do usuário autenticado para o frontend.
- **`GET /api/apontamentos`:** Consulta no D1 a soma de horas reais por etapa, cruza com `estimativas` e retorna o painel analítico consolidado.
- **`POST /api/apontamentos`:** Valida autenticação, etapa permitida e quantidade de horas no servidor antes de inserir o registro na tabela `apontamentos`.

---

## 5. Engenharia de Agentes, Harness e Skills

Conforme documentado em [`AGENTS.md`](./AGENTS.md) e na pasta [`skills/`](./skills/), o desenvolvimento foi estruturado em 3 agentes especializados:
1. **Agente 1 — Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2** (`skills/serverless-d1-discord/SKILL.md`)
2. **Agente 2 — Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)** (`skills/vanilla-dom-ui/SKILL.md`)
3. **Agente 3 — Agente de Teste, Auditoria de Segurança e Validação** (`skills/teste-validacao/SKILL.md`)

---

## 6. Como Executar Localmente

1. Acesse a subpasta do projeto e aplique a migração no banco D1 local:

       cd P26-2A-72B9-56ED-0328-0872
       npx wrangler d1 migrations apply timesheet-db --local

2. Configure o arquivo `.dev.vars` local com `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (com `http://127.0.0.1:8788/api/auth/discord/callback` cadastrado no Discord Developer Portal).
3. Inicie o servidor local do Cloudflare Pages com binding do D1:

       npx wrangler pages dev public --d1=DB=timesheet-db

---

## 7. Como Publicar no Cloudflare Pages + D1 + Discord OAuth2

1. **Conectar o Repositório no Cloudflare Pages:**
   - No painel da Cloudflare (**Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**), selecione o repositório `Laura-Casteleins/Avalia2026-2`.
   - Configure os parâmetros de build:
     - **Root directory (Diretório raiz):** `P26-2A-72B9-56ED-0328-0872`
     - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
     - **Build output directory:** `public`
2. **Criar o Banco D1 e Aplicar a Migração Remota:**

       cd P26-2A-72B9-56ED-0328-0872
       npx wrangler d1 create timesheet-db
       npx wrangler d1 migrations apply timesheet-db --remote

3. **Vincular o Banco D1 ao Cloudflare Pages (`env.DB`):**
   - No painel do projeto Pages (**Settings** -> **Functions** -> **D1 database bindings**), adicione o binding:
     - **Variable name:** `DB`
     - **D1 database:** `timesheet-db` (`database_id`: `b951ae65-a26e-444c-8f6d-93808f368ebd`, também configurado em `wrangler.jsonc`).
4. **Configurar o Discord OAuth2 e Variáveis de Ambiente:**
   - No **Discord Developer Portal** (`https://discord.com/developers/applications`), aba **OAuth2 -> Redirects**, adicione:
     - `https://p26-2a-72b9-56ed-0328-0872.pages.dev/api/auth/discord/callback`
   - No painel do Cloudflare Pages (**Settings** -> **Variables and Secrets**), adicione:
     - `DISCORD_CLIENT_ID`
     - `DISCORD_CLIENT_SECRET`
5. **Publicar o Projeto via CLI:**

       npx wrangler pages deploy public --project-name=p26-2a-72b9-56ed-0328-0872

---

## 8. Auditoria de Pré-Validação (9 Critérios)

Na raiz do repositório (`Avalia2026-2`), execute o validador oficial antes do Pull Request:

    node validar-local.mjs P26-2A-72B9-56ED-0328-0872

Critérios verificados automaticamente pelo script:

| Item | Requisito Auditado | Status |
| :--- | :--- | :--- |
| **1** | Arquivo `LICENSE` (MIT) presente | `[OK]` |
| **2** | Chave Única `P26-2A-72B9-56ED-0328-0872` no `README.md` | `[OK]` |
| **3** | Chave Única `P26-2A-72B9-56ED-0328-0872` no rodapé do HTML | `[OK]` |
| **4** | Documento `AGENTS.md` com mínimo de 3 agentes | `[OK]` |
| **5** | Agente de Teste e Validação documentado | `[OK]` |
| **6** | Arquivos de Skills na pasta `skills/` | `[OK]` |
| **7** | Frontend HTML5/CSS3/JS Puro (sem frameworks proibidos) | `[OK]` |
| **8** | Backend Cloudflare Functions + D1 + Discord OAuth2 | `[OK]` |
| **9** | Deploy Online na Cloudflare (`https://p26-2a-72b9-56ed-0328-0872.pages.dev`) | `[OK]` |

---

## 9. Conformidade com a Rubrica de Avaliação (100 Pontos)

| Critério da Rubrica | Peso | Entrega Realizada |
| :--- | :--- | :--- |
| **1. Deploy Online no Cloudflare e Funcionamento Pleno** | 25 pts | Hospedado e funcional em `https://p26-2a-72b9-56ed-0328-0872.pages.dev` |
| **2. Backend Serverless, Banco D1 e Discord OAuth2** | 25 pts | Autenticação via Discord OAuth2 e persistência SQL validada no Cloudflare D1 (`timesheet-db`) |
| **3. Frontend em HTML5, CSS3 e JavaScript Vanilla** | 15 pts | Interface responsiva em JS puro com cronômetro, lançamento manual e painel analítico |
| **4. Engenharia de Agentes (Mín. 3 Agentes + Harness + Skills)** | 25 pts | 3 agentes especializados documentados em `AGENTS.md` com protocolos em `skills/` |
| **5. Repositório Público, Licença MIT e Auditoria** | 10 pts | Código público em `Laura-Casteleins/Avalia2026-2`, licença MIT e Chave Única auditada |

---

## 10. Licença

Este projeto está licenciado sob os termos da **Licença MIT** — consulte o arquivo [`LICENSE`](./LICENSE) para mais detalhes.