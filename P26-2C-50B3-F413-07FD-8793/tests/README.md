# Testes (Agente de Teste e Validação)

Rodam as Cloudflare Functions **reais** contra um D1 simulado (`node:sqlite`, Node 22+).
Não precisam de Cloudflare nem de Discord.

```
node tests/api.test.mjs     # regras de negócio do servidor (sem dependências)
node tests/ui.test.mjs      # interface no Chromium; exige: npm i playwright
```

`api.test.mjs` verifica: 401 sem sessão e com cookie forjado/antigo; `start` devolve só IDs opacos;
3ª carta virada é recusada (409); `check` sem cartas viradas (409); jogo de outro usuário (404);
contagem de movimentos; eficiência = pares ÷ movimentos × 100; carta já combinada e partida encerrada (409);
nova partida abandona a anterior; ranking; logout.

`ui.test.mjs` joga uma partida inteira no navegador (desktop e celular 375 px), confere que nenhum
conteúdo de carta existe no DOM antes de virar, que não há overflow horizontal nem erros de console,
e salva capturas de tela em `tests/shots/`.
