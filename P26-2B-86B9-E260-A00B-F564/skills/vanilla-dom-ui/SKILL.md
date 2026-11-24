---
name: vanilla-dom-ui
description: Padrões para interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras obrigatórias

1. **Zero frameworks de UI:** proibido React, Vue, Angular, Svelte, Solid, Next, Nuxt ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Sem dependências de CDN para UI:** nenhum script de framework via `unpkg`, `jsdelivr` ou `esm.sh`.
3. **Conteúdo dinâmico seguro:** inserir dados vindos da API com `textContent` ou `createElement`. Evitar `innerHTML` com dados do servidor para prevenir XSS.
4. **Semântica HTML5:** usar `header`, `main`, `section`, `article`, `fieldset`, `legend`, `footer`, `label` associado ao campo e `aria-live` para feedback.
5. **Tipografia limpa:** não aplicar `text-shadow` em textos; usar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólido.
6. **Responsividade:** layout fluido com `max-width`, `flex-wrap`, `grid` e breakpoint em `max-width: 640px`.
7. **Feedback de estado:** exibir carregamento, erros de rede, erros de validação do servidor e confirmação de ações (toast ou mensagem `role="status"`).
8. **Rastreabilidade no rodapé:** exibir obrigatoriamente a Chave Única `P26-2B-86B9-E260-A00B-F564` no elemento `<footer>`.

## Fluxos esperados

- Cabeçalho com avatar, nome e `user_id` do Discord quando autenticado; botão de login quando anônimo.
- Formulário de criação: título, descrição, prazo (`datetime-local`), opções dinâmicas (mínimo 2, máximo 10) e mensagens de erro.
- Lista de enquetes com status Aberta/Encerrada, total de votos e barras horizontais proporcionais.
- Após votar, atualizar a interface com os dados consolidados retornados pelo servidor.
- Desabilitar ações incompatíveis: voto duplicado, enquete encerrada e criação sem login.

## Anti-padrões proibidos

- Manipular estado global sem refletir no DOM de forma acessível.
- Confiar apenas na validação do formulário e remover a checagem do servidor.
- Usar `innerHTML` para conteúdo de usuário.
- Ocultar a Chave Única do rodapé.
