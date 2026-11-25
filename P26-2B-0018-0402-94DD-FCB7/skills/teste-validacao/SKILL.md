---
name: teste-validacao
description: Protocolo obrigatório do Agente de Teste, Auditoria de Segurança e Validação para verificar regras de negócio no servidor, integridade do D1, segurança anti-manipulação, conformidade visual e rubrica de 100 pontos.
---

# Skill: Agente de Teste, Segurança e Validação

## Escopo de Aplicação
Esta skill orienta o **Agente 3 (Engenheiro de Testes, Auditoria de Segurança e Validação)** — agente obrigatório pela rubrica (25 pontos) — para auditar e testar integralmente a entrega em `P26-2B-0018-0402-94DD-FCB7/`.

## Protocolo de Verificação Obrigatória

1. **Testes Automatizados de Unidade e Integração com SQLite Real:**
   - Criar e executar suíte automatizada em `tests/run-tests.mjs` usando `node:test`, `node:assert/strict` e um adaptador compatível com a interface do Cloudflare D1 apoiado em `node:sqlite` (`DatabaseSync(':memory:')`) aplicando a migração real `migrations/0001_init.sql`.
   - Garantir execução com zero dependências externas (`node tests/run-tests.mjs`).

2. **Bateria Anti-Manipulação e Segurança na Borda:**
   - Confirmar rejeição (`401`) de `POST /api/rooms`, `POST /api/rooms/:id/tracks`, `POST /api/tracks/:id/vote`, `DELETE /api/tracks/:id` e `DELETE /api/rooms/:id` sem cookie de sessão válido ou com token forjado/expirado.
   - Confirmar rejeição (`403`) quando um usuário tenta remover sala ou faixa pertencente a outro autor.
   - Confirmar rejeição (`400`) de links fora de YouTube/Spotify/SoundCloud e payloads com `javascript:`, `data:`, `http://` ou campos vazios/excessivos.
   - Confirmar rejeição (`409`) de link duplicado (inclusive variações equivalentes de URL, como `youtu.be/<id>` vs `youtube.com/watch?v=<id>`) na mesma sala.
   - Confirmar proteção contra SQL Injection em nomes de salas, gêneros, URLs e parâmetros de busca.

3. **Validação das Regras de Votação e Reordenação:**
   - Confirmar voto positivo (`+1`), voto negativo (`-1`), troca de voto (`+1` → `-1`), remoção de voto (`0`) e unicidade por `(track_id, user_id)` no D1.
   - Confirmar que a ordenação retornada pelo servidor e replicada no cliente coloca as faixas com maior saldo no topo da sala.

4. **Auditoria de Frontend Vanilla e Conformidade de Rubrica:**
   - Verificar ausência de frameworks proibidos (`react`, `vue`, `angular`, `svelte`, etc.) e ausência de `innerHTML` com dados dinâmicos.
   - Verificar ausência de `text-shadow` e `filter: drop-shadow` em textos no CSS.
   - Verificar presença da Chave Única `P26-2B-0018-0402-94DD-FCB7` em `README.md` e dentro de `<footer>` em `public/index.html`.
   - Verificar existência de `LICENSE` (MIT), `AGENTS.md` (mínimo 3 agentes + harness) e `skills/*/SKILL.md`.
   - Executar `node validar-local.mjs P26-2B-0018-0402-94DD-FCB7` na raiz do repositório e registrar todos os resultados no relatório de validação em `AGENTS.md`.
