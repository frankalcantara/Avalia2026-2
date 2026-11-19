# Projeto #38: Rastreador de Solicitações e Chamados Internos (Issue Tracker)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Thais Larissa Faria Gomes
- **Turma:** 2B
- **Chave Única:** `P26-2B-2D44-2B7F-3524-711D`
- **URL_CLOUDFLARE:** `https://p26-2b-2d44-2b7f-3524-711d.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Projete um sistema simplificado de abertura e acompanhamento de chamados técnicos (ex: reportar computadores com defeito no laboratório ou bugs em projetos da turma). O estudante autenticado pelo Discord abre um chamado fornecendo título, laboratório/projeto afetado, nível de severidade e descrição do problema.

Cada chamado recebe um código identificador único no Cloudflare D1 e transita por estados predefinidos ("Aberto", "Em Análise", "Aguardando Peça/Correção", "Resolvido"). O frontend deve desenhar uma linha do tempo visual do histórico de atualizações daquele chamado, permitindo que usuários adicionem comentários técnicos de acompanhamento até o fechamento.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-2D44-2B7F-3524-711D`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-2D44-2B7F-3524-711D
   npx.cmd wrangler d1 create db-p26-2b-2d44-2b7f-3524-711d
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2b-2d44-2b7f-3524-711d`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2b-2d44-2b7f-3524-711d.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2B-2D44-2B7F-3524-711D` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
