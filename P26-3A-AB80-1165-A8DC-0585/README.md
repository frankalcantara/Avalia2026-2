# Projeto #29: Mural de Reconhecimento (Kudos Board)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Laerto Santin
- **Turma:** 3A
- **Chave Única:** `P26-3A-AB80-1165-A8DC-0585`
- **URL_CLOUDFLARE:** `https://p26-3a-ab80-1165-a8dc-0585.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Projete uma aplicação voltada para o envio de mensagens públicas de agradecimento e reconhecimento entre membros de equipes de desenvolvimento. Autenticado via Discord OAuth2, o estudante seleciona um colega destinatário, escolhe um selo visual (ex: "Resolveu um Bug Crítico", "Ótima Explicação", "Ajuda no Projeto") e escreve uma mensagem curta.

Os cartões de reconhecimento são gravados no Cloudflare D1 e exibidos em um layout de grade (Masonry ou CSS Grid) na página principal. O backend deve impedir que um usuário envie elogios para o próprio ID do Discord e disponibilizar filtros para visualizar os reconhecimentos recebidos ou enviados por um perfil específico.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-3A-AB80-1165-A8DC-0585`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-3A-AB80-1165-A8DC-0585
   npx.cmd wrangler d1 create db-p26-3a-ab80-1165-a8dc-0585
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-3a-ab80-1165-a8dc-0585`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-3a-ab80-1165-a8dc-0585.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-3A-AB80-1165-A8DC-0585` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
