# Engenharia de Agentes e Harness — P26-2A-C913-04B0-E3ED-3E05

## Harness

- **Harness utilizado:** Codex, em modo de colaboração multiagente, nesta workspace local.
- **Modelo base:** GPT-6 (agentes delegados herdaram o modelo do agente principal).
- **Coordenação:** implementação modular no mesmo repositório: backend e D1, interface e revisão independente. O contrato JSON das Pages Functions foi compartilhado durante a implementação.

## Agentes e responsabilidades

### Agente 1 — Backend serverless, D1 e Discord OAuth2

- **Harness:** Codex multiagente.
- **Skill:** [serverless-d1-discord](./skills/serverless-d1-discord/SKILL.md).
- **Responsabilidade/entrega:** migração do quiz, sessões assinadas, validação de `state` OAuth, endpoints autenticados e pontuação calculada com timestamps do D1.

### Agente 2 — Interface Web Vanilla

- **Harness:** Codex multiagente.
- **Skill:** [vanilla-dom-ui](./skills/vanilla-dom-ui/SKILL.md).
- **Responsabilidade/entrega:** interface responsiva em HTML/CSS/JavaScript vanilla, perfil do Discord, seleção de categoria, questão individual, temporizador visual, feedback e resultado.

### Agente 3 — Teste, auditoria e validação independente

- **Harness:** Codex multiagente.
- **Skill:** [teste-validacao](./skills/teste-validacao/SKILL.md).
- **Responsabilidade/entrega:** revisão estática independente dos contratos, riscos anti-manipulação, conformidade estrutural e integração. Identificou e comunicou o requisito de `attemptId` nas respostas e o alinhamento do limite de tempo.
- **Limitação:** a auditoria foi estática; não foram executados testes funcionais nem confirmado o deploy remoto. O script `../validar-local.mjs` acessa a URL pública e não comprova sozinho regras de segurança ou funcionamento do quiz.

## Skills incluídas

- `skills/serverless-d1-discord/SKILL.md`
- `skills/vanilla-dom-ui/SKILL.md`
- `skills/teste-validacao/SKILL.md`

## Próximas verificações para entrega

1. Aplicar `migrations/0002_quiz.sql` ao D1 remoto.
2. Configurar variáveis OAuth2, segredo de sessão e callback no Discord/Cloudflare Pages.
3. Executar a bateria funcional/anti-manipulação em ambiente local e confirmar o fluxo publicado em HTTPS.
4. Atualizar a URL real, publicar no GitHub, abrir o Pull Request e enviar as URLs no AVA.
