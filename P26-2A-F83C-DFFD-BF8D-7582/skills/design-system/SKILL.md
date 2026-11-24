---
name: design-system
description: Design system do Projeto #14 em CSS puro. Use ao criar ou revisar tokens, cores claro/escuro, tipografia, espaçamento, botões, formulários, cards da timeline, badges, estados e responsividade, garantindo consistência visual e acessibilidade.
---

# Skill: Design System — Tokens, Componentes e Acessibilidade

**Arquivo de referência:** `public/style.css`
**Princípio:** um único lugar decide cor, espaço e forma; componentes apenas consomem tokens.

## Quando ativar

- Criar ou alterar qualquer estilo em `public/style.css` ou markup em `public/index.html`.
- Adicionar componente, variante de cor, estado de feedback ou breakpoint.
- Revisar dark mode, contraste, foco, movimento ou responsividade.
- Investigar inconsistência visual entre páginas/estados.

## 1. Fundamentos

1. **Tokens primeiro.** Nenhum valor hexadecimal, sombra ou raio novo direto no componente: crie/use uma Custom Property em `:root`.
2. **Cores semânticas, não literais.** Componentes usam `var(--primary)`, `var(--danger)`, `var(--text-soft)`; nunca `#5865f2` no meio de uma regra.
3. **Dark mode por tokens.** O tema escuro só redefine valores dentro de `@media (prefers-color-scheme: dark)`; nenhum componente é reescrito.
4. **Mobile-first não é obrigatório, mas o resultado deve ser fluido.** Layouts usam `flex`, `grid`, `clamp()` e `minmax()` antes de media queries.
5. **Acessibilidade é requisito, não extra.** Contraste, foco visível, alvo de 44px e `prefers-reduced-motion` são obrigatórios.
6. **Zero frameworks.** Sem Tailwind, Bootstrap, CSS-in-JS ou ícones de CDN.

## 2. Tokens

### Superfícies

| Token | Claro | Escuro | Uso |
|-------|-------|--------|-----|
| `--bg` | `#f4f5fb` | `#0e1020` | fundo da página |
| `--bg-soft` | `#eceef9` | `#161932` | fundo de avatar/fallback |
| `--surface` | `#ffffff` | `#171a30` | cards e painéis |
| `--surface-2` | `#f8f9ff` | `#1d2140` | inputs e superfícies internas |
| `--header-bg` | branco 82% | escuro 84% | header sticky com blur |
| `--footer-bg` | `#14162a` | `#080a14` | rodapé sempre escuro |

### Texto

| Token | Uso |
|-------|-----|
| `--text` | títulos e texto principal |
| `--text-soft` | corpo de card, labels, textos secundários fortes |
| `--muted` | hints, placeholders, metadados |
| `--on-primary` | texto sobre botão primário (sempre branco) |

### Bordas, marca e semânticas

| Token | Uso |
|-------|-----|
| `--border` / `--border-strong` | divisórias e contornos (forte para hover/empty) |
| `--primary` / `--primary-strong` | marca, links, foco, botão primário |
| `--primary-soft` | fundo de badge/estado selecionado |
| `--primary-glow` | sombra colorida de botão/marca |
| `--success` / `--success-soft` | impedimento `sem`, feedback positivo |
| `--warning` / `--warning-soft` | impedimento `atencao` |
| `--danger` / `--danger-strong` / `--danger-soft` | impedimento `bloqueado`, erros, logout |
| `--ring` | anel de foco (`box-shadow`/`outline`) |

### Botões, ícones e seleção

| Token | Uso |
|-------|-----|
| `--btn-primary-from` / `--btn-primary-to` | gradiente do botão primário (branco com contraste AA) |
| `--btn-primary-hover-from` / `--btn-primary-hover-to` | gradiente no hover |
| `--btn-danger-from` / `--btn-danger-to` | gradiente do botão "Sair" |
| `--btn-danger-hover-from` / `--btn-danger-hover-to` | hover do "Sair" |
| `--success-icon-bg` / `--danger-icon-bg` | fundo dos ícones ✓/! do feedback |
| `--selection-bg` | fundo de `::selection` |

> Os botões usam tokens próprios porque `--primary` clareia no dark mode e ficaria com contraste insuficiente para texto branco.

