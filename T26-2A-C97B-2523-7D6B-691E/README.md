# Projeto #0: Projeto 0 (Teste de Ambiente e Entrega — Sem Nota): Painel de Diagnóstico Cloudflare + D1 + Discord

- **Modalidade:** Projeto 0 — Teste de Ambiente e Entrega (Sem Sorteio e Sem Nota)
- **Estudante:** Eduardo Alves Teixeira
- **Turma:** 2A
- **Chave Única:** `T26-2A-C97B-2523-7D6B-691E`
- **URL_CLOUDFLARE:** `https://t26-2a-c97b-2523-7d6b-691e.pages.dev`

---

## Especificação do Projeto

Projeto universal de treinamento (sem sorteio e sem nota) que todos os estudantes realizam igualmente para validar o ambiente Node.js instalado em modo usuário via Scoop nos computadores da instituição, o deploy de subpasta no Cloudflare Pages com banco de dados Cloudflare D1 e o fluxo completo de entrega e avaliação automatizada via Pull Request no repositório frankalcantara/Avalia2026-2.

A aplicação consiste em um Painel de Check-in e Diagnóstico de Entrega construído em HTML5, CSS3 e JavaScript puro (Vanilla JS): a interface exibe o status da autenticação OAuth2 do Discord, consulta uma Cloudflare Pages Function (/api/status) conectada a uma tabela de diagnósticos no banco Cloudflare D1 e permite registrar um ping de verificação contendo a Chave de Teste (T26-...) do estudante. O pacote da subpasta também exercita os 3 agentes obrigatórios (incluindo o agente de teste e validação), o documento AGENTS.md descrevendo o harness, a pasta skills/ e a licença MIT.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `T26-2A-C97B-2523-7D6B-691E`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd T26-2A-C97B-2523-7D6B-691E
   npx.cmd wrangler d1 create db-t26-2a-c97b-2523-7d6b-691e
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
5. Na raiz do repositório, execute `node validar-local.mjs T26-2A-C97B-2523-7D6B-691E` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
