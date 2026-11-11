# Projeto #5: Quiz Competitivo Temporizado

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Mateus dos Reis Oliveira
- **Turma:** 2A
- **Chave Única:** `P26-2A-C913-04B0-E3ED-3E05`
- **URL_CLOUDFLARE:** `https://p26-2a-c913-04b0-e3ed-3e05.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Crie uma plataforma de perguntas e respostas de múltipla escolha voltada para revisão de conteúdos acadêmicos. Após realizar o login via OAuth2 do Discord, o usuário seleciona uma categoria temática e inicia uma bateria de questões, na qual o frontend em JavaScript controla uma barra de progresso visual regressiva para cada resposta.

O servidor na Cloudflare entrega uma questão por vez sem revelar a alternativa correta no payload JSON. Quando o usuário responde, a função serverless verifica a diferença temporal entre o envio da pergunta e o recebimento da resposta no Cloudflare D1, atribuindo pontuação proporcional à velocidade e precisão, bloqueando respostas enviadas após o limite de tempo estipulado.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2A-C913-04B0-E3ED-3E05`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2A-C913-04B0-E3ED-3E05
   npx.cmd wrangler d1 create db-p26-2a-c913-04b0-e3ed-3e05
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2a-c913-04b0-e3ed-3e05`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2a-c913-04b0-e3ed-3e05.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2A-C913-04B0-E3ED-3E05` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
