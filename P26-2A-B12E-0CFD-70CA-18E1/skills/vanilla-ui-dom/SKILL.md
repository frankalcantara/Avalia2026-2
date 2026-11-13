---
name: vanilla-ui-dom
description: >
  Constrói e revisa a interface com HTML5 semântico, CSS3 e JavaScript puro,
  sem frameworks nem build. Use ao criar telas, formulários, roteamento por
  hash, estados de erro/carregamento, acessibilidade ou a verificação da ata
  no navegador.
license: MIT
---

# Interface vanilla (HTML5 + CSS3 + DOM)

Skill do Agente 2 (Interface Web). O frontend é estático em `public/` e fala
com as Pages Functions por `fetch` same-origin. Nenhuma dependência de UI,
nenhum bundler, nenhum `innerHTML` com dado de usuário.

## Arquivos e papéis

| Arquivo | Papel |
|---|---|
| `public/index.html` | shell semântico: header, `main#app`, footer com a chave, toast |
| `public/styles.css` | design tokens, layout responsivo, tema claro/escuro, impressão |
| `public/app.js` | estado, API, roteador por hash e três telas |
| `public/auditoria.js` | SHA-256 + JSON canônico + replay no navegador |
| `public/favicon.svg` | ícone local (CSP `img-src 'self'`) |

## Roteamento

- `#/` início: criar sala, abrir sala, consultar ata, minhas salas, últimas atas.
- `#/sala/CODE` sala: participantes, entrar/sair, painel do organizador,
  configurações, sorteio e histórico de atas.
- `#/ata/CODE` ata pública: resultado, integridade, verificação e snapshot.
- Query `?sala=CODE`, `?ata=CODE`, `?login=success` e `?auth_error=...` é
  convertida em hash com `history.replaceState` no boot (o servidor não vê hash).

## Segurança no DOM

- **Nunca** use `innerHTML`/`insertAdjacentHTML` com nome de participante,
  título de sala ou mensagem da API. O helper `el(tag, props, ...filhos)` usa
  `textContent` e `append`.
- Links externos levam `rel="noopener noreferrer"`.
- Avatar só de `https://cdn.discordapp.com` (já liberado na CSP).
- `fetch` sempre com `credentials: "same-origin"` e `Accept: application/json`.
- Em 401, ofereça login; em 403/409, mostre a mensagem do servidor.
- Nada de segredo, token ou hash de sessão no JS público.

## UX e acessibilidade

- HTML semântico: `header`, `nav`, `main`, `section`, `form`, `label for`,
  `button type="button"` fora de formulário.
- Foco visível (`:focus-visible`), `aria-live` para toast e verificação,
  `aria-current="page"` no breadcrumb.
- Estados explícitos: carregando (spinner + `aria-busy`), vazio (texto útil),
  erro (título + saída), sucesso (toast).
- Formulários com validação local amigável; o servidor continua sendo a
  autoridade. Desabilite o botão durante o envio e restaure no `finally`.
- Não dependa só de cor: badges têm texto (“Manual”, “Discord”, “Equipes”).
- Respeite `prefers-reduced-motion` e `prefers-color-scheme`.
- Layout responsivo em 900 px e 640 px; tabelas/listas quebram sem overflow.
- A ata tem `@media print` para virar documento entregável.

## Verificação da ata no cliente

`public/auditoria.js` precisa ser autossuficiente:

1. remover do objeto apenas `auditHash`, `prevDrawCode`, `entries` e
   `verificationUrl` (campos que a API adiciona fora do payload);
2. `canonicalJson` ordenar chaves recursivamente e ignorar `undefined`;
3. `crypto.subtle.digest("SHA-256", TextEncoder.encode(json))`;
4. reaplicar `swaps` e comparar com `result.order` ou `groups`;
5. devolver `{ hashConfere, replayConfere, hashCalculado }`.

Se `crypto.subtle` não existir (HTTP fora de localhost), mostre uma mensagem
clara — nunca “finja” que verificou.

## Checklist de aceite

- [ ] zero frameworks, zero dependências, zero build step
- [ ] console do navegador sem erros em `#/`, `#/sala/CODE` e `#/ata/CODE`
- [ ] criar sala, adicionar nomes, editar, sortear e verificar funcionam na UI
- [ ] nome `<img src=x onerror=alert(1)>` aparece como texto
- [ ] teclado: tabs alcançam todos os controles; Enter envia formulários
- [ ] Lighthouse: acessibilidade 100, boas práticas 100 (medido em 08/11/2026)
- [ ] rodapé exibe `P26-2A-B12E-0CFD-70CA-18E1`
- [ ] layout legível em 360 px de largura

## Comandos úteis

```powershell
npx.cmd --yes wrangler@latest pages dev public --port 8788
# abra http://127.0.0.1:8788/ e teste as três rotas
```

Sem framework, sem etapa de build: o arquivo salvo é o arquivo servido.
