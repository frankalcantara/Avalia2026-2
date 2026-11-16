# Projeto #24: Plataforma de Empréstimo e Troca de Livros Físicos

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Julia Camilly Vieira Rodrigues
- **Turma:** 3A
- **Chave Única:** `P26-3A-5053-EAAE-A024-A246`
- **URL_CLOUDFLARE:** `https://p26-3a-5053-eaae-a024-a246.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Desenvolva um catálogo comunitário no qual estudantes listam livros técnicos ou literários de seu acervo pessoal que estão dispostos a emprestar ou trocar com colegas da universidade. O login via Discord identifica o proprietário do exemplar e fornece o meio de contato (handle do Discord) para combinar a entrega presencial.

O banco de dados Cloudflare D1 mantém o inventário dos livros e seu status atual ("Disponível", "Reservado", "Emprestado"). Quando um usuário autenticado solicita um empréstimo pela interface, o sistema registra o pedido; o proprietário do livro pode aprovar a solicitação em seu painel de controle, registrando no banco quem está com o exemplar e a data prevista para devolução.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-3A-5053-EAAE-A024-A246`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-3A-5053-EAAE-A024-A246
   npx.cmd wrangler d1 create db-p26-3a-5053-eaae-a024-a246
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-3a-5053-eaae-a024-a246`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-3a-5053-eaae-a024-a246.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-3A-5053-EAAE-A024-A246` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
