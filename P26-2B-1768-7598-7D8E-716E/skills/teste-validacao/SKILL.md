---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** todos os arquivos do projeto ficam dentro de `P26-2B-1768-7598-7D8E-716E/`.
2. **Teste Anti-Manipulação:** chamadas `POST` para `/api/*` rejeitam payloads inválidos ou sem autenticação com `400`, `401`, `403`, `404` ou `409`.
3. **Conformidade de Entrega:** executar `node validar-local.mjs P26-2B-1768-7598-7D8E-716E` na raiz do repositório `Avalia2026-2` (fora da subpasta) e registrar o resultado real.

## Regras do jogo (API)
- Navio fora da malha, sobreposto, repetido, faltando ou com orientação diferente de "H"/"V" deve dar 400.
- Tiro com coordenada negativa, maior que 9, decimal ou texto deve dar 400.
- Tiro repetido na mesma célula deve dar 409. Tiro antes de posicionar ou depois do fim deve dar 409.

## Segurança
- Sem cookie `sid`, rotas protegidas dão 401. Cookie inventado também.
- `gameId` de outro jogador deve dar 404.
- Corpo que não é JSON deve dar 400.
- SQL injection nos campos (`' OR 1=1 --`) não pode gerar 500 nem alterar resultado.
- Nenhuma resposta, em nenhum momento, pode conter `enemy_fleet` nem a posição dos navios inimigos.

## OAuth2 e placar
- Callback sem `code`, sem `state` ou com `state` diferente do cookie deve dar 400.
- Vitória soma 1 em `wins` e derrota soma 1 em `losses`, uma vez por partida.

## Interface
- Fluxo completo: login, posicionar, atirar até o fim, ver o placar.
- Tela de 360px sem rolagem horizontal, navegação por teclado, console sem erros.

## Rubrica (100 pontos)
- [ ] Deploy público em HTTPS funcionando (25)
- [ ] Discord OAuth2, D1 e validação no servidor (25)
- [ ] Interface em HTML, CSS e JS puro (15)
- [ ] 3 agentes, 1 de teste, `AGENTS.md` e skills no repositório (25)
- [ ] Repositório público, LICENSE MIT, chave no README e no rodapé (10)

## Regra de honestidade
Só marcar um item como aprovado se o teste foi realmente executado. O que não pôde ser executado deve constar no relatório como tal.