---
name: teste-validacao
description: Teste e validação independente (segurança, regras de negócio e rubrica) da plataforma de empréstimo e troca de livros.
---

# Skill: Teste, Auditoria e Validação

## Regras
1. O agente NÃO escreve nem corrige código de funcionalidade. Ele testa e reporta; o agente dono do arquivo corrige.
2. Cada resultado precisa de evidência (comando, resposta HTTP ou captura), nunca "validado" sem execução.

## Casos de ataque
1. Rota protegida sem login: deve retornar 401.
2. Cookie `session` alterado ou forjado: 401.
3. Callback OAuth com `state` inválido ou ausente: recusado.
4. Pedir o próprio livro: erro.
5. Pedir livro Reservado ou Emprestado: erro 409.
6. Dois pedidos simultâneos para o mesmo livro: só um é aceito.
7. Usuário B aprovando, recusando ou devolvendo pedido de livro do usuário A: 403.
8. Cadastrar livro com `dono_id` falso no corpo: ignorado, vale o da sessão.
9. Data de devolução no passado, inválida ou além de 90 dias: recusada.
10. Título com `<script>` ou `<img onerror>`: não pode executar na tela.
11. Procurar frameworks, CDN ou links externos no frontend.
12. Chave P26-3A-5053-EAAE-A024-A246 presente no README.md e no rodapé; LICENSE MIT presente.
13. Rodar `node validar-local.mjs P26-3A-5053-EAAE-A024-A246`.