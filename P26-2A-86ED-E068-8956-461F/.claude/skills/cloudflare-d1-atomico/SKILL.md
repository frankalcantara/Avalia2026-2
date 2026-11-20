---
name: cloudflare-d1-atomico
description: Padrões para Cloudflare Pages Functions com D1: consultas parametrizadas, batch transacional e contadores atômicos (ex.: decrementar vagas sem condição de corrida).
---

# Cloudflare D1 e operações atômicas

## Quando usar
Ao criar tabelas, endpoints de leitura/escrita ou qualquer contador compartilhado no D1.

## Regras
1. Sempre usar `env.DB.prepare(sql).bind(...)`. Nunca concatenar entrada do usuário no SQL.
2. `env.DB.batch([...])` executa os comandos em uma única transação: se um falhar, todos são desfeitos.
3. Contador atômico: não faça "ler, calcular, gravar". Faça `UPDATE tabela SET contador = contador - 1` dentro de um batch, junto com o INSERT que registra a ação.
4. Deixe o banco recusar estados inválidos com `CHECK (contador >= 0)` e `UNIQUE (...)`. Capture a falha e traduza para uma resposta HTTP 409.
5. Pré-validações (existe? é do usuário? já reservou?) servem para mensagens amigáveis. A garantia final vem das restrições do banco.
6. Em cancelamentos, condicione o UPDATE a `EXISTS (...)` da reserva e rode antes do DELETE, para que cliques duplos não devolvam vagas em excesso.

## Exemplo (reserva)
Batch com `INSERT INTO reservas ...` seguido de `UPDATE rotas SET vagas_livres = vagas_livres - 1 WHERE id = ?`. Com `CHECK (vagas_livres >= 0)`, a última vaga só pode ser tomada por uma requisição. A outra falha e recebe 409.
