# Engenharia de Agentes e Harness — P26-2A-B12E-0CFD-70CA-18E1

> **Rubrica (25 pontos):** no mínimo **3 agentes**, sendo **1 dedicado a teste e
> validação**, com o *harness* documentado e as *skills* relacionadas na pasta
> `skills/`. Este projeto usa **4 agentes** no **OpenCode**.

## 1. Harness utilizado: OpenCode

| Item | Definição |
|---|---|
| Harness | **OpenCode** (V2), com agentes Markdown em `.opencode/agents/` |
| Configuração | `opencode.json` → `"skills": ["./skills"]` e `"instructions": ["AGENTS.md"]` |
| Descoberta de skills | `skills/<nome>/SKILL.md`; o OpenCode também lê `skills/vendor/ponytail/skills/<nome>/SKILL.md` |
| Modelo | cada agente **herda o modelo da sessão**; nenhum agente fixa modelo, para não quebrar em outra conta |
| Execução | abra a pasta `P26-2A-B12E-0CFD-70CA-18E1/` no OpenCode e peça ao agente principal para acionar o subagente pelo nome |
| Coordenação | escopo por arquivo + contrato JSON das Functions + suíte `node --test tests/` como porta de qualidade |

Os agentes são **subagentes** (`mode: subagent`): o agente principal delega uma
tarefa, o subagente recebe contexto novo, executa e devolve o resultado. Nenhum
subagente tem permissão para carregar skills fora do seu escopo — as permissões
`skill` de cada arquivo negam `*` e liberam apenas as skills listadas abaixo.

## 2. Agentes criados

### Agente 1: Arquiteto Serverless (Cloudflare D1 + Discord OAuth2)

- **Arquivo:** `.opencode/agents/arquiteto-d1-discord.md`
- **Skills:** [`skills/cloudflare-d1-discord/SKILL.md`](./skills/cloudflare-d1-discord/SKILL.md) e [`skills/vendor/ponytail/skills/ponytail/SKILL.md`](./skills/vendor/ponytail/skills/ponytail/SKILL.md)
- **Responsabilidade:** `migrations/0001_init.sql`, `functions/_lib/`, todas as rotas em `functions/api/`, `_middleware.js` e `wrangler.jsonc`.
- **Entregas:** schema com CHECKs, índices e triggers de imutabilidade; sessão opaca com apenas o hash no D1; OAuth2 `identify` com `state`; CSRF por `Origin`; CSP e cabeçalhos de segurança.
- **Evidência:** `tests/schema.test.mjs` (11 testes de banco) e `tests/rotas.test.mjs` (9 testes de contrato).

### Agente 2: Interface Web Vanilla (HTML5 + CSS3 + JavaScript puro)

- **Arquivo:** `.opencode/agents/interface-vanilla.md`
- **Skills:** [`skills/vanilla-ui-dom/SKILL.md`](./skills/vanilla-ui-dom/SKILL.md) e [`skills/vendor/ponytail/skills/ponytail/SKILL.md`](./skills/vendor/ponytail/skills/ponytail/SKILL.md)
- **Responsabilidade:** `public/index.html`, `public/styles.css`, `public/app.js`, `public/auditoria.js` e `public/favicon.svg`.
- **Entregas:** roteador por hash (`#/`, `#/sala/CODE`, `#/ata/CODE`); DOM seguro sem `innerHTML` com dado de usuário; estados de carregamento, vazio e erro; tema claro/escuro; `@media print` para a ata; verificação SHA-256 no navegador.
- **Evidência:** Lighthouse com **acessibilidade 100** e **boas práticas 100**; console sem erros nas três rotas.

### Agente 3: Auditoria do Sorteio (Fisher-Yates + ata imutável)

- **Arquivo:** `.opencode/agents/auditoria-sorteio.md`
- **Skills:** [`skills/sorteio-auditavel/SKILL.md`](./skills/sorteio-auditavel/SKILL.md), [`skills/vendor/ponytail/skills/ponytail-review/SKILL.md`](./skills/vendor/ponytail/skills/ponytail-review/SKILL.md) e [`skills/vendor/ponytail/skills/ponytail/SKILL.md`](./skills/vendor/ponytail/skills/ponytail/SKILL.md)
- **Responsabilidade:** `functions/_lib/sorteio.js`, `functions/_lib/crypto.js`, `public/auditoria.js`, `functions/api/rooms/[code]/draw.js` e `functions/api/draws/`.
- **Entregas:** Fisher-Yates no servidor com `randomInt` sem viés; trilha `swaps` completa; payload canônico com SHA-256; cadeia `prev_hash`; código `SORT-XXXX-XXXX`; replay idêntico no navegador.
- **Evidência:** `tests/base.test.mjs` (16 testes de algoritmo e hash) e as 67 asserções E2E que reaplicam a trilha e recalculam o hash.

### Agente 4: Teste e Validação (obrigatório, dedicado)

