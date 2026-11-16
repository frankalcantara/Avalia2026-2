---
name: design-visual
description: Sistema de design "Placar & Boletim" do Simulador de Médias — direção visual inspirada em placar esportivo e boletim escolar impresso, regras contra a estética genérica de IA, tokens, componentes e restrições técnicas (CSS puro, CSP, acessibilidade).
---

# Skill: Design Visual — "Placar & Boletim"

## Por que esta direção
A primeira versão foi rejeitada pelo estudante por parecer **"design genérico de IA"**: índigo/violeta com degradê, cartões muito arredondados em tudo, sombras suaves, desfoque de vidro, landing com cartões flutuantes. A nova identidade parte do **tema do produto**: o aluno está num jogo contra a meta. O app é um **placar** (número atual × meta, quanto falta, onde você está na tabela) impresso num **boletim** (papel, réguas, carimbos de situação).

## Proibido (estética genérica)
- Índigo, violeta, roxo-azulado como cor de marca; **degradês** de qualquer tipo em fundos, botões ou textos.
- `backdrop-filter`/vidro, brilhos, sombras difusas grandes, cartões flutuando sobre fundo escuro.
- `border-radius` acima de 4 px (exceto pílulas/círculos funcionais).
- Ícones decorativos em todo título, emojis, "badges" de marketing ("Novo!", "Para estudantes…").
- Texto de landing genérico ("A melhor forma de…"). Microcopy direto, de boletim.

## Direção visual
- **Placar** (o que importa agora): painéis quase pretos com números grandes em fonte condensada, alinhados em grade, rótulos em CAIXA ALTA pequenos e espaçados. Ex.: `AGORA 6,09 ──▶ META 7,00` e `FALTA 6,69`.
- **Boletim** (o resto da tela): fundo de papel off-white, réguas finas de 1 px, tabelas com linhas pontilhadas de preenchimento (`P1 ........ 5,0`), situação como **carimbo** (borda dupla ou sólida, caixa alta, levemente inclinado é opcional e sutil).
- **Régua de situação**: faixa horizontal segmentada REPROVADO | EXAME | APROVADO com marcador "▲ você está aqui" e marcador de "máximo possível".
- Bordas duras (1–2 px), cantos retos ou 2–4 px, separação por réguas e blocos sólidos, não por sombra.

## Tipografia (sem fontes externas — CSP `font-src 'self'`)
- **Números e rótulos de placar:** `"Bahnschrift", "DIN Alternate", "DIN Condensed", "Roboto Condensed", "Arial Narrow", sans-serif` com `font-variant-numeric: tabular-nums`. Bahnschrift vem no Windows 10+ e tem larguras condensadas (`font-stretch: condensed` / `font-variation-settings: "wdth" 75`).
- **Texto corrido:** pilha do sistema (`"Segoe UI", system-ui, -apple-system, Roboto, sans-serif`).
- Escala marcada: rótulos 11–12 px CAIXA ALTA com `letter-spacing: .08em`; números do placar 48–96 px.

## Cor (significado primeiro)
- Neutros: papel (`#f4f1ea`-ish), tinta (`#1a1a1a`-ish), painel de placar (`#121212`-ish) — ajuste para contraste.
- **Uma** cor de destaque de marca, quente e esportiva (ex.: âmbar de placar `#ffb000`-ish ou verde de campo), usada com parcimônia (números do placar, foco, chamada principal).
- Semânticas fixas e saturadas, nunca reaproveitadas: APROVADO verde, EXAME âmbar/laranja, REPROVADO vermelho, EM ANDAMENTO azul-aço, SIMULAÇÃO com padrão próprio (ex.: hachura diagonal + rótulo "SIMULAÇÃO") em vez de mais uma cor.
- Tema escuro: o "papel" vira grafite, o placar continua preto; tudo AA (4,5:1 texto, 3:1 componentes).

## Restrições técnicas (não negociáveis)
- Só HTML5 + CSS3 + JS vanilla. Sem frameworks, sem CDN, sem fontes externas. Nada de `style=""` no HTML estático, `<style>`/`<script>` inline (CSP). Ícones/ilustrações em SVG próprio.
- Não mudar ids, comportamento, contratos da API, cálculo (`calc.js`) nem `_headers`.
- Chave `P26-2B-8356-94BE-3650-165C` no rodapé. `prefers-reduced-motion` respeitado. Movimento só funcional (ex.: número do placar trocando, 150–200 ms).

## Checklist antes de entregar
- [ ] Nenhum item da lista "Proibido" presente (procure por `gradient`, `backdrop-filter`, `blur(`, raios > 4 px, roxo/índigo).
- [ ] O número que importa (FALTA / nota mínima / nota no exame) é o maior elemento da tela da disciplina.
- [ ] 375, 768, 1280, 1440 px; claro e escuro; sem rolagem horizontal; contraste AA medido; foco visível; console sem erros e sem violação de CSP.
- [ ] `node tests/calc.test.mjs` e `node tests/api.test.mjs` passando.
