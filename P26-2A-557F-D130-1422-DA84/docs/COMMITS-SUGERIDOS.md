# Sequência de commits sugerida

Commits pequenos e descritivos mostram a evolução do trabalho e o uso dos agentes.
Faça o último commit **antes** de abrir (ou atualizar) o Pull Request.

1. `docs: README com chave única e LICENSE MIT`
2. `db: esquema D1 (users, lists, list_members, tasks)`
3. `backend: sessão assinada e helpers de validação (lib/util.js)`
4. `backend: login com Discord OAuth2 (login, callback, logout, me)`
5. `backend: listas, entrada por código e tarefas com validação de membro`
6. `frontend: estrutura HTML, estilos e rodapé com a chave`
7. `frontend: telas de login, listas e tarefas em JS puro`
8. `agentes: backend, frontend e testador + skills`
9. `testador: relatório de validação em docs/evidencias`
10. `docs: AGENTES.md com harness, modelo e evidências`
11. `fix: ajustes apontados pelo testador`
