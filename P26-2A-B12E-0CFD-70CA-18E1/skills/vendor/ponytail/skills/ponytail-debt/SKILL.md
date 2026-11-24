---
name: ponytail-debt
description: >
  Lista todo comentário `shortcut:` como um livro de dívida técnica, para
  "depois" não virar "nunca". Relatório único, não altera nada. Use para
  "dívida do ponytail", "o que ficou adiado", "lista os atalhos". Base adaptada
  do Ponytail 5.3.3 (MIT, DietrichGebert) — ver
  skills/vendor/ponytail/ADAPTACAO.md.
license: MIT
---

# Dívida Ponytail (adaptada)

Cada atalho deliberado é marcado com um comentário `shortcut:` que nomeia o teto
e o caminho de atualização. Esta skill junta todos em um livro, para um adiamento
não virar permanente sem ninguém notar.

## Varredura

Procure o marcador no repositório, ignorando `.git`, `node_modules`, `.wrangler`
e tudo que os `.gitignore` ignoram.

```powershell
# PowerShell, sem depender do git
Get-ChildItem -Recurse -File -Include *.js,*.mjs,*.sql,*.css,*.html,*.md,*.jsonc |
  Where-Object { $_.FullName -notmatch '\\(\.git|node_modules|\.wrangler)\\' } |
  Select-String -Pattern '(#|//|/\*) ?shortcut:'
```

```bash
# equivalente com git
git grep --no-index --exclude-standard -nE '(#|//|/[*]) ?shortcut:'
```

Se a pessoa nomear outro marcador (`ponytail-debtTODO`, por exemplo), procure
essa palavra. O prefixo de comentário evita que prosa que apenas cita a
convenção entre no livro. Descarte achados que não são adiamento, como uma nota
sobre atalho de teclado.

## Saída

Uma linha por marcador, agrupada por arquivo:

```text
<arquivo>:<linha>, <o que foi simplificado>. teto: <o limite nomeado>. atualizar: <o gatilho para revisar>.
```

A convenção é `shortcut: <teto>, <caminho de atualização>`, então puxe o teto e o
gatilho direto do comentário. Quer um responsável por linha? Use
`git blame -L<linha>,<linha> -- <arquivo>`.

Marque o risco de apodrecer: comentário que não nomeia caminho de atualização nem
gatilho recebe a tag `sem-gatilho`. São esses que apodrecem em silêncio.

Termine com `<N> marcadores, <M> sem gatilho.` Nada encontrado: `Sem dívida de
atalho. Livro limpo.`

## Limites

Só lê e relata, não altera nada. Para persistir, peça e ela grava o livro em um
arquivo (por exemplo, `DIVIDA.md`). Execução única.
