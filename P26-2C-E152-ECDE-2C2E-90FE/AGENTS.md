# Orientações para Agentes e Arquitetura (P26-2C-E152-ECDE-2C2E-90FE)

> **Requisito da rubrica:** documentar pelo menos três agentes diferentes, incluindo um dedicado a teste e validação, e relacionar as skills disponíveis.

Este arquivo reúne orientações para agentes que trabalhem no SoundRoom: arquitetura, caminhos, perfis, skills e comandos. A existência de uma definição ou skill não comprova que ela foi executada, carregada ou utilizada. Registre execuções e auditorias reais em [AGENTES.md](./AGENTES.md), sem preencher resultados hipotéticos.

## 1. Harness e coordenação

- **Harness documentado:** GitHub Copilot Chat em modo Agent, conforme descrito em [AGENTES.md](./AGENTES.md). Esta referência descreve o ambiente registrado; não afirma que algum agente foi executado além do que estiver anotado naquele registro.
- **Modelos:** não especificados nos arquivos do projeto. Não os presuma nem os atribua.
- **Instruções compartilhadas:** consulte [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) e as definições individuais em [`.github/agents/`](./.github/agents/).
- **Coordenação:** use as definições e skills aplicáveis ao escopo. Registre em [AGENTES.md](./AGENTES.md) data, agente, tarefa e evidência somente quando houver execução real.

## 2. Arquitetura e caminhos do projeto

- **Frontend:** Cloudflare Pages serve [public/index.html](./public/index.html) e os arquivos estáticos. A página carrega [public/assets/css/styles.css](./public/assets/css/styles.css) e [public/assets/js/app.js](./public/assets/js/app.js), implementados com HTML, CSS e JavaScript Vanilla, sem framework de interface.
- **Backend:** Cloudflare Pages Functions ficam em [functions/](./functions/), com rotas sob `functions/api/` e lógica compartilhada em `functions/_shared/`. As Functions atendem a API e acessam o banco pelo binding D1 `DB`.
- **Autenticação:** o fluxo Discord OAuth2 é implementado no servidor por Pages Functions. Não mova credenciais ou segredos para o frontend.
- **Banco:** [wrangler.jsonc](./wrangler.jsonc) configura o D1 e `migrations_dir` como `migrations/soundroom`. As seis migrations da aplicação ficam em [migrations/soundroom/](./migrations/soundroom/).
- **Migration do template:** [migrations/0001_init.sql](./migrations/0001_init.sql) pertence ao template do professor. Preserve-a no caminho original; ela não faz parte nem deve ser aplicada pela sequência de migrations do SoundRoom.
- **Testes:** [tests/](./tests/) contém testes de API, frontend, banco e integração local, além de helpers em `tests/helpers/`.
- **Manifesto e comandos:** [package.json](./package.json) define os scripts oficiais de desenvolvimento, configuração local do D1 e testes.

## 3. Agentes personalizados

Os três perfis abaixo estão definidos em `.github/agents/`. As responsabilidades e skills relacionadas descrevem os perfis configurados, não comprovam execução ou uso de skills.

### Agente 1 — Arquiteto e desenvolvedor

**Definição:** [`.github/agents/arquiteto-desenvolvedor.agent.md`](./.github/agents/arquiteto-desenvolvedor.agent.md)

**Responsabilidade:** Implementar frontend Vanilla e Pages Functions, preservando contratos, acessibilidade e documentação.

**Skills relacionadas:** [frontend-vanilla](./.github/skills/frontend-vanilla/SKILL.md), [pages-functions](./.github/skills/pages-functions/SKILL.md)

### Agente 2 — Segurança e banco de dados

**Definição:** [`.github/agents/seguranca-banco.agent.md`](./.github/agents/seguranca-banco.agent.md)

**Responsabilidade:** Revisar OAuth, sessões, autorização, validação, SQL, migrations e proteção de segredos.

**Skills relacionadas:** [pages-functions](./.github/skills/pages-functions/SKILL.md), [d1-migrations](./.github/skills/d1-migrations/SKILL.md)

### Agente 3 — QA e validação

**Definição:** [`.github/agents/qa-validacao.agent.md`](./.github/agents/qa-validacao.agent.md)

**Responsabilidade:** Criar e executar validações reproduzíveis e reportar falhas com evidências.

**Skills relacionadas:** [qa-cloudflare](./.github/skills/qa-cloudflare/SKILL.md), [d1-migrations](./.github/skills/d1-migrations/SKILL.md), [pages-functions](./.github/skills/pages-functions/SKILL.md), [frontend-vanilla](./.github/skills/frontend-vanilla/SKILL.md)

## 4. Skills disponíveis

### Skills versionadas para os agentes

As quatro skills em `.github/skills/` são:

- [`.github/skills/d1-migrations/SKILL.md`](./.github/skills/d1-migrations/SKILL.md): padrões de esquema e migrations D1, integridade e validação local.
- [`.github/skills/frontend-vanilla/SKILL.md`](./.github/skills/frontend-vanilla/SKILL.md): frontend acessível com HTML, CSS e JavaScript Vanilla.
- [`.github/skills/pages-functions/SKILL.md`](./.github/skills/pages-functions/SKILL.md): rotas Cloudflare Pages Functions, bindings, validação no servidor e SQL parametrizado.
- [`.github/skills/qa-cloudflare/SKILL.md`](./.github/skills/qa-cloudflare/SKILL.md): testes e execução local de Pages e D1.

### Skills do template/rubrica

O diretório original `skills/` também contém estas três skills da atividade:

- [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)

As duas coleções têm finalidades e caminhos distintos. Não declare que uma skill foi carregada ou utilizada sem evidência registrada.

## 5. Instalação, execução local e testes

Requer Node.js 22 ou superior e npm. Os comandos abaixo correspondem aos scripts de [package.json](./package.json):

```powershell
npm ci
npm run db:setup
npm run dev
```

- `npm run db:setup` aplica as migrations SoundRoom somente no D1 local.
- `npm run dev` inicia Cloudflare Pages local em `http://127.0.0.1:8788`.
- `npm run test:unit` executa os testes unitários de API e frontend com `node:test`.
- `npm run test:db` executa os testes de migrations em D1 local isolado; usa PowerShell.
- `npm run test:integration` executa a integração de Pages e D1 local; usa PowerShell.
- `npm test` executa, em sequência, os três grupos acima.

Reporte os comandos efetivamente executados e seus resultados. Não declare testes aprovados se não foram executados. Não faça deploy nem aplique migrations remotas sem autorização explícita.

## 6. Diferença entre os documentos de agentes

- **AGENTS.md (este arquivo):** instruções, arquitetura, perfis, skills e comandos para orientar trabalho futuro.
- **AGENTES.md:** registro em português de execuções e auditorias. Mantenha esse histórico separado; não o substitua por instruções nem acrescente execuções sem evidência.
