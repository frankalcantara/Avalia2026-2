# Testes de validação

| Teste | Esperado | Resultado obtido |
|---|---|---|
| POST /api/rolagem sem login | 401 | (preencha) |
| POST /api/rolagem com dado "d100" | 400 | (preencha) |
| POST /api/rolagem com ficha_id inexistente | 404 | (preencha) |
| POST /api/rolagem com resultado forjado (resultado:20, total:99) | campos ignorados, resultado aleatório | (preencha) |
| Excluir ficha de outro jogador | 404 | (preencha) |
| Log da mesa mostra rolagens de dois jogadores | sim | (preencha) |