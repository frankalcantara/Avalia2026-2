---
name: vanilla-dom-ui
description: Constrói interfaces responsivas em HTML5, CSS3 e JavaScript puro, manipulando o DOM diretamente e consumindo as rotas /api via fetch. Usar ao criar ou alterar qualquer arquivo em public/.
---

# Skill: Interface Web Vanilla (HTML5 + CSS3 + DOM)

Usada pelo **Agente 2 (Frontend)**. Contrato obrigatório: `docs/SPEC.md`, seções 4 e 5.

## Estrutura de arquivos

```
public/
  app.js         ponto de entrada: roteador por hash, estado de sessão, inicialização
  index.html     casca semântica: <header>, <main id="app">, <footer> com a chave
  styles.css     tema, layout responsivo, barras de resultado
  js/api.js      wrapper de fetch (credentials same-origin, JSON, tratamento de erro)
  js/dom.js      helper h(tag, attrs, ...children) para criar elementos
  js/views.js    telas: login, lista, nova enquete, detalhe/resultado
```

Scripts carregados com `<script type="module">`. Sem bundler, sem CDN de framework.

## Regras obrigatórias

1. **Zero frameworks de UI** (React, Vue, Angular, Svelte, jQuery, Alpine, htmx). Apenas APIs nativas.
2. **Segurança no DOM:** dados vindos do servidor entram via `textContent` ou atributos, **nunca** via `innerHTML`. Avatares só com `src` vindo da API.
3. **Barras de resultado:** cada opção é uma linha com rótulo, `div.bar` cuja `width` é `percent%` (transição CSS), percentual e número de votos. A opção do usuário recebe destaque e o texto "seu voto". Usar `role="meter"` ou `aria-valuenow` para acessibilidade.
4. **Validação no cliente só para UX** (mesmas regras do SPEC); a mensagem de erro final exibida é sempre a `message` do servidor.
5. **Prazo:** o `datetime-local` é convertido com `new Date(valor).toISOString()` antes do envio; datas exibidas com `Intl.DateTimeFormat('pt-BR')`. Mostrar "encerra em X" usando `server_now` para não depender do relógio do cliente.
6. **Responsivo:** mobile-first, uma coluna até 640px, grid de cards acima disso; alvos de toque com 44px.
7. **Estados visíveis:** carregando, vazio, erro, sucesso. Botão de voto desabilitado durante o envio para evitar duplo clique.
8. **Tipografia limpa:** sem `text-shadow` nem `drop-shadow` em textos.
9. **Rodapé:** `<footer>` estático no `index.html` contendo `P26-2A-0FC2-F5F9-5A1B-0D19` (precisa estar no HTML servido, não só injetado por JS).

## Checklist de entrega

- [ ] Fluxo completo: login → lista → criar → votar → ver barras.
- [ ] Nenhum uso de `innerHTML` com dados dinâmicos.
- [ ] Layout testado em 375px e 1280px.
