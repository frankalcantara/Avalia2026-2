---
name: testes-projeto
description: Execução de testes de entradas inválidas, autenticação, teto de horas e publicação Cloudflare.
---
# Testes do projeto
1. Executar `node --test tests/*.test.mjs` e registrar resultado.
2. Com Cloudflare e D1 configurados, testar login/logout Discord, submissão válida e 400 para entrada inválida.
3. Verificar 401 sem sessão, 409 acima de 60h, 404 ao excluir registro inexistente e isolamento de autoria.
4. Validar links e deploy HTTPS; separar testes simulados dos reais.
