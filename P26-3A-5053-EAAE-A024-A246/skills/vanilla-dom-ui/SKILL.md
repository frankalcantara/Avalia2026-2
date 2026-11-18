---
name: vanilla-dom-ui
description: Interface web responsiva em HTML5, CSS3 e JavaScript puro para a plataforma de empréstimo e troca de livros.
---

# Skill: Interface Vanilla (HTML5 + CSS3 + JS puro)

## Regras obrigatórias
1. Sem frameworks e sem bibliotecas externas. Sem CDN de scripts, fontes ou ícones.
2. Dados vindos do servidor ou do usuário entram no DOM com `textContent` ou `createElement`, nunca `innerHTML`.
3. Responsivo (mobile first) com Flexbox/Grid e media queries.
4. HTML semântico, labels nos campos, foco visível, contraste adequado.
5. O cliente nunca decide regra de negócio: apenas exibe e chama a API. Erros do servidor aparecem em mensagens (toast).
6. Rodapé obrigatório com a Chave Única: P26-3A-5053-EAAE-A024-A246.

## Telas
- Cabeçalho: botão "Entrar com Discord" (link para `/api/auth/discord`) ou avatar + nome + "Sair" (POST `/api/auth/logout`).
- Catálogo: busca e filtro por status e categoria; cards com badge de status; botão "Solicitar empréstimo" só em livros Disponíveis de outros donos; mostra o handle do dono.
- Meus livros: formulário de cadastro (título, autor, categoria, modalidade), lista com editar/excluir.
- Painel de pedidos: como dono (pendentes com campo de data de devolução e Aprovar/Recusar; emprestados com "Marcar devolvido" e handle do solicitante) e como solicitante (meus pedidos, cancelar).

## Arquivos permitidos
Somente `public/index.html`, `public/styles.css`, `public/app.js`. Consumir o contrato de `docs/API.md`.