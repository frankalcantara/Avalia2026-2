# Engenharia de agentes do projeto

**Chave:** `P26-2A-0230-5AEE-4FAA-3480`  
**Harness:** ChatGPT Work com o ambiente de execução Codex.  
**Família de modelos:** GPT-6, herdada pelos três agentes da sessão de desenvolvimento.

O agente coordenador consultou a rubrica oficial, gerou a estrutura da subpasta, definiu o contrato JSON compartilhado, preparou a configuração do Wrangler e revisou a integração. Cada agente trabalhou em arquivos distintos dentro do mesmo checkout. A documentação abaixo registra as responsabilidades e os arquivos produzidos nessa sessão.

## Agente 1 — Backend, Discord OAuth2 e banco D1

- **Instruções utilizadas:** [Cloudflare D1 e Discord](skills/serverless-d1-discord/SKILL.md).
- **Escopo:** `functions/` e `migrations/`.
- **Entregas:** endpoints de login, sessão, logout, estoque e histórico. Validação serverless das movimentações, identificação pela sessão e operação atômica de saldo e auditoria no D1. Migração do catálogo de exemplo e preservação da migração inicial do gerador.

## Agente 2 — Interface web Vanilla

- **Instruções utilizadas:** [HTML, CSS e DOM](skills/vanilla-dom-ui/SKILL.md).
- **Escopo:** `public/`.
- **Entregas:** interface em português, login e perfil do Discord, consulta de estoque, aba de estoque crítico, registro de retirada ou devolução e consulta do histórico. Incluiu estados de carregamento e erro, comportamento responsivo e a chave no rodapé.

## Agente 3 — Teste e validação

- **Instruções utilizadas:** [Testes e validação](skills/teste-validacao/SKILL.md).
- **Escopo:** `tests/` e execução independente de verificações locais.
- **Entregas:** testes automatizados da autenticação e das regras de estoque, incluindo concorrência, repetição de uma solicitação e consistência do histórico. Os testes de OAuth2 usam respostas simuladas do Discord para exercitar as funções localmente.

## Reproduzir a verificação

Dentro desta subpasta, execute `node --test` com Node.js 22.13 ou mais recente. Na raiz do fork, execute `node validar-local.mjs P26-2A-0230-5AEE-4FAA-3480` depois de preencher `URL_CLOUDFLARE` no README. O teste com o Discord real usa as credenciais da aplicação configuradas no ambiente de publicação.

Na verificação da entrega local, passaram os quatro testes automatizados e as duas migrações em D1 local. O agente de validação confirmou também as rotas pelo Wrangler, incluindo o redirecionamento OAuth2, a movimentação até o mínimo, a devolução, o histórico e o encerramento da sessão. O validador oficial aprovou os oito itens estruturais. A checagem da URL pública depende do deploy.

O agente de interface executou um teste em Chromium com respostas de API de exemplo fora do repositório. A verificação cobriu o acesso inicial, o perfil, os filtros, o uso por teclado, a mudança para estoque crítico após uma retirada, o histórico, o logout e o layout com 320 pixels de largura.
