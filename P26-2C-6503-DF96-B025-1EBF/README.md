# Projeto #33: Cápsula do Tempo e Livro de Visitas Digital

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** José Barichello neto
- **Turma:** 2C
- **Chave Única:** `P26-2C-6503-DF96-B025-1EBF`
- **URL_CLOUDFLARE:** `https://p26-2c-6503-df96-b025-1ebf.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Desenvolva um sistema de mensagens históricas e livro de assinaturas para turmas de graduação. O usuário faz login via Discord OAuth2 para deixar depoimentos no mural público imediato ou para criar "cápsulas do tempo" — mensagens endereçadas à turma ou a si mesmo com uma data futura de desbloqueio (ex: data da formatura).

A segurança temporal deve ser garantida pelas Cloudflare Pages Functions: ao consultar a lista de cápsulas no Cloudflare D1, o servidor compara a data atual com a coluna unlock_date. Se a data futura ainda não chegou, o backend retorna apenas os metadados (autor, título e contagem regressiva), omitindo completamente o texto da mensagem no JSON enviado ao navegador.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-6503-DF96-B025-1EBF`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-6503-DF96-B025-1EBF
   npx.cmd wrangler d1 create db-p26-2c-6503-df96-b025-1ebf
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-6503-df96-b025-1ebf`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-6503-df96-b025-1ebf.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-6503-DF96-B025-1EBF` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
