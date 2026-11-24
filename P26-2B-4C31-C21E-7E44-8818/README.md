# Projeto #6: Campo Minado com Tabela de Recordes

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** jose cunha
- **Turma:** 2B
- **Chave Única:** `P26-2B-4C31-C21E-7E44-8818`
- **URL_CLOUDFLARE:** `https://p26-2b-4c31-c21e-7e44-8818.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Construa uma implementação web do Campo Minado com geração de tabuleiros personalizáveis. O JavaScript no cliente deve capturar eventos de clique esquerdo (revelar célula) e clique direito (marcar bandeira), utilizando recursão no DOM para abrir áreas vazias adjacentes quando o servidor informar ausência de minas no perímetro.

Para impedir que o estudante inspecione a localização das minas pelo console do navegador, a matriz real do jogo deve ser gerada e retida no Cloudflare D1 ou KV, associada à sessão OAuth2 do Discord do jogador. Cada jogada consulta a API na Cloudflare, que retorna o valor numérico da vizinhança ou encerra a partida em caso de explosão, computando o tempo final nos recordes globais em caso de vitória.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-4C31-C21E-7E44-8818`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-4C31-C21E-7E44-8818
   npx.cmd wrangler d1 create db-p26-2b-4c31-c21e-7e44-8818
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2b-4c31-c21e-7e44-8818`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2b-4c31-c21e-7e44-8818.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2B-4C31-C21E-7E44-8818` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
