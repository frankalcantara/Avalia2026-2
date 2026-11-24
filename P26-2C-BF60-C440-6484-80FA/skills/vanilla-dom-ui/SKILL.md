---
name: vanilla-dom-ui
description: Padrões para construir a interface em HTML5 semântico, CSS3 e JavaScript puro (sem frameworks) consumindo a API do projeto via fetch. Use ao criar ou alterar qualquer arquivo em public/.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Vanilla

## Antes de escrever código
1. Leia `docs/API.md`: formatos de `Book`, `Request`, `UserPublic` e os códigos de erro. A interface nunca decide regra de negócio — ela só mostra o que o servidor permite e exibe o `message` dos erros.
2. Arquivos: `public/index.html`, `public/styles.css`, `public/app.js` (ES module, `<script type="module">`). Pode dividir o JS em módulos em `public/js/`.

## Regras obrigatórias
1. **Zero frameworks/bibliotecas:** nada de React, Vue, Angular, Svelte, jQuery, Tailwind, Bootstrap ou CDN de UI. Só APIs nativas do DOM (`document.createElement`, `template`, `addEventListener`, `fetch`, `<dialog>`).
2. **Segurança no DOM:** todo texto vindo da API entra via `textContent` ou atributos — nunca `innerHTML` com dados do usuário.
3. **Rodapé obrigatório:** `<footer>` com a Chave Única `P26-2C-BF60-C440-6484-80FA` visível em texto no HTML estático (o validador lê o HTML sem executar JS).
4. **Login exclusivo via Discord:** o botão é um link para `/api/auth/discord`. Mostrar avatar, nome e `@username` do usuário logado (de `/api/me`).
5. **Tipografia limpa:** sem `text-shadow` nem `drop-shadow` em texto. Hierarquia por peso, tamanho e cor.
6. **Responsivo:** mobile-first, funciona a 360px sem rolagem horizontal; grid de cartões com `repeat(auto-fill, minmax(…))`. Use variáveis CSS em `:root` e respeite `prefers-color-scheme`.
7. **Acessível:** elementos semânticos (`header`, `nav`, `main`, `section`, `footer`), `label` em todo campo, foco visível, `aria-live` para mensagens, botões reais para ações.
8. **Estados de interface:** carregando, vazio, erro e sucesso para cada lista e ação; desabilitar o botão enquanto a requisição está em voo.
9. **fetch padronizado:** um helper `api(path, {method, body})` que envia `credentials: 'same-origin'`, `Content-Type: application/json` quando há corpo, e lança o `message` do erro.
10. **Status como pílula colorida:** `Disponível` (verde), `Reservado` (âmbar), `Emprestado` (vermelho/azul) — cor + texto, nunca só cor.

## Verificação rápida
- Abrir `http://localhost:8788` com `wrangler pages dev`, testar deslogado (catálogo visível, ações pedem login) e logado.
- Largura de 360px sem barra horizontal; teclado navega por todas as ações.
