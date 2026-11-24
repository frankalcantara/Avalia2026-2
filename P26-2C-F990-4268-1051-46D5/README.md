# Projeto #12: Bloco de Notas em Markdown com Tags

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** João Victor Bontorin
- **Turma:** 2C
- **Chave Única:** `P26-2C-F990-4268-1051-46D5`
- **URL_CLOUDFLARE:** `https://p26-2c-f990-4268-1051-46d5.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Crie um ambiente de anotações acadêmicas no qual o usuário escreve em sintaxe Markdown básica em um painel à esquerda e visualiza a renderização HTML simultaneamente à direita. O interpretador de expressões regulares para converter cabeçalhos, listas, negrito e blocos de código deve ser escrito em JavaScript vanilla.

Mediante login pelo Discord, o estudante pode salvar suas notas no Cloudflare D1, atribuindo múltiplas etiquetas (tags) a cada documento. O sistema deve oferecer uma barra de pesquisa rápida e filtragem por tags que consulta os endpoints serverless na Cloudflare, permitindo organizar, editar e excluir anotações persistidas na nuvem.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-F990-4268-1051-46D5`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-F990-4268-1051-46D5
   npx.cmd wrangler d1 create db-p26-2c-f990-4268-1051-46d5
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-f990-4268-1051-46d5`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-f990-4268-1051-46d5.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-F990-4268-1051-46D5` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