- **Arquivo:** `.opencode/agents/teste-validacao.md`
- **Skills:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md), [`skills/vendor/ponytail/skills/ponytail-audit/SKILL.md`](./skills/vendor/ponytail/skills/ponytail-audit/SKILL.md) e [`skills/vendor/ponytail/skills/ponytail-debt/SKILL.md`](./skills/vendor/ponytail/skills/ponytail-debt/SKILL.md)
- **Responsabilidade:** testar e validar, **sem corrigir a implementação**. Pode criar/ajustar `tests/` e relatórios; aponta defeito com arquivo, linha e caso concreto.
- **Entregas:** suíte unitária e de schema; E2E contra `wrangler pages dev` com sessões semeadas; tentativa de contorno de autenticação, CSRF e validação; conferência da rubrica com `validar-local.mjs`.
- **Evidência:** **46/46 testes** e **67 asserções E2E** aprovadas (detalhes na seção 4).

## 3. Skills e licença

### Skills autorais do projeto

| Skill | Arquivo | Uso |
|---|---|---|
| `cloudflare-d1-discord` | `skills/cloudflare-d1-discord/SKILL.md` | D1, sessões, OAuth2, CSRF, deploy |
| `sorteio-auditavel` | `skills/sorteio-auditavel/SKILL.md` | invariantes do sorteio e da ata |
| `teste-validacao` | `skills/teste-validacao/SKILL.md` | roteiro de teste, ataques e relatório |
| `vanilla-ui-dom` | `skills/vanilla-ui-dom/SKILL.md` | DOM seguro, roteamento, acessibilidade |

### Skills vendorizadas: Ponytail (MIT)

As quatro skills de estilo de engenharia vêm do projeto
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), versão
**5.3.3**, commit `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`, licença **MIT ©
2026 DietrichGebert**.

Elas foram **traduzidas para pt-BR e adaptadas ao OpenCode e a este projeto —
não são cópias literais**. Saíram os comandos de barra, plugins, badges e
material promocional; entraram exemplos reais (reutilizar `el()`, `crypto.subtle`,
`Intl`, triggers do D1, CSP) e o formato de saída em português.

| Documento | Conteúdo |
|---|---|
| `skills/vendor/ponytail/LICENSE` | texto integral da licença MIT do upstream |
| `skills/vendor/ponytail/PROVENANCE.md` | origem, versão, commit e arquivos usados |
| `skills/vendor/ponytail/ADAPTACAO.md` | o que mudou, arquivo por arquivo |
| `skills/vendor/ponytail/skills/ponytail/SKILL.md` | menor mudança completa |
| `skills/vendor/ponytail/skills/ponytail-review/SKILL.md` | revisão de mudança |
| `skills/vendor/ponytail/skills/ponytail-audit/SKILL.md` | auditoria do repositório |
| `skills/vendor/ponytail/skills/ponytail-debt/SKILL.md` | livro de atalhos `shortcut:` |

## 4. Evidências de execução

| Verificação | Comando | Resultado |
|---|---|---|
| Testes unitários, de schema e de rota | `node --test tests/` | **46/46 aprovados** |
| Schema aplicado no D1 local | `wrangler d1 execute DB --local --file=migrations/0001_init.sql` | 20 comandos aplicados |
| E2E de API com sessões semeadas | `node scripts/e2e-api.mjs` | **67 asserções aprovadas** |
| Navegador: início, sala e ata | OpenCode Browser | console sem erros; ata “íntegra ✔” |
| Acessibilidade e boas práticas | Lighthouse | **100 / 100** |
| Validação da entrega | `node validar-local.mjs P26-2A-B12E-0CFD-70CA-18E1` | veredito na seção 5 |

O E2E cobre: `/api/health`, `/api/me`, criação e edição de sala, nomes manuais,
entrada por Discord, sorteio em grupos e em ordem, segunda ata encadeada,
consulta pública, código minúsculo, ata inexistente/malformada, CSRF, não-dono,
sala com ata, logout e recomputação do hash.

## 5. Como reproduzir

```powershell
cd P26-2A-B12E-0CFD-70CA-18E1
node --test tests/

Remove-Item -Recurse -Force .wrangler\state\v3\d1 -ErrorAction SilentlyContinue
npx.cmd --yes wrangler@latest d1 execute DB --local --file=migrations/0001_init.sql
npx.cmd --yes wrangler@latest d1 execute DB --local --file=scripts/semear-sessoes.sql
npx.cmd --yes wrangler@latest pages dev public --port 8788 --ip 127.0.0.1

# em outro terminal: 67 asserções E2E
node scripts/e2e-api.mjs

# na raiz do fork
cd ..
node validar-local.mjs P26-2A-B12E-0CFD-70CA-18E1
```

O login real exige `DISCORD_CLIENT_SECRET` em `.dev.vars` (local, gitignored) ou
via `wrangler pages secret put` (produção). Para testar sem o secret, semeie
usuários e sessões no D1 local — o roteiro está em
`skills/teste-validacao/SKILL.md`.

## 6. Limites e decisões

- O cliente **nunca** embaralha, não envia seed e não escolhe ordem.
- Re-sorteio **não apaga** ata: cria `seq + 1` encadeada por `prev_hash`.
- A ata é reconstruída do snapshot gravado, nunca da tabela `rooms` mutável.
- Nenhuma dependência de UI, nenhum bundler, nenhum framework proibido.
- Segredos nunca são versionados; `.dev.vars.example` documenta as variáveis.
- O agente de teste **não altera** `functions/`, `public/` ou `migrations/`.
