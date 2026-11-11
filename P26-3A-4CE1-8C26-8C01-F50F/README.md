# Projeto #42: Agregador e Curadoria de Links Técnicos (Bookmark Manager)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** klaus albino da silva
- **Turma:** 3A
- **Chave Única:** `P26-3A-4CE1-8C26-8C01-F50F`
- **URL_CLOUDFLARE:** `https://p26-3a-4ce1-8c26-8c01-f50f.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Desenvolva um gerenciador de favoritos na nuvem para substituir as dezenas de abas abertas no navegador durante pesquisas acadêmicas. Autenticado via Discord OAuth2, o usuário salva URLs acompanhadas de título, resumo pessoal, coleção/pasta e status de leitura ("Para Ler", "Lendo", "Concluído").

O backend na Cloudflare persiste os links no banco D1 e oferece rotas para filtragem combinada por coleção e status. O usuário também pode tornar uma coleção pública para compartilhar uma trilha de estudos (ex: "Melhores artigos sobre Compiladores") com o restante da turma através de uma listagem limpa e organizada.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-3A-4CE1-8C26-8C01-F50F`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-3A-4CE1-8C26-8C01-F50F
   npx.cmd wrangler d1 create db-p26-3a-4ce1-8c26-8c01-f50f
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-3a-4ce1-8c26-8c01-f50f`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-3a-4ce1-8c26-8c01-f50f.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-3A-4CE1-8C26-8C01-F50F` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
