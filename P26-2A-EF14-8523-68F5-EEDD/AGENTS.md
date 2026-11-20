# Documentação de Engenharia de Agentes e Harness (P26-2A-EF14-8523-68F5-EEDD)

> **Requisito da Rubrica:** uso de no mínimo 3 agentes diferentes, sendo 1 dedicado a teste e validação, documentando o harness em que operaram e as skills na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Claude em modo chat, pela interface web (claude.ai). Não foram usados agentes autônomos com acesso direto ao sistema de arquivos: o código gerado em cada conversa foi copiado e aplicado manualmente no VS Code.
- **Modelo(s) Base:** Claude (Sonnet 5.5)
- **Estratégia de Coordenação:** Cada agente é um papel distinto do Claude, com instruções e skill próprios (pasta `skills/`). O resultado de cada agente foi integrado manualmente ao projeto, e o código foi testado no navegador e no Cloudflare Pages.

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Discord OAuth2
- **Papel:** modelagem do banco no Cloudflare D1 (`migrations/`), fluxo de login Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas:**
  - Tabelas e índices no Cloudflare D1.
  - Rotas serverless que não confiam apenas no cliente (o texto de cápsulas bloqueadas não é enviado ao navegador).

### Agente 2: Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** interface responsiva usando apenas HTML5, CSS3 e JavaScript puro, consumindo as rotas serverless via `fetch`.
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`.
  - Cabeçalho com nome e avatar do Discord e rodapé com a Chave Única.
  - Mural público e lista de cápsulas com contagem regressiva.

### Agente 3: Teste e Validação
- **Papel:** revisar o código dos outros agentes e verificar as regras da rubrica e as regras de negócio (login obrigatório, cápsula bloqueada sem texto, chave única no README e no rodapé).
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas:**
  - Checklist de testes manuais (login, criar mensagem, cápsula antes e depois do `unlock_date`).
  - Execução do `validar-local.mjs` antes de cada entrega.
  - Problemas encontrados e corrigidos:
    - Login falhando com `token_exchange_failed`: o redirect de produção não estava registrado no aplicativo do Discord; foi cadastrado em OAuth2 > Redirects.
    - `discordOAuthConfigured: false` em produção: os secrets estavam vazios e foram reenviados a partir do `.dev.vars`.