# Engenharia de Agentes — Cypher (P26-3A-0CED-4ACD-47F7-EDA9)

Este documento descreve os agentes usados para construir o Cypher, o harness em que eles operaram, as skills de cada um e como o trabalho foi coordenado e validado.

## 1. Harness e modelo

- **Harness:** Claude Code, executado em um ambiente de nuvem (Linux) com acesso a shell, sistema de arquivos, Node.js 22 e Wrangler 4.
- **Modelo base de todos os agentes:** Claude Opus 5.5 (Anthropic).
- **Como os agentes foram criados:** pela ferramenta de subagentes do Claude Code. Um agente orquestrador planejou o trabalho e criou quatro subagentes especializados, cada um com uma skill própria (pasta `skills/`) e um conjunto exclusivo de arquivos sob sua responsabilidade.
- **Isolamento:** cada agente só podia escrever nos arquivos da sua área, para evitar conflito entre agentes rodando em paralelo.
- **Independência do teste:** os três agentes de construção foram criados a partir do contexto do planejamento. O agente de teste foi criado **sem esse contexto**, recebendo apenas o contrato, a skill e o código, para validar o sistema sem "corrigir a própria prova".

## 2. Papel do estudante

As decisões de produto foram tomadas pelo estudante, em conversa com o orquestrador, antes de qualquer código:

- nome **Cypher** e identidade visual **"Cofre"**;
- modos **Clássico**, **Sombra** (no estilo Mastermind) e **Desafio**;
- **Cofres antigos** (jogar dias anteriores), sem contar para streak e ranking;
- ranking **global** e **por servidor do Discord**, compartilhamento em emoji;
- palavras comuns do dia a dia, sem tema fixo;
- tela de entrada, prévia de link (Open Graph) e README de vitrine.

O deploy no Cloudflare, a configuração do Discord, o repositório e o Pull Request foram feitos pelo estudante.

## 3. Fluxo de trabalho

```
Estudante + Orquestrador ──► decisões de design ──► docs/contrato-api.md (contrato único)
                                                            │
                     ┌──────────────────────────────────────┼──────────────────────────────┐
                     ▼                                      ▼                              ▼
          Agente 1: Arquiteto Serverless        Agente 2: Interface Vanilla     Agente 3: Curador de Palavras
          functions/, src/, migrations/          public/                         src/data/
                     └──────────────────────────────────────┼──────────────────────────────┘
                                                            ▼
                                    Agente 4: Teste e Validação (independente)
                                    tests/ + relatório ──► correções ──► reteste
```

1. O orquestrador escreveu o **contrato de API** (`docs/contrato-api.md`): rotas, tabelas, formatos JSON e códigos de erro. Ele é a fonte da verdade compartilhada.
2. Os agentes 1, 2 e 3 trabalharam **em paralelo**, cada um seguindo sua skill e o contrato.
3. O agente 4 testou o sistema integrado e registrou as evidências em `tests/RELATORIO-TESTES.md`.
4. Os defeitos encontrados foram corrigidos e retestados.

---

## 4. Agentes

### Agente 1: Arquiteto Serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)

- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Responsável por:** `functions/`, `src/` (exceto `src/data/`), `migrations/0001_init.sql`, `wrangler.jsonc`.
- **Entregas:**
  - Esquema relacional do D1 com 10 tabelas: usuários, sessões, servidores do Discord, palavras sorteadas, partidas, tentativas, estatísticas consolidadas, desafios e as partidas e tentativas dos desafios.
  - Login Discord OAuth2 (`identify guilds`) com proteção `state` contra CSRF. A sessão usa um token aleatório de 32 bytes em cookie `HttpOnly`, e o D1 guarda só o hash SHA-256 do token.
  - Sorteio secreto da palavra diária no servidor: embaralhamento determinístico com semente HMAC-SHA256 de um segredo (`WORD_SECRET`), materializado dia a dia no D1, sem repetição dentro do ciclo e sem nunca sortear dias futuros.
  - Regras de negócio validadas no servidor: normalização, dicionário, feedback com letras repetidas, limite de tentativas, bloqueio de data futura, cofres antigos fora do streak e do ranking, ranking por servidor só para membros.
  - Middleware com cabeçalhos de segurança, tratamento global de erro e reescrita das meta tags Open Graph para URLs absolutas.
