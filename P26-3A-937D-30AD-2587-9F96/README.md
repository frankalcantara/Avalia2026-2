# Projeto #16: Plataforma de Estudos por Flashcards (Repetição Espaçada)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Kauan dos Santos Engel
- **Turma:** 3A
- **Chave Única:** `P26-3A-937D-30AD-2587-9F96`
- **URL_CLOUDFLARE:** `https://p26-3a-937d-30ad-2587-9f96.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Implemente uma ferramenta de memorização baseada em baralhos de cartões de frente e verso. A interface deve utilizar animações CSS para virar o cartão ao clique do usuário, revelando a resposta e apresentando três botões de autoavaliação: "Difícil", "Bom" e "Fácil". O login OAuth2 do Discord identifica o estudante e carrega seus baralhos pessoais.

O banco de dados Cloudflare D1 armazena os cartões e a data da próxima revisão de cada item. Quando o usuário avalia um cartão, uma Cloudflare Function aplica um algoritmo simplificado de repetição espaçada (inspirado no SuperMemo SM-2), recalculando o intervalo em dias para a próxima aparição daquele cartão e atualizando a fila de estudos diária do aluno.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-3A-937D-30AD-2587-9F96`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-3A-937D-30AD-2587-9F96
   npx.cmd wrangler d1 create db-p26-3a-937d-30ad-2587-9f96
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-3a-937d-30ad-2587-9f96`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-3a-937d-30ad-2587-9f96.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-3A-937D-30AD-2587-9F96` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
