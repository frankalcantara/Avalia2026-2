---
name: revisao-codigo
description: Revisão de código do mural: autenticação, autoria, injeção, dependências e checagens locais.
---

# Revisão de código

- Rode `node --check` em todos os arquivos `.js` de `functions/` e `public/`.
- Rode `node validar-local.mjs <CHAVE>` e anote o que está pendente.
- No OAuth: `state` validado, escopo mínimo, segredo só em variável de ambiente.
- Nos endpoints: sessão exigida, identidade derivada da sessão, propriedade conferida antes de editar/excluir, queries com parâmetros vinculados.
- No frontend: sem `innerHTML` com conteúdo do usuário, sem CDN ou framework, chave no rodapé.
- Reporte achados com arquivo e linha; não altere código sem pedido do estudante.