---
name: vanilla-frontend
description: Interface web em HTML5, CSS3 e JavaScript puro para o Projeto #14. Use ao alterar public/index.html, style.css ou script.js, timeline, formulários, filtros, estados de sessão, acessibilidade e responsividade sem frameworks.
---

# Skill: Frontend Vanilla — HTML5 + CSS3 + JavaScript puro

**Projeto:** #14 — Diário de Bordo de Projetos
**Arquivos:** `public/index.html`, `public/style.css`, `public/script.js`
**Design system:** seguir também a skill `design-system`.

## Quando ativar

- Alterar markup, estilos, componentes ou comportamento do frontend.
- Adicionar/ajustar timeline, formulário, filtros, feedback ou estados vazios.
- Revisar acessibilidade, responsividade, dark mode ou performance.

## Regras não negociáveis

1. **Zero frameworks e zero build.** Proibido React, Vue, Svelte, Angular, Tailwind, Bootstrap, jQuery, Alpine, htmx, preprocessadores CSS e bundlers. Apenas HTML5, CSS3 e JS ES6+ carregados diretamente.
2. **Nenhuma dependência externa de UI.** Ícones são SVG inline ou data URI; fontes são do sistema (`system-ui`, `Segoe UI`).
3. **DOM seguro.** Dados da API entram via `textContent`/`createElement`. Nunca `innerHTML` com conteúdo do usuário (previne XSS).
4. **`fetch` com `credentials: 'include'`.** Toda chamada à API usa caminho relativo (`/api/...`).
5. **Sessão manda na UI.** Formulário e filtros só aparecem com usuário autenticado; logout usa `/api/auth/me?logout=1` sem sair da página.
6. **Feedback inline.** Proibido `alert`, `confirm` ou `prompt`. Usar as regiões `#auth-feedback` e `#form-feedback` com `role="alert"`/`aria-live`.
7. **Chave no rodapé.** `<footer>` deve conter `P26-2A-F83C-DFFD-BF8D-7582` de forma visível.
8. **Não quebrar o contrato de seletores.** O `script.js` depende dos IDs e classes listados abaixo; renomear exige atualizar os dois lados.

## Contrato de seletores (não renomear sem atualizar o JS)

| ID | Uso |
|----|-----|
| `auth-area` | botão de login / usuário + logout |
| `auth-feedback` | erros de autenticação e de filtros |
| `form-section` | painel de nova entrada |
| `log-form` | formulário de registro |
| `conteudo` | textarea (máx. 2000) |
| `char-count` | contador `0 / 2000` |
| `impedimento` | select `sem/atencao/bloqueado` |
| `form-feedback` | feedback do registro |
| `submit-btn` | botão de envio (estado "Registrando...") |
| `filters-section` | painel de filtros |
| `filters-form` | formulário de filtros |
| `busca` | palavra-chave |
| `filtro-impedimento` | filtro por impedimento |
| `inicio` / `fim` | intervalo de datas |
| `clear-filters` | limpar filtros |
| `timeline` | container da linha do tempo |

Classes geradas pelo JS: `.user-info`, `.avatar`, `.username`, `.timeline-card`, `.card-header`, `.card-meta`, `.card-date`, `.card-author`, `.card-impedimento`, `.card-content`, `.card-empty`, `.timeline-empty`, `.feedback.success`, `.feedback.error`, `.btn`, `.btn-primary`, `.btn-danger`.

## Arquitetura do `script.js`

- **IIFE** com `'use strict'`; nenhuma variável global.
- **Estado centralizado:** `state = { user, logs, filters }`.
- **Módulo `api`:** `get(url)` e `post(url, data)`, com tratamento de `401` → `{ unauthorized: true }`.
- **Fluxo:** `init()` → `checkUrlAuthError()` → `updateCharCount()` → listeners → `checkAuth()`.
- **Renderização:** `renderAuthArea()`, `renderTimeline()`, `renderEmptyTimeline()`, `createTimelineCard()`.
- **Formulário:** valida `conteudo` vazio, desabilita o botão durante o POST e restaura no `finally`.
- **Filtros:** valida `inicio <= fim`, limpa via botão e recarrega com query string.

