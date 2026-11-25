---
name: vanilla-dom-ui
description: Diretrizes de interface web responsiva em HTML5, CSS3 e JavaScript puro (Vanilla JS) para o Projeto #30 (Jukebox e Playlists Colaborativas de Links), sem frameworks de UI.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Escopo de Aplicação
Esta skill orienta o **Agente 2 (Especialista em Interface Web Vanilla)** na construção de `public/index.html`, `public/styles.css` e `public/app.js` da subpasta `P26-2B-0018-0402-94DD-FCB7/`.

## Regras Obrigatórias

1. **Zero Frameworks ou Bibliotecas Externas de UI:**
   - Proibido React, Vue, Angular, Svelte, Solid, Tailwind CDN, jQuery ou similares.
   - Toda renderização, estado e atualização visual deve utilizar exclusivamente APIs nativas do navegador (`document.createElement`, `textContent`, `dataset`, `fetch`, `URLSearchParams`, `getBoundingClientRect`).

2. **Prevenção Estrita de XSS no DOM:**
   - Nunca injetar dados vindos do usuário ou da API via `innerHTML`.
   - Construir elementos com `document.createElement` e atribuir textos exclusivamente com `textContent`.
   - Validar URLs externas antes de atribuir a `href` ou `iframe.src` (apenas `https://` confiáveis retornados pelo servidor).

3. **Tipografia Limpa e Acessível (ZERO Sombras em Texto):**
   - Nunca utilizar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto.
   - Garantir contraste elevado (WCAG AA+), hierarquia tipográfica clara, foco visível de teclado (`:focus-visible`) e atributos ARIA (`aria-live`, `aria-pressed`, `aria-label`).

4. **Funcionalidades da Experiência Jukebox Colaborativa:**
   - **Cabeçalho de Sessão Discord:** Exibir botão "Entrar com Discord" quando desconectado, ou avatar, nome de usuário, `user_id` e botão "Sair" quando autenticado.
   - **Salas Temáticas:** Sidebar/lista de salas com busca, criação de nova sala temática (nome, descrição, tema), contagem de faixas e votos.
   - **Submissão de Faixas:** Formulário com detecção visual imediata do provedor (YouTube, Spotify, SoundCloud), título, artista (opcional) e gênero musical.
   - **Reordenação Dinâmica por Saldo de Votos:** Ao votar positivamente (`+1`) ou negativamente (`-1`), atualizar o saldo a partir da resposta do servidor e reordenar os itens da fila dinamicamente no DOM com animação FLIP suave (`getBoundingClientRect` + `transform`).
   - **Destaque no Topo da Sala:** Evidenciar visualmente as faixas mais aprovadas pelo grupo (badge `#1 Mais Aprovada`, pódio visual top 3 e palco de reprodução com player embarcado seguro sob demanda para YouTube/Spotify/SoundCloud).
   - **Filtros e Responsividade:** Filtro por gênero musical dentro da sala e layout fluido para desktop, tablet e mobile.

5. **Rastreabilidade Oficial no Rodapé:**
   - O elemento `<footer>` de `public/index.html` deve exibir explicitamente a Chave Única `P26-2B-0018-0402-94DD-FCB7`, a turma `2B` e a indicação de licença MIT.
