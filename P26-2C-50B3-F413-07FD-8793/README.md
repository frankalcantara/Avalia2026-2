# Projeto #7: Jogo da Memória Temático

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** VITOR GABRIEL DO NASCIMENTO
- **Turma:** 2C
- **Chave Única:** `P26-2C-50B3-F413-07FD-8793`
- **URL_CLOUDFLARE:** `https://e3e16abb.avalia2026-2jogodamemoria.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Projete um jogo de memória baseado em pares de cartas que exigem correspondência visual ou conceitual (ex: código e sua saída). A interface deve empregar transformações CSS 3D acionadas via JavaScript vanilla para o efeito de virar as cartas, mantendo o cabeçalho com os dados do usuário obtidos via login do Discord.

A disposição das cartas é embaralhada no servidor Cloudflare no início da sessão, enviando apenas identificadores opacos para o frontend. Quando o jogador seleciona duas cartas, uma requisição consulta o backend para verificar se os identificadores formam um par válido, incrementando o contador de movimentos no banco D1 e registrando a eficiência do jogador ao descobrir todos os pares.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-50B3-F413-07FD-8793`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-50B3-F413-07FD-8793
   npx.cmd wrangler d1 create db-p26-2c-50b3-f413-07fd-8793
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-50b3-f413-07fd-8793`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-50b3-f413-07fd-8793.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-50B3-F413-07FD-8793` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
