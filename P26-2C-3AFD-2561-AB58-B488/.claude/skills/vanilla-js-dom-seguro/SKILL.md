---
name: vanilla-js-dom-seguro
description: Boas práticas de JavaScript puro e DOM seguro para a interface do Commonplace Book.
---

# Vanilla JS e DOM seguro

- Criar nós com o helper `el(tag, props, ...children)` de `public/app.js`; texto sempre como nó de texto.
- Nunca `innerHTML` com dado de usuário (citações e anotações são conteúdo não confiável).
- Busca instantânea: `input` + debounce de 250 ms + `loadToken` para descartar respostas antigas.
- Erros do servidor (`details` por campo) aparecem junto ao campo; falhas gerais em `role="alert"`.
- Estados vazios explicam o que fazer; botões dizem o que acontece ("Salvar citação").
- Acessibilidade: `<label>` em todo campo, `:focus-visible`, `aria-live` no sorteio, `<dialog>` nativo.
