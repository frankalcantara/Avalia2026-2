# Proveniência — skills do Ponytail

Este diretório guarda **cópias adaptadas** das skills do projeto
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), usadas
como base de estilo de engenharia pelos agentes deste projeto.

## Origem fixada

| Campo | Valor |
|---|---|
| Repositório | `https://github.com/DietrichGebert/ponytail` |
| Versão | `5.3.3` |
| Commit | `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846` |
| Licença | MIT — © 2026 DietrichGebert (texto em `LICENSE`) |
| Data da cópia | 08/11/2026 |

## Arquivos upstream usados como referência

| Upstream | Cópia neste repositório |
|---|---|
| `LICENSE` | `LICENSE` (texto integral, sem alteração) |
| `skills/ponytail/SKILL.md` | `skills/ponytail/SKILL.md` |
| `skills/ponytail-review/SKILL.md` | `skills/ponytail-review/SKILL.md` |
| `skills/ponytail-audit/SKILL.md` | `skills/ponytail-audit/SKILL.md` |
| `skills/ponytail-debt/SKILL.md` | `skills/ponytail-debt/SKILL.md` |

## O que foi alterado

As skills foram **traduzidas para pt-BR e adaptadas** ao harness OpenCode e ao
contexto deste projeto (Cloudflare Pages Functions + D1, HTML/CSS/JS puro,
auditoria por hash). Não são cópias literais: o texto, os exemplos e os
caminhos citados mudaram. Os detalhes estão em [`ADAPTACAO.md`](./ADAPTACAO.md).

## Como carregar

O `opencode.json` na raiz do projeto declara `"skills": ["./skills"]`. O
OpenCode encontra arquivos `SKILL.md` aninhados até seis níveis abaixo da raiz,
então as quatro skills vendorizadas ficam disponíveis com os IDs
`ponytail`, `ponytail-review`, `ponytail-audit` e `ponytail-debt`.

## Aviso de licença

O texto MIT do upstream é preservado integralmente em `LICENSE`. O restante
deste repositório continua sob a licença MIT do autor do projeto (arquivo
`LICENSE` na raiz). Nenhuma marca, logo ou material promocional do upstream foi
copiado.
