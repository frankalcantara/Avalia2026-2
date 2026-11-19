---
name: teste-validacao
description: Testar e validar o projeto Rastreador de Hábitos — testes unitários das métricas, testes de API com D1 simulado, auditoria de segurança e checklist de requisitos da rubrica. Use para verificar entregas dos demais agentes e antes de qualquer deploy.
---

# Skill: Teste e validação

## Quando usar
Depois de qualquer mudança em `functions/`, `lib/`, `migrations/` ou `public/`, e antes do deploy/entrega.

## Comandos
```bash
npm test                      # equivale a: node --test "tests/**/*.test.mjs"
node --check public/app.js    # sintaxe do cliente
```
Requer Node ≥ 22.13 (os testes usam `node:sqlite` como D1 simulado em `tests/helpers/fake-d1.mjs`).

## O que a suíte cobre
- `tests/stats.test.mjs` — datas válidas, bissexto, fuso, streak atual/máximo, virada de mês/ano, duplicatas, datas futuras, taxa mensal (mês corrente, passado, futuro), consolidação.
- `tests/api.test.mjs` — fluxo OAuth completo (state, upsert, avatar padrão, falha do Discord), sessão adulterada/expirada, CSRF por `Origin`, validações (nome, cor, JSON, content-type, data, `done`, futuro), isolamento entre usuários, duplicidade e limite, cascata na exclusão, métricas devolvidas pelo servidor.

## Regras para o agente validador
1. **Não corrija o código-fonte.** Reproduza, descreva (arquivo, linha, passos, esperado × obtido) e devolva ao agente dono. Pode criar/alterar apenas arquivos em `tests/`.
2. Todo bug encontrado vira um teste que falha antes da correção e passa depois.
3. Nunca afirme que algo "funciona" sem ter executado o comando e lido a saída.
4. Teste datas de fronteira: 1º dia do mês, último dia, 29/02, virada de ano, fuso (23:30 em São Paulo = dia seguinte em UTC).

## Auditoria de segurança (rápida)
- [ ] SQL sempre parametrizado (`grep -n "prepare(" functions lib`).
- [ ] Rotas de hábito filtram por `user_id`.
- [ ] Mutações exigem `Origin` igual; corpo JSON validado.
- [ ] Cookie `HttpOnly; SameSite=Lax; Secure` (em HTTPS).
- [ ] Nenhum segredo versionado (`grep -rniE "client_secret|session_secret" --exclude-dir=node_modules .` só deve achar nomes de variáveis).
- [ ] `public/app.js` sem `innerHTML` com dados do servidor.

## Checklist da rubrica (validar manualmente no deploy)
- [ ] URL pública em `*.pages.dev` abre por HTTPS sem erros no console.
- [ ] Login com Discord funciona e mostra nome + avatar.
- [ ] Criar hábito, marcar dias, ver barras e indicadores mudarem na hora; recarregar mantém os dados (D1).
- [ ] Trocar de mês funciona; dias futuros ficam desabilitados.
- [ ] Chave `P26-2C-7195-ACC2-3B49-1AE1` no rodapé da interface **e** no `README.md`.
- [ ] `LICENSE` MIT, repositório público, `AGENTS.md` e `skills/` presentes.
- [ ] `GET /api/status` devolve `db: "ok"`.

## Formato do relatório
Tabela: `#`, severidade (bloqueante/alta/média/baixa), onde, descrição, como reproduzir, status. Termine com o resultado de `npm test` (total, passou, falhou).
