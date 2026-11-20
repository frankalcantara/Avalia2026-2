# Projeto #8: Gerenciador de Fichas e Rolagem de Dados para RPG

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Davi de Oliveira Lopes
- **Turma:** 2C
- **Chave Única:** `P26-2C-4AD5-930A-A7BE-770B`
- **URL_CLOUDFLARE:** `https://avalia2026-2-1uj.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Desenvolva um sistema de criação de fichas de personagens e simulação de dados poliédricos (d4, d6, d8, d10, d12, d20). O frontend deve oferecer formulários dinâmicos que calculam modificadores de atributos automaticamente em JavaScript puro, exigindo autenticação OAuth2 do Discord para associar os personagens criados ao jogador.

As fichas são salvas como registros estruturados no Cloudflare D1. Além da persistência cadastral, o sistema deve contar com um log de auditoria de rolagens: toda vez que o jogador aciona um teste de atributo, a geração do número pseudoaleatório ocorre na Cloudflare Function, gravando o resultado com data, hora e identificação do autor em uma tabela compartilhada da mesa, evitando fraudes nas jogadas.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-4AD5-930A-A7BE-770B`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-4AD5-930A-A7BE-770B
   npx.cmd wrangler d1 create db-p26-2c-4ad5-930a-a7be-770b
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-4ad5-930a-a7be-770b`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-4ad5-930a-a7be-770b.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-4AD5-930A-A7BE-770B` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
