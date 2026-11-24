# Projeto #2: Clone do Termo (Wordle) Diário

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Yuri Domenic Girardi
- **Turma:** 2C
- **Chave Única:** `P26-2C-FBCF-D7E5-0BE4-6F25`
- **URL_CLOUDFLARE:** `https://p26-2c-fbcf-d7e5-0be4-6f25.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Construa um jogo de adivinhação de palavras de cinco letras com limite de seis tentativas diárias. A interface deve utilizar manipulação direta do DOM para renderizar o teclado virtual e a grade de letras, aplicando animações CSS para indicar letras corretas, presentes na posição errada ou ausentes. O login obrigatório via Discord OAuth2 identificará o jogador antes de liberar o tabuleiro do dia.

O sorteio da palavra diária e a validação de cada tentativa devem ser processados por uma API serverless na Cloudflare, garantindo que a resposta correta nunca fique exposta no código-fonte do navegador. O banco de dados D1 deve armazenar as tentativas realizadas no dia atual para bloquear trapaças via recarregamento de página, além de consolidar estatísticas históricas como sequência de vitórias (streak) e distribuição de tentativas.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-FBCF-D7E5-0BE4-6F25`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-FBCF-D7E5-0BE4-6F25
   npx.cmd wrangler d1 create db-p26-2c-fbcf-d7e5-0be4-6f25
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-fbcf-d7e5-0be4-6f25`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-fbcf-d7e5-0be4-6f25.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-FBCF-D7E5-0BE4-6F25` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
