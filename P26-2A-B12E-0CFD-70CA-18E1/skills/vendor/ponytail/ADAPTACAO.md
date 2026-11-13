# Adaptação das skills do Ponytail para este projeto

Este documento explica **exatamente** o que mudou em relação ao upstream, para
que a rubrica de "skills adaptadas, não copiadas" possa ser conferida.

## Por que adaptar em vez de copiar

1. O upstream é escrito em inglês e pensado para repositórios genéricos. Os
   agentes deste projeto trabalham em **pt-BR**, com nomes de arquivos e
   mensagens de erro em português.
2. O harness é o **OpenCode**, não Claude Code: não existem `/comandos` nem
   plugins do Ponytail. O que existe é o tool `skill` e o campo `description`
   do frontmatter.
3. O projeto tem restrições próprias que o upstream não conhece: sem
   frameworks de UI, sem bundler, D1 com triggers de imutabilidade, Fisher-Yates
   no servidor e ata verificável por hash.

## Mudanças por arquivo

### `skills/ponytail/SKILL.md`

| Upstream | Adaptação |
|---|---|
| "You are a lazy senior developer" | Mantido o conceito, traduzido para "desenvolvedor sênior preguiçoso". |
| Escada de 6 degraus genérica | Degraus reordenados e exemplificados com o projeto: helper em `functions/_lib/`, `crypto.subtle`, `Intl`, CSS nativo, nenhuma dependência nova. |
| "Never cut: validation at trust boundaries..." | Explicitado com os limites do projeto: validação de entrada, triggers do D1, CSP, acessibilidade, imutabilidade da ata. |
| Níveis `lite/full/ultra` | Mantidos, mas sem comando `/ponytail`: o nível é pedido em linguagem natural. |
| Exemplo de "date picker" | Substituído por exemplos reais: reutilizar `el()` em vez de `innerHTML`, usar `crypto.getRandomValues` em vez de biblioteca. |

### `skills/ponytail-review/SKILL.md`

| Upstream | Adaptação |
|---|---|
| Review de "diff/PR" genérico | Aponta para `git diff`, `git diff --staged` e para os arquivos deste projeto. |
| Categorias de achado | Mantidas (bug, risco, escala, teste, velocidade, enxuto), com exemplos de D1/Cloudflare. |
| Formato de saída em inglês | Traduzido: `O que esta mudança faz:`, `Corrigir agora`, `Corrigir depois`, `Opcional`, `Veredito`. |
| "Must fix / Should fix / Nice to have" | Traduzido para `Corrigir agora` / `Corrigir depois` / `Opcional`. |

### `skills/ponytail-audit/SKILL.md`

| Upstream | Adaptação |
|---|---|
| Auditoria de repo inteiro | Mantida, com mapa obrigatório das rotas em `functions/api/` e das queries em `functions/_lib/db.js`. |
| "Map first" | Inclui ler `migrations/0001_init.sql`, `wrangler.jsonc`, `tests/` e a ata pública. |
| Carga esperada | Fixada no contexto real: uma turma de até 60 pessoas, um organizador por sala. |
| Saída | Traduzida e limitada a 20 achados, com `Veredito` e `Não verificado`. |

### `skills/ponytail-debt/SKILL.md`

| Upstream | Adaptação |
|---|---|
| Marcador `shortcut:` / `ponytail:` | Mantido `shortcut:` como convenção; o projeto não usa `ponytail:` legado. |
| `git grep` | Comando adaptado ao PowerShell (`Select-String`) e ao `git grep` quando disponível. |
| Saída | Traduzida, com coluna de arquivo:linha e tag `sem-gatilho`. |

## O que foi preservado de propósito

- A ordem de prioridade: **correto > seguro > aguenta carga > testado > rápido
  > enxuto**.
- A regra "código enxuto não é código golfado": validação, tratamento de erro,
  segurança e acessibilidade nunca são cortados.
- O hábito de deixar **um teste pequeno** para lógica com branch, laço, parser,
  dinheiro ou segurança.
- O comentário `shortcut: <limite>, <quando revisar>` para dívida consciente.
- O formato de achado com "o que é / problema / correção / se ignorar".

## O que foi removido

- Logos, badges, banners, benchmarks e material promocional.
- Comandos de barra (`/ponytail`, `/ponytail-review`, ...), que não existem no
  OpenCode.
- Instruções de instalação do plugin, hooks e `marketplace`.
- Referências a `CLAUDE.md`, Cursor, Windsurf, Cline e Kiro.

## Verificação

```powershell
# as quatro skills vendorizadas existem e têm frontmatter
Get-ChildItem skills/vendor/ponytail/skills -Recurse -Filter SKILL.md |
  ForEach-Object { $_.FullName; (Get-Content $_.FullName -TotalCount 1) }
```

O teste automatizado `tests/documentacao.test.mjs` também verifica a presença
dos quatro arquivos, da licença MIT e do commit de origem.
