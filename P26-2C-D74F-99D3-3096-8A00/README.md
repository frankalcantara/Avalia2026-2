# Projeto #34: Vitrine de Achados e Perdidos do Campus

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Wellington Miguel Bertoldo
- **Turma:** 2C
- **Chave Única:** `P26-2C-D74F-99D3-3096-8A00`
- **URL_CLOUDFLARE:** `https://achados-app.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Projete um catálogo centralizado para reportar objetos esquecidos ou encontrados nas dependências da universidade. Estudantes autenticados pelo Discord podem cadastrar um item informando categoria (eletrônicos, documentos, garrafas, vestuário), local exato, data e descrição detalhada.

Os registros no Cloudflare D1 operam sob dois tipos: "Perdi" e "Encontrei". A interface em JavaScript puro deve oferecer filtros cruzados rápidos e permitir que um usuário abra uma reivindicação sobre um item listado, registrando o contato do Discord de ambas as partes no banco para que façam a devolução e marquem o caso como encerrado.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-D74F-99D3-3096-8A00`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-D74F-99D3-3096-8A00
   npx.cmd wrangler d1 create db-p26-2c-d74f-99d3-3096-8a00
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-d74f-99d3-3096-8a00`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-d74f-99d3-3096-8a00.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-D74F-99D3-3096-8A00` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
