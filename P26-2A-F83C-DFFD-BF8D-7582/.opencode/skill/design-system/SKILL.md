---
name: design-system
description: Tokens, componentes, dark mode, acessibilidade e responsividade do design system em CSS puro do Projeto #14.
---

# Design System — regras operacionais

## Invariantes

- Cores/espaços/raios sempre via tokens em `:root`; nunca hex direto no componente.
- Dark mode só redefine tokens em `@media (prefers-color-scheme: dark)`.
- Foco visível: `outline: 3px solid var(--primary); outline-offset: 2px` (sólido, não translúcido).
- Alvos ≥44px; contraste AA; respeitar `prefers-reduced-motion`.
- Rodapé sempre escuro com a Chave Única em pill monoespaçada.

## Componentes

- Botões: `.btn` + `-primary` / `-secondary` / `-ghost` / `-danger`; disabled com opacity .6. Primário e danger usam tokens `--btn-*` para manter contraste AA no dark mode.
- Painéis: superfície + borda + `--radius-lg` + barra superior de 3px.
- Timeline: `border-left` de 4px na cor do impedimento; eixo em gradiente; dot centrado.
  - Desktop: linha 14px + 3px → centro 15.5; dot 16px em `left: -44.5px`.
  - ≤720px: linha 11px + 3px → centro 12.5; dot 14px em `left: -38.5px`.
- Badges sempre com texto + ponto/símbolo, não só cor.
- Empty state: caixa tracejada, ícone e gradiente de superfície.

## Breakpoints

`900px` (filtros 2 col), `720px` (header/timeline compactos), `620px` (1 coluna), `480px` (mobile estreito).

## Antes de concluir

- [ ] Claro/escuro sem cor hardcoded.
- [ ] 360/768/1280px sem overflow.
- [ ] Foco, contraste e alvos de toque OK.
- [ ] Guia completo: `skills/design-system/SKILL.md`.
