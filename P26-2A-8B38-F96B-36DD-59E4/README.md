# Projeto #23: Gerador e Organizador de Referências Bibliográficas

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Leonardo Alves Ferraz
- **Turma:** 2A
- **Chave Única:** `P26-2A-8B38-F96B-36DD-59E4`
- **URL_CLOUDFLARE:** `https://avalia2026-2-oficial.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Construa uma ferramenta que auxilia na formatação padronizada de referências bibliográficas (padrão ABNT ou IEEE) para trabalhos acadêmicos. O usuário escolhe o tipo de mídia (livro, artigo periódico, página web) em um formulário HTML, preenche os campos de autor, título, ano e veículo, e o JavaScript vanilla aplica as regras de pontuação, caixa alta e grifo para gerar a string formatada.

Através da autenticação OAuth2 do Discord, o estudante salva suas referências geradas dentro de pastas ou projetos específicos no banco de dados Cloudflare D1. O sistema deve oferecer uma funcionalidade que compila todas as referências de um projeto selecionado em ordem alfabética rigorosa, pronta para ser copiada e colada na seção final de um artigo.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2A-8B38-F96B-36DD-59E4`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2A-8B38-F96B-36DD-59E4
   npx.cmd wrangler d1 create db-p26-2a-8b38-f96b-36dd-59e4
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2a-8b38-f96b-36dd-59e4`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://avalia2026-2-oficial.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2A-8B38-F96B-36DD-59E4` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
