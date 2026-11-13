# Engenharia de agentes — Projeto #43

Chave `P26-2B-69DF-2DBB-E2A5-276B`. Desenvolvimento realizado no harness Codex, dentro do ChatGPT Work, com três agentes especializados e coordenação do agente principal. Os agentes usaram o modelo disponibilizado pela sessão Codex, com o mesmo contexto da tarefa e acesso ao checkout compartilhado.

## Agente 1 — Backend, autenticação e banco

Identificador de execução `backend`. Responsável por `functions/`, `lib/` e `migrations/`. Aplicou `skills/serverless-d1-discord/SKILL.md`. Implementou OAuth2 com validação de state, sessões opacas verificadas no D1 por hash do token, permissões do organizador, salas, participantes e sorteio no servidor. O cookie HttpOnly contém um token aleatório e a identidade é obtida do banco.

## Agente 2 — Interface HTML, CSS e JavaScript

Identificador de execução `frontend`. Responsável por `public/`. Aplicou `skills/vanilla-dom-ui/SKILL.md`. Implementou interface responsiva em português, integração por fetch, estados de carregamento e erro, sala compartilhável e consulta de atas. A renderização dos nomes usa texto no DOM.

## Agente 3 — Teste e validação independente

Identificador de execução `validation`. Responsável por testes e relatório de verificação. Aplicou `skills/teste-validacao/SKILL.md`. Testou os handlers com SQLite real usando uma adaptação da API D1 e verificou regras, rejeição de requisições inválidas, imutabilidade e conformidade estrutural. Comunicou falhas aos agentes responsáveis para correção. Resultados e pendências em `VALIDACAO.md`.

## Coordenação e limites

O agente principal recuperou o fork existente, definiu escopo e verificou a integração, documentação e alterações finais. Backend e interface combinaram contratos de API antes da implementação. O agente de testes revisou os contratos e casos de segurança separadamente. Somente arquivos desta subpasta compõem a alteração.

Os testes locais não substituem a validação do login com uma conta real do Discord e do banco remoto após o deploy. A estudante configurou a conta Cloudflare, o banco e os secrets. O projeto foi publicado em https://avalia2026-2-52p.pages.dev/. A consulta pública de uma ata e seu hash foram conferidos pelo agente no navegador, após a estudante executar o login e o sorteio. Os detalhes estão em `VALIDACAO.md`.
