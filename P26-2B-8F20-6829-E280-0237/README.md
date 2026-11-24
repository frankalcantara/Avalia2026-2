# Projeto #4: Sudoku com Validador e Cronômetro

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Gustavo Henrique Igerski das Neves
- **Turma:** 2B
- **Chave Única:** `P26-2B-8F20-6829-E280-0237`
- **URL_CLOUDFLARE:** `https://jogo-sudoku.pages.dev` 

---

## Especificação do Projeto

Desenvolva uma plataforma de Sudoku que ofereça grades de desafios em três níveis de dificuldade. A interface em HTML e CSS Grid deve permitir a inserção de números definitivos e anotações de rascunho nas células, utilizando eventos de teclado e mouse gerenciados por JavaScript vanilla. O usuário deve autenticar-se com sua conta do Discord para iniciar um tabuleiro.

Ao iniciar uma partida, uma Cloudflare Function registra o carimbo de tempo inicial no banco de dados D1 e entrega a matriz base ao cliente. O progresso intermediário pode ser salvo mediante requisição do usuário, e a submissão final é validada matematicamente no servidor na borda, que calcula o tempo total gasto e insere o resultado no ranking de velocidade daquele desafio específico.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-8F20-6829-E280-0237`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-8F20-6829-E280-0237
   npx.cmd wrangler d1 create db-p26-2b-8f20-6829-e280-0237
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2b-8f20-6829-e280-0237`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://jogo-sudoku.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
       - `SESSION_SECRET` como secret, contendo pelo menos 32 bytes aleatórios para assinar os cookies de sessão.
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2B-8F20-6829-E280-0237` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.

## Contratos das APIs de jogo

- `POST /api/sudoku/start` recebe `{ "difficulty": "facil" | "medio" | "dificil" }` e retorna a partida e o tabuleiro inicial, sem enviar a solução.
- `GET /api/progress?gameId=...` recupera o progresso da partida autenticada.
- `PUT /api/progress` recebe `{ "gameId": "...", "board": "<81 dígitos de 0 a 9>", "notes": { "2": [1, 2] } }`, com índices de casas entre `0` e `80`.
- `POST /api/sudoku/validate` recebe `{ "gameId": "...", "board": "<81 dígitos de 1 a 9>" }`; o servidor verifica a solução, registra o tempo e conclui a partida.
- `GET /api/ranking?puzzleId=facil-1&limit=10` retorna os melhores tempos daquele puzzle.
- `POST /api/auth/logout` encerra a sessão.

As rotas de partida e progresso exigem uma sessão Discord válida. O identificador do usuário é obtido do cookie assinado, nunca do payload do cliente. O ranking é público e ordenado por tempo crescente, horário de conclusão e identificador da partida.
