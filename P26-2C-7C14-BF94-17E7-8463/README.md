# Projeto #9: Quadro Kanban Pessoal

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** PEDRO HENRIQUE MORAES PROENCA
- **Turma:** 2C
- **Chave Única:** `P26-2C-7C14-BF94-17E7-8463`
- **URL_CLOUDFLARE:** `https://p26-2c-7c14-bf94-17e7-8463.pages.dev`

---

## Especificação do Projeto

Construa uma ferramenta de gestão de tarefas baseada no método Kanban, estruturada nas colunas "A Fazer", "Em Execução" e "Concluído". O cliente deve ser programado em JavaScript vanilla utilizando a HTML5 Drag and Drop API nativa para permitir a movimentação fluida dos cartões entre as colunas, sem uso de bibliotecas externas.

O isolamento dos dados é garantido pelo fluxo OAuth2 do Discord: ao carregar a página, o frontend busca nas Cloudflare Pages Functions apenas os cartões pertencentes àquele user_id. Cada movimentação de coluna, edição de texto ou alteração de prioridade dispara uma chamada assíncrona (PATCH/PUT) que atualiza a posição e o estado do cartão diretamente nas tabelas do Cloudflare D1.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-7C14-BF94-17E7-8463`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-7C14-BF94-17E7-8463
   npx.cmd wrangler d1 create db-p26-2c-7c14-bf94-17e7-8463
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-7c14-bf94-17e7-8463`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-7c14-bf94-17e7-8463.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-7C14-BF94-17E7-8463` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
