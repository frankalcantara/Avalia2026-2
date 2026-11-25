# Avalia2026-2 — Repositório Oficial de Entrega e Avaliação Automática de Projetos

Bem-vindo ao repositório oficial de entrega dos projetos semestrais de **2026** do **Prof. Frank de Alcantara** ([`https://frankalcantara.com/projetos2026`](https://frankalcantara.com/projetos2026)).

Cada estudante desenvolve seu trabalho dentro de uma **subpasta exclusiva nomeada exatamente com a sua Chave Única**, utiliza essa mesma subpasta no seu próprio **Fork** para alimentar o deploy online na **Cloudflare (Pages + D1)** e realiza a entrega abrindo um **Pull Request** para este repositório.

---

## 🖥️ Como Executar nos Computadores da Instituição (Node.js em Modo Usuário via Scoop)

Os computadores dos laboratórios da instituição utilizam o **Node.js instalado em modo usuário através do Scoop** (`C:\Users\<usuario>\scoop\apps\nodejs\current`). Todos os scripts deste repositório (`iniciar.mjs` e `validar-local.mjs`) foram construídos com **zero dependências externas** (100% módulos nativos do Node.js) para funcionar imediatamente sem exigir permissões de Administrador ou compiladores C++.

### Verificação Rápida no Terminal do Laboratório

1. Abra o **PowerShell** ou **Prompt de Comando (CMD)** e verifique se o Node.js e o Git do Scoop estão ativos:
   ```powershell
   node -v
   git --version
   ```
2. **Caso o comando `node` não seja reconhecido** em uma janela nova do PowerShell, recarregue os *shims* do Scoop no seu perfil de usuário:
   ```powershell
   $env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"
   ```
3. **Atenção à Política de Execução (`ExecutionPolicy`) do PowerShell:**
   - Para rodar nossos scripts, use sempre **`node iniciar.mjs ...`** e **`node validar-local.mjs ...`** (o executável `node.exe` nunca é bloqueado pelo PowerShell).
   - Quando precisar rodar o `wrangler` ou `npm` no PowerShell da instituição, adicione `.cmd` ao comando (**`npx.cmd wrangler ...`** ou **`npm.cmd ...`**) para evitar o bloqueio de scripts `.ps1` do Windows.

---

## 🧪 Etapa 1 (Obrigatória para Todos): Projeto 0 — Teste de Ambiente e Entrega (Sem Sorteio e Sem Nota)

Antes de entregar o seu projeto oficial, **todos os estudantes fazem um mesmo Projeto Extra de Teste (Projeto 0)**, **sem sorteio e sem valer nota**, exclusivamente para testar:
- O funcionamento do Node.js via Scoop na máquina da instituição;
- A criação automática da subpasta e dos 3 agentes + skills;
- A publicação da subpasta no Cloudflare Pages + D1;
- A abertura do Pull Request e a correção automática pelo robô no GitHub Actions.

### Passo a Passo do Projeto de Teste (`T26-...`)

1. Acesse [`https://frankalcantara.com/projetos2026`](https://frankalcantara.com/projetos2026), faça login com sua conta Google e registre seu Nome Completo, Turma e RA.
2. Na tela do sistema (e no seu e-mail), copie a sua **Chave de Teste (Sem Nota)** no formato `T26-<TURMA>-XXXX-XXXX-XXXX-XXXX`.
3. Clique no botão **Fork** no topo direito deste repositório (`frankalcantara/Avalia2026-2`) para criar uma cópia na sua conta do GitHub (mantenha seu fork **Público**).
4. Clone o seu fork na máquina do laboratório:
   ```powershell
   git clone https://github.com/SEU-USUARIO/Avalia2026-2.git
   cd Avalia2026-2
   ```
5. Execute o gerador automático passando a sua **Chave de Teste (`T26-...`)**:
   ```powershell
   node iniciar.mjs T26-2A-XXXX-XXXX-XXXX-XXXX
   ```
   O script verificará seu ambiente Scoop/Node.js, validará sua chave na API oficial e criará a pasta `T26-2A-XXXX-XXXX-XXXX-XXXX/` contendo um **Painel de Diagnóstico Cloudflare + D1 + Discord** completo e pronto para publicação!
6. Faça commit e push da sua pasta de teste para o seu fork:
   ```powershell
   git add T26-2A-XXXX-XXXX-XXXX-XXXX
   git commit -m "Teste de entrega T26-2A-XXXX-XXXX-XXXX-XXXX"
   git push origin main
   ```
7. Conecte o seu fork ao **Cloudflare Pages**:
   - Em **Workers & Pages → Create → Pages → Connect to Git**, escolha seu repositório `Avalia2026-2`.
   - Em **Root directory (Diretório raiz)**, informe o nome da pasta: `T26-2A-XXXX-XXXX-XXXX-XXXX`.
   - Em **Build output directory**, informe: `public`.
8. Copie a URL gerada pela Cloudflare (`https://...pages.dev`), cole no campo `URL_CLOUDFLARE` dentro de `T26-.../README.md`, valide localmente e atualize seu branch:
   ```powershell
   node validar-local.mjs T26-2A-XXXX-XXXX-XXXX-XXXX
   git add T26-2A-XXXX-XXXX-XXXX-XXXX
   git commit -m "Atualiza URL Cloudflare do projeto de teste"
   git push origin main
   ```
9. Abra um **Pull Request** do seu fork para `frankalcantara/Avalia2026-2`. O robô irá:
   - Ler o Pull Request, identificar você e verificar que apenas a sua pasta `T26-.../` foi alterada;
   - **Aceitar (fazer merge) automaticamente** do seu Pull Request;
   - Executar o diagnóstico de IA e responder no PR confirmando que seu processo de entrega está 100% aprovado!

---

## 🏆 Etapa 2: Entrega do Projeto Oficial Sorteado (Valendo 100 Pontos — Chave `P26-...`)

Após confirmar o recebimento do e-mail de sorteio em [`https://frankalcantara.com/projetos2026`](https://frankalcantara.com/projetos2026), você terá acesso ao seu **Projeto Oficial Sorteado (`#1` a `#45`)** e à sua **Chave Única Oficial (`P26-<TURMA>-XXXX-XXXX-XXXX-XXXX`)**.

1. Na raiz do seu fork, gere a estrutura oficial para a sua chave `P26-...`:
   ```powershell
   node iniciar.mjs P26-2A-XXXX-XXXX-XXXX-XXXX
   ```
2. Desenvolva todo o código do seu projeto sorteado **exclusivamente dentro da pasta `P26-2A-XXXX-XXXX-XXXX-XXXX/`**:
   - `public/` — Frontend em HTML5, CSS3 e JavaScript puro (Vanilla JS), exibindo a chave `P26-...` no rodapé (`<footer>`).
   - `functions/` — Rotas serverless nas Cloudflare Pages Functions com autenticação **Discord OAuth2** e validações de negócio no servidor.
   - `migrations/` — Esquema SQLite relacional para o banco **Cloudflare D1**.
   - `AGENTS.md` — Documentação detalhada dos **mínimo 3 agentes diferentes** utilizados no desenvolvimento (sendo obrigatoriamente **1 agente de teste e validação**) e em qual **harness** operaram.
   - `skills/` — Diretório contendo os arquivos `SKILL.md` que os seus agentes utilizaram.
   - `LICENSE` — Licença MIT.
   - `README.md` — Documentação contendo sua Chave Única (`P26-...`) e a `URL_CLOUDFLARE` pública do projeto funcionando.
3. Antes de abrir o Pull Request final, execute a bateria de validação local:
   ```powershell
   node validar-local.mjs P26-2A-XXXX-XXXX-XXXX-XXXX
   ```
4. Faça o commit/push apenas da sua pasta `P26-.../`, abra o **Pull Request** para `frankalcantara/Avalia2026-2` e poste as URLs do projeto online e do seu repositório GitHub no **AVA da instituição**.

---

## 📊 Rubrica Oficial de Avaliação (100 Pontos)

| Critério e Requisitos Obrigatórios | Pontuação |
| :--- | :---: |
| **1. Deploy Online no Cloudflare e Funcionamento Pleno (Pré-requisito eliminatório):** Projeto online na Cloudflare (`Pages`/`Workers`) e funcionando integralmente. | **25 pts** |
| **2. Arquitetura Serverless (Cloudflare Functions + D1) e Discord OAuth2:** Login exclusivo via Discord OAuth2, persistência no Cloudflare D1 e validações no servidor. | **25 pts** |
| **3. Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS):** Manipulação direta do DOM sem frameworks de UI proibidos. | **15 pts** |
| **4. Engenharia de Agentes (Mín. 3 Agentes + 1 de Teste/Validação + Harness + Skills):** Documento `AGENTS.md` explicando os agentes criados e o harness, mais os arquivos em `skills/`. | **25 pts** |
| **5. Repositório Público, Licença MIT e Auditoria:** Repositório público com código completo, licença MIT, Chave Única no `README.md` e no rodapé da interface, e entrega das URLs no AVA. | **10 pts** |
| **Total** | **100 pts** |
