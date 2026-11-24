---
name: vanilla-dom-ui
description: Padrões para a interface em HTML5, CSS3 e JavaScript puro (sem frameworks), com manipulação direta do DOM, responsividade e acessibilidade. Use ao criar ou alterar arquivos em public/.
---

# Skill: Interface Web em HTML5, CSS3 e Vanilla JS

## Restrições
1. **Zero frameworks e bibliotecas de UI.** Nada de React, Vue, Angular, Svelte, jQuery, Tailwind via CDN etc. Nenhuma dependência no `package.json` além do `wrangler` (ferramenta de deploy).
2. **Sem `innerHTML` com dados do usuário.** Criar nós com `document.createElement` e preencher com `textContent` (evita XSS).
3. **Compatível com a CSP de `public/_headers`:** sem `<script>` ou `style=""` inline; estilos dinâmicos via `element.style.setProperty("--var", valor)`.
4. **Chave Única no `<footer>`:** `P26-2A-3195-12EC-5382-8226` deve aparecer dentro do elemento `<footer>` do `index.html`.

## Padrões
- Um único estado em memória (`state`) e funções `renderX()` que redesenham a partir dele.
- Delegação de eventos no `<tbody>` da grade (um listener para todas as caixas).
- **Atualização otimista:** ao marcar uma caixa, a barra de progresso CSS e os indicadores mudam na hora; em seguida a resposta do servidor substitui os números pelos oficiais. Em erro, desfazer e avisar.
- Barra de progresso: `<div class="bar"><span></span></div>`, largura via variável CSS `--p` com `transition`.
- Diálogos com `<dialog>` nativo; nada de `alert()`/`confirm()`.

## Responsividade e acessibilidade
- Grade com rolagem horizontal e primeira coluna fixa (`position: sticky`) no celular.
- Indicadores em 4 colunas no desktop, 2 no celular.
- Toda caixa de seleção tem `aria-label` com hábito e dia; barra com `role="progressbar"` e `aria-valuenow`.
- Foco visível (`:focus-visible`) e `prefers-reduced-motion` respeitado.

## Checklist
- [ ] Testado em 1366 px e 390 px de largura.
- [ ] Sem erros no console.
- [ ] Dias futuros desabilitados; dia de hoje destacado.
