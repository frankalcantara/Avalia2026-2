# Projeto #28: Livro de Receitas Colaborativo com Escalonador de Porções

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Leonardo antunes de morais
- **Turma:** 2C
- **Chave Única:** `P26-2C-3C5F-7BA9-E44E-815C`
-**URL_CLOUDFLARE:** `https://caderno-de-receitas.pages.dev`
---

## Especificação do Projeto

Construa um catálogo gastronômico no qual usuários logados pelo Discord compartilham receitas estruturadas em lista de ingredientes (com quantidade numérica e unidade de medida separadas) e modo de preparo sequencial. O sistema deve permitir busca por nome do prato, tempo de preparo ou ingrediente específico.

No frontend em JavaScript vanilla, implemente um controle numérico de porções: ao alterar o rendimento desejado (ex: de 2 para 5 pessoas), o script recalcula matematicamente todas as quantidades de ingredientes exibidas no DOM em tempo real. Os usuários também podem favoritar receitas no Cloudflare D1 para montar um livro de receitas pessoal de acesso rápido.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2C-3C5F-7BA9-E44E-815C`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2C-3C5F-7BA9-E44E-815C
   npx.cmd wrangler d1 create db-p26-2c-3c5f-7ba9-e44e-815c
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2c-3c5f-7ba9-e44e-815c`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2c-3c5f-7ba9-e44e-815c.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2C-3C5F-7BA9-E44E-815C` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.

## Implementação

- Site publicado: https://caderno-de-receitas.pages.dev
- Agentes, harness e skills: [docs/AGENTES.md](docs/AGENTES.md) (arquivos dos agentes em `.claude/agents/` e dos skills em `.claude/skills/`)
- Testes: `npm test`
- Licença: MIT (arquivo `LICENSE`)
