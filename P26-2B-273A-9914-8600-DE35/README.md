# Projeto #19: Repositório de Resumos e Snippets da Turma

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Guilherme Tyszkouski
- **Turma:** 2B
- **Chave Única:** `P26-2B-273A-9914-8600-DE35`
- **URL_CLOUDFLARE:** `https://p26-2b-273a-9914-8600-de35.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

Construa uma biblioteca colaborativa para compartilhamento de resumos teóricos e pequenos trechos de código-fonte. O frontend em JavaScript puro deve apresentar um formulário de submissão categorizado por linguagem ou matéria, além de uma listagem com busca dinâmica e botão para copiar o conteúdo para a área de transferência (navigator.clipboard).

O acesso e a autoria são gerenciados pelo Discord OAuth2. No Cloudflare D1, além dos textos e metadados das publicações, deve existir uma tabela de votos (upvotes) com restrição de unicidade por usuário e publicação: cada estudante pode votar apenas uma vez em um resumo útil, ordenando a listagem principal pelos materiais mais bem avaliados pela comunidade.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-273A-9914-8600-DE35`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-273A-9914-8600-DE35
   npx.cmd wrangler d1 create db-p26-2b-273a-9914-8600-de35
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
5. Na raiz do repositório, execute `node validar-local.mjs P26-2B-273A-9914-8600-DE35` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
