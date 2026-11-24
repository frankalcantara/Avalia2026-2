# Projeto #27: Motor de Blog Minimalista Multi-Autor

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Emanuell Ernesto Costa Maciel
- **Turma:** 2C
- **Chave Única:** `P26-2C-F417-FA38-7F64-811C`
- **URL_CLOUDFLARE:** `https://avalia2026-blog.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Desenvolva uma plataforma de publicação de textos técnicos estilo blog, na qual cada estudante autenticado via Discord possui sua própria página de autor e pode publicar artigos. A interface deve contar com um editor de formulário limpo e uma página inicial pública que lista os artigos mais recentes da turma.

Os artigos, comentários e curtidas são persistidos no Cloudflare D1. O backend serverless deve validar a propriedade do registro antes de autorizar operações de edição ou exclusão de postagens. Visitantes autenticados podem deixar comentários ao final de cada artigo, que serão exibidos em ordem cronológica com a foto de perfil e o nome do comentarista obtidos do Discord.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-F417-FA38-7F64-811C`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-F417-FA38-7F64-811C
   npx.cmd wrangler d1 create db-p26-2c-f417-fa38-7f64-811c
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-f417-fa38-7f64-811c`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://avalia2026-blog.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-F417-FA38-7F64-811C` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
