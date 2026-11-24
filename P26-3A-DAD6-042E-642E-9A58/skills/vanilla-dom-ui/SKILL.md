---
name: vanilla-dom-ui
description: Construir a interface web em HTML5, CSS3 e JavaScript puro (Vanilla JS), com manipulação direta do DOM, acessível e responsiva, consumindo a API do projeto. Usar ao criar ou alterar qualquer arquivo em public/.
---

# Skill: Interface Vanilla (HTML5 + CSS3 + JS puro)

## Quando usar
Sempre que for criar ou alterar `public/index.html`, `public/styles.css` ou
`public/app.js`.

## Fonte da verdade
`docs/contrato-api.md` define as rotas e os objetos JSON que a tela consome.

## Regras obrigatórias
1. **Sem frameworks nem bibliotecas**: nada de React, Vue, Angular, jQuery,
   Bootstrap, Tailwind ou CDN de UI. Sem `package.json` no front.
2. **DOM direto**: `document.createElement`, `textContent`, `append`,
   `addEventListener`. Para dados do usuário **nunca** usar `innerHTML`
   (evita XSS com títulos e nomes vindos do Discord).
3. **Roteamento por hash** (`#/`, `#/novo`, `#/evento/:id`) com
   `window.addEventListener("hashchange", …)`.
4. **fetch** com `credentials: "same-origin"`; tratar 401 (mostrar botão
   "Entrar com Discord" apontando para `/api/auth/discord?next=…`),
   400 (mostrar erros por campo), 409 e erros de rede com mensagem clara.
5. **Estados visíveis**: carregando, vazio, erro, vagas restantes, "Lotado — você
   entrará na fila de espera", posição na fila, confirmado.
6. **Formulários** com HTML5 (`required`, `min`, `max`, `type="date"`,
   `type="time"`, `type="number"`) **e** validação do servidor exibida.
7. **Responsivo** do celular (360 px) ao desktop, mobile-first, com CSS Grid ou
   Flexbox e variáveis CSS; suporte a tema escuro com `prefers-color-scheme`.
8. **Acessibilidade**: HTML semântico (`header`, `main`, `nav`, `footer`,
   `button`), `label` em todo campo, foco visível, `aria-live` nas mensagens,
   contraste adequado, imagens de avatar com `alt`.
9. **Rodapé obrigatório**: `<footer>` com a chave `P26-3A-DAD6-042E-642E-9A58`,
   turma 3A e "Licenciado sob MIT".
10. Textos da interface em português do Brasil.

## Checklist antes de entregar
- [ ] `grep -n "innerHTML" public/app.js` não usa dados do usuário.
- [ ] A página funciona sem login (lista e detalhe) e pede login para criar e
      confirmar presença.
- [ ] A chave aparece no `<footer>`.