- **Validação própria:** smoke test com `wrangler pages dev` e D1 local cobrindo login, os dois modos, cofres antigos, estatísticas, ranking, desafio e prévia de link.

### Agente 2: Interface Web Vanilla (HTML5, CSS3 e DOM)

- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md). Usou também a skill auxiliar de design de interface do próprio Claude Code (*frontend-design*) para a direção estética, subordinada à skill do projeto.
- **Responsável por:** `public/`.
- **Entregas:**
  - Aplicação de página única em JavaScript puro (ES modules, sem build e sem framework). Grade de letras e teclado virtual criados por manipulação direta do DOM.
  - Identidade visual "Cofre": paleta própria (menta, coral, grafite e latão), fontes Chivo e Chivo Mono hospedadas no próprio site (licença SIL OFL), disco de cofre animado e animações de revelação, tremida e vitória que respeitam `prefers-reduced-motion`.
  - Tela de entrada com tabuleiro de demonstração, abas de modo, Cofres antigos em calendário, estatísticas com distribuição, ranking global e por servidor, central de desafios, compartilhamento em emoji, "Como jogar", temas claro e escuro e modo daltônico (cores de alto contraste + marcação na peça).
  - Imagens Open Graph (`og.png`, `og-desafio.png`) e favicon.
  - Chave `P26-3A-0CED-4ACD-47F7-EDA9` no rodapé de todas as telas.
- **Validação própria:** servidor simulado fora do projeto e capturas com Chrome headless em celular e desktop, mais um roteiro de interação automatizado sem erros de console.

### Agente 3: Curador de Palavras

- **Skill:** [`skills/curadoria-palavras/SKILL.md`](./skills/curadoria-palavras/SKILL.md)
- **Responsável por:** `src/data/answers.js`, `src/data/valid.js`, `src/data/FONTES.md`, `tests/conferir-palavras.mjs`.
- **Entregas:**
  - **1161 respostas** curadas à mão: palavras comuns, com acentuação correta, sem plurais, conjugações, nomes próprios, estrangeirismos ou palavras ofensivas. São 580 dias sem repetição.
  - **10466 chutes válidos**, derivados do repositório `fserb/pt-br` (licença **MIT**, compatível com a licença do projeto), com a fonte e o aviso de copyright registrados em `src/data/FONTES.md`.
  - Script de conferência: tamanhos, duplicatas, respostas contidas nas válidas e palavra de demonstração fora do sorteio.

### Agente 4: Agente de Teste, Auditoria de Segurança e Validação

- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Responsável por:** `tests/` e `tests/RELATORIO-TESTES.md`.
- **Entregas:**
  - Testes unitários (`node --test`) da normalização, do feedback (inclusive letras repetidas), do modo Sombra, das datas no fuso de Brasília e das listas de palavras.
  - Testes de API contra o servidor local (`wrangler pages dev` + D1 local) com tentativas de trapaça: sem sessão, sessão forjada, data futura, chute após o limite, palavra fora do dicionário, resposta vazando antes do fim, recarregar a página, jogar o próprio desafio e ranking de servidor alheio.
  - Auditoria da rubrica com `validar-local.mjs`.
  - Relatório com os comandos, os resultados e os defeitos encontrados e corrigidos.
- **Resultado:** 73 casos executados (17 unitários, 27 de API e 29 de interface no Chrome contra o servidor real) e 0 falhas na rodada final. Nenhuma tentativa de trapaça passou. Foram encontrados e corrigidos 4 defeitos: um comando de teste errado no README e três textos da interface (média de tentativas sem vitórias e plurais).

---

## 5. Skills (pasta `skills/`)

| Skill | Agente | Conteúdo |
|---|---|---|
| `serverless-d1-discord` | Agente 1 | Regras de segurança, sessão, OAuth2, datas, SQL parametrizado, concorrência e checklist |
| `vanilla-dom-ui` | Agente 2 | Restrições vanilla, identidade visual "Cofre", acessibilidade e checklist |
| `curadoria-palavras` | Agente 3 | Critérios das duas listas, licença das fontes e checklist |
| `teste-validacao` | Agente 4 | Casos de teste, tentativas de trapaça, auditoria da rubrica e formato do relatório |
