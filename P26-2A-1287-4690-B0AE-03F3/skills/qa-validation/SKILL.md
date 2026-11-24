---
name: qa-validation
description: Procedimento de teste e validação do Kudos Board (regras de negócio, segurança, conformidade com a rubrica). Use ao escrever testes em tests/ ou revisar o projeto.
---

# QA e Validação

## Procedimento
1. Ler `docs/API.md` (o contrato) e comparar com o código real em `functions/` e `public/`.
2. Testes automatizados com `node --test`, usando D1 simulado sobre `node:sqlite` (`tests/helpers/fake-d1.js`), chamando os handlers diretamente com `Request`.
3. Casos obrigatórios:
   - Kudo para o próprio ID é rejeitado (400), inclusive via CHECK do banco.
   - Sem sessão → 401; sessão expirada → 401.
   - Selo inválido, mensagem vazia, mensagem > 280 → 400.
   - Remetente forjado no body é ignorado.
   - Destinatário inexistente → 404.
   - Filtros `received`/`sent` por usuário retornam somente o esperado.
   - OAuth: `state` inválido/reutilizado/expirado é rejeitado.
   - Texto com `<script>` é guardado como texto puro.
4. Verificação estática: nenhum `innerHTML` com dados dinâmicos, nenhum framework, chave `P26-2A-1287-4690-B0AE-03F3` presente no rodapé e no README, LICENSE MIT presente.
5. Reportar falhas ao agente responsável com arquivo, linha e correção sugerida.
