# Projeto #27: Motor de Blog Minimalista Multi-Autor

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Douglas Belmiro
- **Turma:** 2A
- **Chave Ãšnica:** `P26-2A-2B64-C206-BDAC-5A67`
- **URL_CLOUDFLARE:** `https://avalia2026-2-2sb.pages.dev` *(Atualize com a URL pÃºblica real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## EspecificaÃ§Ã£o do Projeto

Desenvolva uma plataforma de publicaÃ§Ã£o de textos tÃ©cnicos estilo blog, na qual cada estudante autenticado via Discord possui sua prÃ³pria pÃ¡gina de autor e pode publicar artigos. A interface deve contar com um editor de formulÃ¡rio limpo e uma pÃ¡gina inicial pÃºblica que lista os artigos mais recentes da turma.

Os artigos, comentÃ¡rios e curtidas sÃ£o persistidos no Cloudflare D1. O backend serverless deve validar a propriedade do registro antes de autorizar operaÃ§Ãµes de ediÃ§Ã£o ou exclusÃ£o de postagens. Visitantes autenticados podem deixar comentÃ¡rios ao final de cada artigo, que serÃ£o exibidos em ordem cronolÃ³gica com a foto de perfil e o nome do comentarista obtidos do Discord.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** â†’ **Create** â†’ **Pages** â†’ **Connect to Git**), selecione o seu fork do repositÃ³rio `Avalia2026-2`.
2. Configure os parÃ¢metros de build apontando para esta subpasta:
   - **Root directory (DiretÃ³rio raiz):** `P26-2A-2B64-C206-BDAC-5A67`
   - **Build command:** *(deixe em branco â€” HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migraÃ§Ã£o inicial (no terminal do laboratÃ³rio usando Scoop):
   ```powershell
   cd P26-2A-2B64-C206-BDAC-5A67
   npx.cmd wrangler d1 create db-p26-2a-2b64-c206-bdac-5a67
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (ObrigatÃ³rio para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages â†’ **Settings** â†’ **Functions** â†’ **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que vocÃª criou (`db-p26-2a-2b64-c206-bdac-5a67`).
5. **ConfiguraÃ§Ã£o do Discord OAuth2 (ObrigatÃ³rio para autenticaÃ§Ã£o real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://avalia2026-2-2sb.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** â†’ **Environment variables**.
     - Adicione as variÃ¡veis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereÃ§o pÃºblico gerado pela Cloudflare.
7. Na raiz do repositÃ³rio, execute `node validar-local.mjs P26-2A-2B64-C206-BDAC-5A67` para validar todos os critÃ©rios antes de fazer o commit e abrir o Pull Request.

