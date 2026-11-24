---
name: vanilla-frontend
description: Regras operacionais de HTML5, CSS3 e JavaScript puro, timeline, formulários e filtros do Projeto #14.
---

# Frontend Vanilla — regras operacionais

## Invariantes

- Zero frameworks/bibliotecas de UI e zero build (HTML5 + CSS3 + JS ES6+).
- Dados da API só via `textContent`/`createElement`; nunca `innerHTML` com conteúdo do usuário.
- `fetch` relativo com `credentials: 'include'`.
- Formulário e filtros só visíveis autenticado; logout via `/api/auth/me?logout=1`.
- Feedback inline (`#auth-feedback`, `#form-feedback`), nunca `alert`.
- `<footer>` sempre com `P26-2A-F83C-DFFD-BF8D-7582`.

## Contrato de IDs (script.js)

`auth-area`, `auth-feedback`, `form-section`, `log-form`, `conteudo`, `char-count`, `impedimento`, `form-feedback`, `submit-btn`, `filters-section`, `filters-form`, `busca`, `filtro-impedimento`, `inicio`, `fim`, `clear-filters`, `timeline`.

Classes geradas: `.timeline-card`, `.card-header`, `.card-meta`, `.card-date`, `.card-author`, `.card-impedimento`, `.card-content`, `.card-empty`, `.timeline-empty`.

## Estados

- Loading: "Carregando registros..."
- Vazio sem filtro e vazio com filtro têm mensagens distintas.
- Erro de rede e sessão expirada têm mensagens próprias.
- Botão "Registrando..." desabilitado durante o POST.

## Antes de concluir

- [ ] Nenhum framework adicionado.
- [ ] IDs/classes preservados.
- [ ] Light/dark, 360/768/1280px e teclado testados.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Guia completo: `skills/vanilla-frontend/SKILL.md`.

