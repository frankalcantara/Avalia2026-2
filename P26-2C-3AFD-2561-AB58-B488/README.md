# Projeto #41: Acervo de Citações e Notas de Leitura (Commonplace Book)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Guilherme Hiroshi Bansho
- **Turma:** 2C
- **Chave Única:** `P26-2C-3AFD-2561-AB58-B488`
- **URL_CLOUDFLARE:** `https://p26-2c-3afd-2561-ab58-b488.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Construa um repositório pessoal e coletivo para catalogar citações de livros, artigos científicos e palestras. Ao fazer login com o Discord, o estudante registra o trecho exato da citação, o autor original, a obra de referência, o número da página e suas próprias anotações de reflexão sobre aquele fragmento.

No Cloudflare D1, as citações podem ser marcadas como "Públicas" (visíveis no feed inspiracional da turma) ou "Privadas" (restritas ao criador). O cliente em JavaScript deve implementar busca instantânea por autor ou tema e um botão "Citação Aleatória" que consome um endpoint na Cloudflare para exibir reflexões sorteadas do acervo público.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-3AFD-2561-AB58-B488`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-3AFD-2561-AB58-B488
   npx.cmd wrangler d1 create db-p26-2c-3afd-2561-ab58-b488
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-3afd-2561-ab58-b488`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-3afd-2561-ab58-b488.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-3AFD-2561-AB58-B488` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.

## Configuração (variáveis e banco)

Variáveis no projeto Cloudflare Pages (Settings > Variables and Secrets):
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET` (secret)
- `SESSION_SECRET` (secret): texto aleatório longo, usado para assinar o cookie de sessão

Banco D1: `commonplace-db`, binding `DB`. Schema em `migrations/0001_init.sql`.
Redirect do Discord: `https://p26-2c-3afd-2561-ab58-b488.pages.dev`

Observação: os passos 3 a 5 acima são o modelo do professor, com nomes de exemplo. Os nomes reais usados neste deploy são os desta seção: projeto `commonplace-book`, banco `commonplace-db` e site ``.