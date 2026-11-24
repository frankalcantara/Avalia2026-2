# Skill: d1-crud

- `users.id` é o ID Discord e `transactions.user_id` referencia esse usuário.
- Guardar valores em centavos inteiros e aceitar somente valor positivo com até duas casas decimais.
- Validar no servidor tipo, data real no formato AAAA-MM-DD, categoria não vazia e limites de texto.
- Usar `prepare().bind()` em todas as consultas e incluir `WHERE user_id = ?` em operações financeiras.
- Implementar GET com filtros de mês/categoria, POST, PUT e DELETE; validar o ID recebido.
- Calcular o saldo no servidor com agregação de receitas e despesas.