### Forma, sombra e movimento

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-sm` | 10px | feedback, pills pequenos |
| `--radius` | 16px | cards da timeline |
| `--radius-lg` | 22px | painéis de formulário/filtros |
| `--shadow-sm` | sombra sutil | cards, inputs elevados |
| `--shadow-md` | sombra média | painéis |
| `--shadow-lg` | sombra alta | hover de card |
| `--transition` | `180ms cubic-bezier(.22,.61,.36,1)` | todas as transições |
| `--ring` | cor da marca com alpha | foco |

> **Regra:** ao adicionar token, definir valor no claro e no escuro (quando aplicável) e documentar aqui.

## 3. Tipografia

- **Família:** `"Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Base:** `16px`, `line-height: 1.6`.
- **Título da marca:** `clamp(1.12rem, 2vw, 1.35rem)`, peso 750, `letter-spacing: -0.02em`.
- **Título de seção (`h2`):** `1.12rem`, peso 750, `-0.015em`.
- **Hint de seção:** `0.82rem`, `--muted`, máx. `55ch`.
- **Corpo de card:** `0.96rem`, `line-height: 1.75`, `--text-soft`, `white-space: pre-wrap`.
- **Metadados/badges:** `0.68–0.78rem`, peso 650–750; números usam `font-variant-numeric: tabular-nums`.
- **Nunca** usar menos de `0.68rem`; evitar parágrafos com mais de `70ch`.

## 4. Espaçamento e layout

- **Container:** `max-width: 1000px; margin-inline: auto`.
- **Header:** padding `0.9rem 1.5rem`; sticky com `backdrop-filter: blur(16px)`.
- **Main:** padding `2.4rem 1.5rem 3.5rem`.
- **Ritmo vertical:** 0.45rem (label→campo), 0.85–1.15rem (entre campos), 1.5rem (entre painéis), 2.2–2.4rem (entre blocos).
- **Grid de filtros:** `minmax(220px, 2.2fr) repeat(3, minmax(130px, 1fr)) auto`.
- **Footer:** centralizado, `flex-wrap`, separadores `·` com `opacity: .45`.

## 5. Componentes

### Botões (`.btn`)

- Base: `inline-flex`, `gap: .5rem`, `min-height: 44px`, `padding: .62rem 1.1rem`, `radius: 12px`, peso 650.
- `--primary`: gradiente `--btn-primary-from → --btn-primary-to` com texto `--on-primary` e contraste AA; hover usa os tokens `--btn-primary-hover-*`.
- `--secondary`: superfície + borda, para ações neutras (Filtrar).
- `--ghost`: sem fundo, para "Limpar".
- `--danger`: gradiente `--btn-danger-from → --btn-danger-to`, para "Sair"; hover usa `--btn-danger-hover-*`.
- Estados: `:hover` só em `@media (hover: hover)`, `:active` desloca 1px, `:disabled` opacity .6 e `cursor: not-allowed`.

### Formulários

- `label` sempre visível, `0.88rem`, peso 650.
- Campos com `min-height: 44px`, fundo `--surface-2`, borda `--border`, raio 12px.
- Foco: borda `--primary` + `box-shadow: 0 0 0 4px var(--ring)`, sem `outline` duplicado.
- Select: `appearance: none` + seta SVG data URI à direita (16px).
- Textarea: mínimo 132px, `resize: vertical`.
- Contador de caracteres em pill tabular (`0 / 2000`).

### Painéis (`.form-section`, `.filters-section`)

- Superfície, borda, `--radius-lg`, `--shadow-md`.
- Barra superior de 3px com gradiente `primary → violeta → transparente`.
- Cabeçalho com título + hint à esquerda e badge à direita; em ≤720px empilha.

### Badges

- `.step-badge`: pill maiúsculo, `--primary-strong` sobre `--primary-soft` (contraste AA).
- `.utc-badge`: pill com ponto verde pulsante (respeitando reduced motion).
- `.card-impedimento`: pill com ponto `currentColor`; variantes `.sem`, `.atencao`, `.bloqueado` definem `--accent`/`--accent-soft`.

### Feedback

- Borda esquerda de 4px, fundo suave, ícone via `::before` (✓ ou !).
- `.success` usa `--success`; `.error` usa `--danger`.
- Sempre dentro de `role="alert"`/`role="status"`.

### Timeline — geometria exata

Desktop:

- Eixo: `left: 14px`, `width: 3px` → centro em **15.5px**.
- Card: `padding-left` da timeline `48px` + `border-left` do card `4px` → padding box em **52px**.
- Dot: 16px → `left = 15.5 − 52 − 8 = −44.5px`.

