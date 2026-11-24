---
name: vanilla-web-craft
description: Engenharia de interfaces web responsivas, acessíveis e seguras utilizando exclusivamente HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks.
---

# Engenharia Web Vanilla (HTML5 + CSS3 + Vanilla JS)

## 1. Regras de Ouro (Zero Frameworks)
- Nenhum script CDN de UI, nenhuma dependência de build frontend obrigatória.
- HTML5 semântico (`<header>`, `<main>`, `<nav>`, `<section>`, `<article>`, `<footer>`, `<dialog>`).
- CSS3 organizado com Custom Properties (`--bg`, `--surface`, `--text`, `--primary`, `--border`, `--radius`, `--shadow`), CSS Grid e Flexbox, media queries responsivas e suporte a `prefers-reduced-motion`.

## 2. Cliente HTTP & Debounce (`public/js/api.js`)
```javascript
export async function apiRequest(path, options = {}) {
  const config = {
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(path, config);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = data?.error?.message || `Erro HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  return data;
}

export function debounce(fn, delay = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

## 3. Manipulação Segura e Reativa de DOM
- Crie elementos via `document.createElement` e preencha texto exclusivamente com `.textContent` para eliminar qualquer vetor de XSS.
- Para listas dinâmicas e recálculos em tempo real (inputs `input` / `change`), atualize nós específicos usando `data-*` attributes ou `DocumentFragment` sem disparar requisições HTTP desnecessárias.