# Projeto #25: Catálogo de Filmes e Séries com Avaliações da Turma

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Luis Felipe Machado Konopika
- **Turma:** 2C
- **Chave Única:** `P26-2C-D843-80EC-2D28-37C7`
- **URL_CLOUDFLARE:** `https://p26-2c-d843-80ec-2d28-37c7.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Implemente um agregador de críticas audiovisuais voltado para a comunidade de estudantes. Na interface construída com HTML, CSS e JavaScript puro, usuários autenticados pelo Discord podem cadastrar títulos de filmes ou séries (ou selecioná-los de uma lista base), atribuir uma nota de 1 a 5 estrelas e redigir uma resenha curta.

As avaliações são armazenadas no Cloudflare D1 com chave composta (user_id + filme_id) para permitir apenas uma nota por pessoa em cada obra, possibilitando edição posterior. As Cloudflare Functions devem agregar a média aritmética de cada título e o total de avaliações para alimentar uma galeria ordenável por nota média, popularidade ou lançamentos recentes.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-D843-80EC-2D28-37C7`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-D843-80EC-2D28-37C7
   npx.cmd wrangler d1 create db-p26-2c-d843-80ec-2d28-37c7
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-d843-80ec-2d28-37c7`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-d843-80ec-2d28-37c7.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-D843-80EC-2D28-37C7` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