Mobile (≤720px):

- Eixo: `left: 11px`, `width: 3px` → centro em **12.5px**.
- Card: `padding-left: 40px` + borda `4px` → padding box em **44px**.
- Dot: 14px → `left = 12.5 − 44 − 7 = −38.5px`.

Regras:

- Card com `border-left: 4px solid var(--accent)` e `--accent` por `data-impedimento`.
- Entrada animada com `fadeInUp` e atraso `calc(var(--i, 0) * 45ms)`.
- `.timeline.timeline-empty` remove o eixo (`::before { display: none }`) e o padding.
- Estado vazio: caixa tracejada, ícone de livro, superfície em gradiente.

### Rodapé

- Sempre escuro nos dois temas; linha superior com gradiente da marca.
- Chave Única em `<code>` com pill translúcida, monoespaçada, peso 700.
- Em ≤480px vira coluna e os separadores somem.

## 6. Dark mode

```css
:root { color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  :root { /* apenas valores dos tokens */ }
}
```

- Não usar `filter: invert()`.
- Não duplicar regras de componentes no bloco escuro.
- Testar contraste nos dois temas; o rodapé permanece escuro no claro (contraste intencional).

## 7. Movimento

- Transições: 180ms, curva `cubic-bezier(.22,.61,.36,1)`.
- Entrada de card: 420ms, deslocamento de 12px.
- Pulso do `utc-dot`: 2.6s.
- `@media (prefers-reduced-motion: reduce)` zera animações/transições e garante `.timeline-card { opacity: 1; transform: none; }`.

## 8. Responsividade

| Breakpoint | Mudanças |
|------------|----------|
| ≤ 900px | filtros em 2 colunas, busca full-width, ações à direita |
| ≤ 720px | header empilhado, main `1.5rem`, timeline `2.5rem`, headings empilhados com badge acima do título, dot menor |
| ≤ 620px | filtros em 1 coluna, botões full-width |
| ≤ 480px | header/brand compactos, painéis `1.15rem`, card-header empilhado, rodapé em coluna |

## 9. Acessibilidade visual

- Foco global: `:where(a, button, input, select, textarea):focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }`.
- Campos em foco combinam borda `--primary` com brilho `0 0 0 4px var(--ring)`.
- Contraste mínimo: 4.5:1 texto normal, 3:1 texto grande e bordas de componente. Textos pequenos sobre fundos suaves usam `--primary-strong`/`--success` escurecido (nunca `--primary` puro no claro).
- Não comunicar estado só por cor: badge tem texto + ponto.
- Alvos ≥ 44×44px.
- Zoom de 200% sem perda de conteúdo.
- `::selection` com `--selection-bg` e texto branco.

## 10. Convenções de código

- Classes em kebab-case, semânticas por função (`.card-content`, `.filter-actions`).
- Variantes por classe (`.btn-primary`) ou `data-*` (`.timeline-card[data-impedimento="atencao"]`).
- Estado global: `.hidden` (`display: none !important`); estado de timeline: `.timeline-empty`.
- Nada de estilo inline no HTML; no JS, apenas `--i` para o stagger.
- Ordem no arquivo: reset → tokens → base → header → botões → layout → feedback → painéis → formulários → filtros → timeline → rodapé → animações → reduced motion → responsividade.

## 11. Checklist de revisão visual

- [ ] Claro e escuro consistentes (sem cor hardcoded).
- [ ] 360px, 768px e 1280px sem overflow horizontal.
- [ ] Foco visível em todos os controles via teclado.
- [ ] Botões desabilitados visualmente distintos.
- [ ] Timeline alinhada (dot centrado no eixo) em desktop e mobile.
- [ ] Badges legíveis e coerentes com `sem/atencao/bloqueado`.
- [ ] Empty state e loading visualmente claros.
- [ ] Rodapé contém a Chave Única e mantém contraste.
- [ ] `prefers-reduced-motion` desliga animações.
- [ ] Nenhuma fonte/ícone externo adicionado.

## 12. Anti-patterns

- ❌ Hex direto em componente.
- ❌ `!important` fora de `.hidden`.
- ❌ Novos breakpoints sem documentar.
- ❌ Reestilizar componente dentro do bloco dark.
- ❌ Foco removido (`outline: none` sem substituto).
- ❌ Texto sobre gradiente sem contraste.
- ❌ Dot da timeline fora do eixo por ajuste manual sem recalcular.
- ❌ Adicionar framework "só para um componente".
