---
name: orquestracao-contrato
description: Protocolo do agente orquestrador — transforma o enunciado em esquema D1 + contrato de API, divide o trabalho entre agentes especialistas com escopos de arquivo disjuntos, integra os resultados e só declara pronto depois do agente de teste. Use no início do projeto e a cada rodada de integração.
---

# Skill: Orquestração por Contrato

Usada pelo **Agente 1 (Orquestrador)**.

## 1. Do enunciado ao contrato (antes de qualquer código)
1. Extrair do enunciado cada requisito verificável e anotar a rota ou tela
   que o atende. Requisito sem destino = lacuna a resolver agora.
2. Escrever o esquema em `migrations/` primeiro: tipos, `CHECK`s e índices
   que tornam regras de negócio impossíveis de violar no banco.
3. Escrever `docs/CONTRATO-API.md`: cada rota com método, autenticação,
   entrada, saída de sucesso e **todos** os códigos de erro com `error`.
   O contrato é o único canal entre backend e frontend.

## 2. Delegação
- Cada agente recebe: os arquivos que pode tocar (escopos disjuntos — dois
  agentes nunca escrevem no mesmo arquivo), a skill que deve seguir, o
  contrato e a definição de "pronto" com a verificação que ele mesmo deve
  rodar.
- Backend e frontend rodam em paralelo; o teste roda depois da integração.
- O briefing descreve fatos verificáveis; pré-condições ("o banco já está
  migrado") são marcadas como algo a conferir, não como garantia.

## 3. Integração
1. Ler o relatório de cada agente e conferir o resultado no disco (diff),
   não só o relatório.
2. Divergência entre implementação e contrato: decidir quem está certo,
   corrigir o lado errado (ou o contrato) e registrar a decisão.
3. Encaminhar ao agente de teste com o mesmo contrato.

## 4. Pronto significa
- Relatório do agente de teste sem falhas abertas (ou falhas corrigidas e
  retestadas).
- `node validar-local.mjs <CHAVE>` sem pendências além das que dependem do
  deploy (URL online).
- `AGENTS.md` atualizado com o que cada agente realmente fez.
