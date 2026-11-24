---
name: validacao-quiz
description: Checklist de validação anti-manipulação e de UX para o Quiz Competitivo Temporizado (Cloudflare Pages Functions + D1 + Discord OAuth2). Use ao testar backend ou frontend do projeto.
---

# Validação do Quiz Competitivo Temporizado

Chave Única: `P26-2B-4459-132C-62BC-7492`

## Princípios
- O relógio oficial é o do servidor (`sent_at`/`answered_at` no D1). Nada vindo do cliente define tempo, pontos ou resultado.
- O JSON da pergunta nunca contém o gabarito. `correctIndex` só aparece depois de a pergunta ser encerrada com `correct`/`wrong`, e na revisão final.
- Você testa e relata. Não corrige código de produção.

## Backend (npm test)
1. Rotas protegidas devolvem 401 sem sessão; cookie forjado → 401.
2. POST sem `Origin` igual ao do site → 403 (CSRF).
3. Entradas inválidas (`choice` fora de 0–3, `quizId` malformado, JSON inválido) → 400.
4. Payload da pergunta não contém `correct`/`answer`/`gabarito`.
5. Pontuação: 1000 instantânea, 100 no limite, monotônica decrescente, 0 para erro.
6. Resposta após `limite + GRACE_MS` → 408, 0 ponto, sem revelar o gabarito.
7. Duplo envio e envios concorrentes: apenas um é gravado.
8. Pergunta não entregue não pode ser respondida (`not_sent`).
9. Isolamento entre usuários (404 para quiz alheio).
10. Recarregar não reinicia o cronômetro.
11. OAuth2: `state` validado e descartado; Discord recusando o code não cria sessão.

## Frontend (Playwright, API simulada)
1. Sem `innerHTML` com dados do servidor; payloads com `<img onerror>` não executam.
2. Barra `role=progressbar` regressiva e botões desabilitados após responder; um único POST por pergunta.
3. Tempo visual esgotado envia `choice:null` automaticamente.
4. Rodapé com a Chave Única em todas as telas.
5. Sem rolagem horizontal em 320 px; sem erros de console; sem requisições externas além de `cdn.discordapp.com`.

## Relatório
Tabela PASS/FAIL, com arquivo e linha de cada falha e a causa provável.
