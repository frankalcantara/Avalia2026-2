# Projeto #18: Mural de Avisos Departamental por Disciplina

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Giovanne Antônio brambila
- **Turma:** 2A
- **Chave Única:** `P26-2A-ECE0-EC1C-0E43-FFD9`
- **URL_CLOUDFLARE:** `https://p26-2a-ece0-ec1c-0e43-ffd9.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Crie um quadro de comunicados digitais segmentado por canais ou códigos de disciplinas. Qualquer estudante autenticado via Discord pode se inscrever nas disciplinas de seu interesse para compor um feed personalizado em HTML/CSS, além de publicar avisos, lembretes de entregas de trabalhos ou links úteis.

As postagens são salvas no Cloudflare D1 contendo o identificador e o nome público do autor extraídos do token OAuth2, garantindo rastreabilidade e coibindo postagens anônimas indevidas. O sistema deve permitir que o próprio autor edite ou remova seus avisos e que outros usuários marquem comunicados importantes como "lidos" ou "fixados" em sua visão individual.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2A-ECE0-EC1C-0E43-FFD9`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2A-ECE0-EC1C-0E43-FFD9
   npx.cmd wrangler d1 create db-p26-2a-ece0-ec1c-0e43-ffd9
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
5. Na raiz do repositório, execute `node validar-local.mjs P26-2A-ECE0-EC1C-0E43-FFD9` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
