# Projeto #45: Clube de Leitura Acadêmico com Progresso Sincronizado

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** JOAO GABRIEL ROSA DE SOUZA
- **Turma:** 2C
- **Chave Única:** `P26-2C-E7BA-C284-8D3A-E0B8`
- **URL_CLOUDFLARE:** `https://clube-de-leitura.pages.dev`

---

## Especificação do Projeto

Desenvolva uma plataforma para organizar a leitura conjunta de livros técnicos ou de ficção científica ao longo do semestre. Após o login via Discord OAuth2, os membros inscrevem-se no livro da rodada atual e atualizam regularmente a página ou capítulo em que se encontram, gerando uma pista visual em CSS com os avatares do Discord posicionados proporcionalmente ao avanço de cada leitor.

O sistema conta com fóruns de discussão divididos por capítulos no Cloudflare D1, aplicando uma trava anti-spoiler no backend: uma Cloudflare Function só retorna as mensagens e análises de um determinado capítulo se o registro de progresso atual daquele usuário no banco de dados for igual ou superior ao capítulo que ele está tentando visualizar.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-E7BA-C284-8D3A-E0B8`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-E7BA-C284-8D3A-E0B8
   npx.cmd wrangler d1 create db-p26-2c-e7ba-c284-8d3a-e0b8
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-e7ba-c284-8d3a-e0b8`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://clube-de-leitura.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Variables and secrets** no ambiente **Production**.
     - Adicione estas variáveis como **Secrets**:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
       - `SESSION_SECRET` (gere um valor aleatório forte; não use o Client Secret do Discord).
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-E7BA-C284-8D3A-E0B8` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
