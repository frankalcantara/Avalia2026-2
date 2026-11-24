# Projeto #20: Gerenciador de Horas Complementares

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Felipe de Lima Amarante
- **Turma:** 2C
- **Chave Única:** `P26-2C-7E6D-B4F0-76A5-9594`
- **URL_CLOUDFLARE:** `https://avalia2026-2ativi.pages.dev`

---

## Especificação do Projeto

Desenvolva um sistema de controle de atividades formativas exigidas para a graduação. Após autenticar-se com o Discord, o estudante registra eventos, cursos ou projetos de extensão realizados, informando a categoria (ensino, pesquisa, extensão), a carga horária total e o link externo para o certificado digital.

A lógica de negócios, validada nas Cloudflare Pages Functions antes da gravação no D1, deve aplicar as regras de teto máximo de horas por categoria (ex: máximo de 60 horas em uma única modalidade). O painel principal em HTML/CSS deve exibir barras de progresso detalhando quantas horas já foram validadas em cada eixo e quanto falta para integralizar a exigência curricular.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-7E6D-B4F0-76A5-9594`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-7E6D-B4F0-76A5-9594
   npx.cmd wrangler d1 create db-p26-2c-7e6d-b4f0-76a5-9594
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-7e6d-b4f0-76a5-9594`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://avalia2026-2ativi.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-7E6D-B4F0-76A5-9594` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