## Estados obrigatórios da timeline

| Estado | Comportamento | Texto de referência |
|--------|---------------|---------------------|
| Carregando | `renderEmptyTimeline('Carregando registros...')` | feedback imediato |
| Vazio (sem filtro) | card vazio com convite | "Nenhum registro cadastrado ainda..." |
| Vazio (com filtro) | card vazio específico | "Nenhum registro encontrado para os filtros aplicados." |
| Erro de rede | card vazio com a mensagem | "Erro ao carregar registros: ..." |
| Sessão expirada | volta ao estado deslogado | "Sua sessão expirou..." |

A timeline recebe `.timeline-empty` quando não há cards; o CSS remove o eixo vertical nesse estado.

## Acessibilidade (mínimos)

- Todo campo com `<label for>`; placeholder não substitui label.
- `#auth-feedback` com `role="alert"` e `aria-live="polite"`; `#form-feedback` com `role="status"`.
- Foco visível global: `:focus-visible` com `outline: 3px solid var(--ring)` e `outline-offset: 2px`.
- Alvos de toque com no mínimo 44px de altura.
- Contraste mínimo AA (4.5:1) para texto e (3:1) para componentes.
- Respeitar `prefers-reduced-motion`: animações viram ~0ms e cards ficam visíveis.
- Avatar com `alt` descritivo; ícones decorativos com `aria-hidden="true"`.
- Datas em `<time datetime="...">` com `dateTime` igual ao UTC retornado pela API.

## Segurança no cliente

- Nunca usar `innerHTML` para `conteudo`, `username`, `avatar` ou mensagens de erro.
- Avatar: montar URL a partir de `user_id`/hash e definir `onerror` para o fallback `cdn.discordapp.com/embed/avatars/N.png`.
- Não persistir sessão em `localStorage`/`sessionStorage`; o cookie `HttpOnly` é a única fonte.
- Não exibir detalhes internos de erro; usar mensagens amigáveis.

## Responsividade (breakpoints oficiais)

| Largura | Ajuste |
|---------|--------|
| ≤ 900px | filtros em 2 colunas; busca ocupa a linha inteira |
| ≤ 720px | header empilhado; timeline com padding menor; headings empilhados |
| ≤ 620px | filtros em 1 coluna; botões de filtro e registro em largura total |
| ≤ 480px | header compacto; card-header empilhado; rodapé em coluna |

## Checklist antes de concluir

- [ ] Nenhum framework/biblioteca adicionado.
- [ ] IDs e classes do contrato preservados (ou JS atualizado junto).
- [ ] Fluxo deslogado → login → registrar → filtrar → logout funciona.
- [ ] Contador de caracteres atualiza no `input`.
- [ ] Botão desabilita durante envio e volta ao normal.
- [ ] Timeline ordenada (servidor) e com cor por impedimento.
- [ ] Estados de loading/vazio/erro presentes.
- [ ] Light e dark mode legíveis.
- [ ] Teclado: Tab alcança tudo, foco visível, Enter envia formulários.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] `<footer>` contém a Chave Única.
- [ ] Nenhuma alteração fora de `P26-2A-F83C-DFFD-BF8D-7582/`.

## Anti-patterns

- ❌ `innerHTML = log.conteudo`.
- ❌ Frameworks ou CDNs de UI.
- ❌ `onclick` inline no HTML.
- ❌ `alert()` para erros.
- ❌ Duplicar estado entre DOM e `state`.
- ❌ Recarregar a página após registrar (usar `loadLogs()`).
- ❌ Esconder o formulário via CSS sem alternar `.hidden` no JS.
- ❌ Datas formatadas a partir de campo editável (usar `criado_em` do servidor).

