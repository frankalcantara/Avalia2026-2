# Projeto #1: Projeto Oficial Sorteado (Consulte https://frankalcantara.com/projetos2026)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** ketlyn ribeiro de simas 
- **Turma:** 2A
- **Chave Única:** `P26-2A-EA46-516E-FB4C-0EFA`
- **URL_CLOUDFLARE:** `https://projeto-p26-2a-ea46-516e-fb4c-0efa.pages.dev`

---

## Especificação do Projeto

Desenvolva um sistema no qual o estudante cadastra as disciplinas que está cursando no semestre, definindo a fórmula de cálculo de média (pesos de provas, trabalhos e listas) de cada matéria. O login via Discord recupera a grade individual do aluno armazenada no Cloudflare D1.

À medida que o aluno insere as notas já obtidas, o JavaScript no cliente calcula instantaneamente a média parcial e simula exatamente qual nota mínima é necessária nas avaliações restantes para atingir a aprovação direta ou evitar o exame final. Os dados permanecem salvos na infraestrutura da Cloudflare para acompanhamento ao longo de todo o período letivo.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2A-EA46-516E-FB4C-0EFA`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2A-EA46-516E-FB4C-0EFA
   npx.cmd wrangler d1 create db-p26-2a-ea46-516e-fb4c-0efa
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2a-ea46-516e-fb4c-0efa`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://projeto-p26-2a-ea46-516e-fb4c-0efa.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2A-EA46-516E-FB4C-0EFA` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
