---
name: teste-validacao
description: Protocolo do agente de teste e validação: segurança do servidor, integridade no D1, interface e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist
1. **Isolamento:** todos os arquivos do projeto estão dentro de `P26-2A-A9AC-2CD1-5F84-AC20/`.
2. **Backend:** `node tests/backend.test.mjs` passa. Cobre login simulado, CRUD, valores inválidos (0, negativo, texto, vírgulas erradas), data inexistente, categoria fora do tipo, descrição longa, origem externa (403), usuário sem sessão (401), dado de outro usuário (404) e sessão expirada.
3. **Interface:** `node tests/ui.test.mjs` passa. Cobre formulário, troca de categorias por tipo, saldo, gráfico (percentuais), filtros, edição, exclusão e logout.
4. **Rubrica:** conferir os 5 critérios (deploy, D1 + Discord, vanilla, agentes e skills, repositório público com MIT, chave no README e no rodapé).
5. **Entrega:** `node validar-local.mjs P26-2A-A9AC-2CD1-5F84-AC20` na raiz do repositório.
6. **Manual no site publicado:** login, criar, editar, excluir, filtrar e sair.
