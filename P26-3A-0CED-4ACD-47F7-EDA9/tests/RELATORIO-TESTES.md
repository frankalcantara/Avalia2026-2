# Relatório de Testes e Validação — Cypher (P26-3A-0CED-4ACD-47F7-EDA9)

- **Data:** 2026-11-15
- **Responsável:** Agente 4 (Teste e Validação), seguindo `skills/teste-validacao/SKILL.md`
- **Referência:** `docs/contrato-api.md` (fonte da verdade de rotas, formatos e códigos de erro)
- **Princípio:** nada foi aceito pelo que os outros agentes relataram; todos os resultados abaixo vêm da execução real do código.

## Resumo

| Bloco | Arquivo | Passou | Falhou |
|---|---|---|---|
| Unitários (lógica do servidor) | `tests/unit.test.mjs` | 17 | 0 |
| API contra servidor local + D1 local | `tests/api.test.mjs` | 27 | 0 |
| Interface no Chrome headless contra o servidor real | `tests/ui-real.mjs` | 29 | 0 |
| Integridade do D1 após os testes | consultas SQL (seção 6) | 7 | 0 |
| Rubrica (`validar-local.mjs`) | repositório da disciplina | 8 de 9 | 1 pendente (deploy online, esperado) |

Defeitos encontrados: **4** (todos corrigidos e retestados, seção 8). Nenhum defeito de segurança ou de regra de jogo foi encontrado no servidor.

## 1. Ambiente

- Linux, Node.js 22.23, Wrangler 4.162 (`wrangler pages dev` com D1 local em `.wrangler/`).
- Google Chrome em `/usr/bin/google-chrome`, controlado por `puppeteer-core` 25 carregado de fora da pasta do projeto (não é dependência do projeto).
- Fuso do sistema: America/Sao_Paulo. Dia de jogo durante os testes: `2026-11-15`.
- `.dev.vars` temporário com `WORD_SECRET=teste-local`, `DISCORD_CLIENT_ID=x`, `DISCORD_CLIENT_SECRET=y`. Apagado ao final junto com `.wrangler/`.
- Sessões de teste criadas direto no D1 local (simulam um login já concluído): 2 usuários (`teste1`, `teste2`), 2 sessões com o SHA-256 do token e 1 servidor do Discord (`Turma Teste`) só para o usuário 1.

## 2. Comandos executados

```bash
cd P26-3A-0CED-4ACD-47F7-EDA9
rm -rf .wrangler .dev.vars                       # banco local limpo
eval "$(bash tests/preparar-ambiente.sh)"        # .dev.vars, migração, usuários, sessões, guild; exporta TEST_TOKEN e TEST_TOKEN_2
wrangler pages dev public --port 8788 &          # servidor local real

node --test tests/unit.test.mjs
node --test tests/api.test.mjs                   # BASE_URL padrão http://localhost:8788
PUPPETEER_PATH=<node_modules externo>/puppeteer-core/lib/puppeteer/puppeteer-core.js \
  SHOTS=/home/claude/cypher-shots/real node tests/ui-real.mjs
node --test                                      # sem tokens: 17 unitários passam, 27 de API ficam "skipped"
node tests/conferir-palavras.mjs                 # script do Agente 3

# auditoria da rubrica (cópia temporária, removida depois)
cd ../ext/Avalia2026-2 && node validar-local.mjs P26-3A-0CED-4ACD-47F7-EDA9

# limpeza
kill <wrangler>; rm -rf .wrangler .dev.vars
```

A resposta das partidas foi descoberta **só pela API**: o usuário 2 perde a partida com chutes que nunca são resposta (palavras de `VALID` fora de `ANSWERS`), e o `answer` que vem no fim é usado pelo usuário 1 para ganhar. O D1 não foi lido durante os testes de vazamento; as consultas da seção 6 rodaram só depois.

## 3. Testes unitários (`tests/unit.test.mjs`)

| Caso | Esperado | Obtido | Resultado |
|---|---|---|---|
| Normalização `limão`, `AÇÚCA`, `caçar`, `Pêssê`, `CaRrO`, espaços | `LIMAO`, `ACUCA`, `CACAR`, `PESSE`, `CARRO` | igual | passou |
| Normalização rejeita 4/6 letras, números, símbolos, emoji, não-texto | `null` | `null` | passou |
| Clássico com repetidas: resposta `CASCA`, chute `ACASO` | `present ×4, absent` | igual | passou |
| `correct` tem prioridade (`CARRO`×`RARRR`, `LIVRO`×`OVOOO`, `PRAIA`×`AAXXX`, `TEMPO`×`OOOOO`) | só sobra `present` para ocorrências restantes | igual | passou |
| Acerto total / nenhuma letra / `isWinningFeedback` | 5× `correct` vence; 4 não | igual | passou |
| Sombra: `{exact, misplaced}` em casos fixos | `CASCA`×`ACASO` = 0/4 etc. | igual | passou |
| Sombra coerente com o clássico em 2000 pares do dicionário | contagens = contagem de `correct`/`present` | igual | passou |
| Data de hoje em America/Sao_Paulo (02:30 UTC de 16/11 = 15/11) | `2026-11-15` | igual | passou |
| Validação de data (`2026-02-30`, `2026-13-01`, formatos errados) | inválida | inválida | passou |
| `daysBetween`, `addDays` (virada de mês e de ano) | 14, 1, -1, `2026-12-01` | igual | passou |
| `resolveGameDate`: vazia, futura, antes do lançamento, inválida | hoje / 403 `future_date` / 400 `before_launch` / 400 `invalid_date` | igual | passou |
| Listas: 5 letras, sem duplicatas, `ANSWERS ⊂ VALID`, `COFRE` fora das respostas | sem falhas | 1161 respostas, 10466 válidas | passou |
| Dicionário: forma de exibição com acento, `COFRE` aceito como chute | igual | igual | passou |
| Slot do dia (`2n` clássico, `2n+1` sombra) | 28 e 29 em 15/11 | igual | passou |
| Sorteio determinístico pelo segredo, nunca além do slot alvo, sem repetição no ciclo, clássico ≠ sombra no mesmo dia (D1 simulado) | ok | ok | passou |
| Ciclo longo (1361 slots): 1º ciclo usa todas as palavras uma vez, nenhuma repetição em 30 slots | ok | ok | passou |
| Sem `WORD_SECRET` | 500 `server_misconfigured` | igual | passou |

## 4. Testes de API (`tests/api.test.mjs`)

| Caso (trapaça ou contrato) | Esperado | Obtido | Resultado |
|---|---|---|---|
| 10 rotas protegidas sem cookie | 401 `unauthorized` | 401 | passou |
| Mesmas rotas com 4 cookies forjados (hex inválido, token alterado, maiúsculas, texto) | 401 | 401 | passou |
| `GET /api/me` | `{user, guilds, today, launchDate}`, `Cache-Control: no-store` | igual | passou |
| `GET /api/auth/discord?returnTo=//evil...` | 302 para discord.com, `scope=identify guilds`, `state` no cookie `cypher_oauth` HttpOnly 10 min, `returnTo` = `/` | igual | passou |
| Callback sem `state` ou com `state` diferente | redireciona `/?auth_error=state`, sem sessão | igual | passou |
| Logout sem sessão | `{ok:true}` e cookie com `Max-Age=0` | igual | passou |
| Data futura (amanhã e 2099) no GET e no POST, nos 2 modos | 403 `future_date` | 403 | passou |
| Data antes do lançamento | 400 `before_launch` | 400 | passou |
| Data inválida (`2026-02-30`, `15-11-2026`, número) | 400 `invalid_date` | 400 | passou |
| Modo inexistente (`desafio`, `hard`, `__proto__`, `constructor`, `toString`) em game/guess/stats/vaults/ranking | 400 `invalid_mode` | 400 | passou |
| Chute com 4/6 letras, números, símbolos, vazio, `null`, número, array, objeto | 400 `invalid_format` | 400 | passou |
| Chute fora do dicionário (`zzzzz`, `qwert`) | 422 `not_a_word` | 422 | passou |
| Chute inválido não consome tentativa | `attempts` continua vazio | igual | passou |
| Corpo que não é JSON ou é array | 400 `invalid_format` | 400 | passou |
| Método não permitido | 405 JSON | 405 | passou |
| `GET /api/game` (formato do contrato, `isArchive`, `isToday`) e GET não cria partida | ok; cofres continuam `untouched` | igual | passou |
| Clássico até perder (usuário 2) | `answer` só no 6º chute, na forma de exibição | igual | passou |
| 7º chute no clássico | 409 `game_over` | 409 | passou |
| Sombra até perder; feedback `{exact, misplaced}`; palavra diferente da do clássico | ok | ok | passou |
| 11º chute no sombra | 409 `game_over` | 409 | passou |
| Clássico até ganhar (usuário 1): resposta ausente de **todo** o texto cru de `/api/guess`, `/api/game`, `/api/vaults`, `/api/stats`, `/api/ranking`, `/api/me` enquanto `status=playing` (busca textual normalizada) | nunca aparece | nunca apareceu | passou |
| Recarregar (novo GET) mantém as tentativas | mesmas tentativas | igual | passou |
| Chute vencedor com acento e caixa baixa | normalizado, `won`, `answer` acentuada | igual | passou |
| Sombra até ganhar sem vazamento | `{exact:5, misplaced:0}` | igual | passou |
| Estatísticas após o dia | usuário 1: 1 jogo, 100%, streak 1, distribuição `[0,0,0,1,0,0]`; usuário 2: 1 jogo, 0 vitórias | igual | passou |
| Ranking global (`wins` e `streak`) | 2 entradas, campos do contrato, `isMe`, `me: null` | igual | passou |
| Ranking da guild pelo membro | só o usuário 1, `guild: {id, name}` | igual | passou |
| Ranking de guild de que o usuário não participa | 403 `forbidden` | 403 | passou |
| Ranking sem guild / guild com SQL / escopo inválido | 400 `invalid_format` | 400 | passou |
| Cofre antigo (ontem) ganho pelo usuário 1 | `isArchive: true`; streak continua 1 (não vira 2); `played` e distribuição iguais; `archive {1,1}`; ranking idêntico ao de antes | igual | passou |
| `GET /api/vaults` | 15 dias, ordem decrescente, `won/lost/playing/untouched` corretos | igual | passou |
| 4 chutes simultâneos na mesma partida | só respostas 200/409; tentativas gravadas = respostas 200 | 2 gravadas, 2 × 409 | passou |
| Desafio: criar com palavra inválida / curta / sem palavra | 422 / 400 / 400 | igual | passou |
| Desafio: criar, listar (`id, word, createdAt, plays, wins`), visão do criador | ok, `LIMÃO` com acento | igual | passou |
| Criador jogando o próprio desafio | 403 `own_challenge` | 403 | passou |
| Jogador: palavra ausente do JSON enquanto joga, ganha, 3º chute | `answer` só no fim; 409 depois | igual | passou |
| Jogador perde em 6, 7º chute | `LIMÃO` no fim; 409 `game_over` | igual | passou |
| Criador vê quem jogou; contadores `plays/wins` | `teste2 won 2`; `[1,1,1,0]` | igual | passou |
| Desafio inexistente ou id mal formado | 404 `not_found` | 404 | passou |
| 21º desafio no mesmo dia | 429 `rate_limited` | 429 | passou |
| `/d/:id` sem login | 200 HTML, título "teste1 te desafiou a abrir um cofre no Cypher", `og:image`, `og:url` e `twitter:image` absolutas, redireciona para `/?desafio=<id>`, palavra ausente | igual | passou |
| `/` | `og:image` = `http://localhost:8788/og.png` absoluta, `twitter:card=summary_large_image`, chave no `<footer>`, `nosniff`; `og.png` é PNG | igual | passou |

## 5. Teste de interface (`tests/ui-real.mjs`, viewport 390×844)

| Caso | Resultado |
|---|---|
| Sem cookie: tela de entrada visível, app oculto | passou |
| Sem cookie: botão de login aponta para `/api/auth/discord?returnTo=%2F` | passou |
| Sem cookie com `?desafio=`: convite visível e `returnTo` preserva o desafio | passou |
| Rodapé com `P26-3A-0CED-4ACD-47F7-EDA9` na entrada e no app | passou |
| Com cookie `cypher_session`: app visível; banner de cofre antigo | passou |
| Palavra fora do dicionário pelo teclado físico mostra aviso e não pinta peças | passou |
| Palavra curta mostra "Faltam letras" | passou |
| Duas palavras pelo teclado físico: as 5 peças de cada linha recebem `correct/present/absent` | passou |
| Teclado virtual marca as letras; cabeçalho mostra "Tentativa 3 de 6" | passou |
| Recarregar a página mantém as tentativas | passou |
| Sombra: 10 linhas, contagens na lateral e nenhuma peça colorida | passou |
| Partida de hoje encerrada abre o resultado sozinha | passou |
| Painéis Cofres antigos, Estatísticas e Ranking abrem com conteúdo | passou |
| Ranking global lista o usuário 1; ranking do servidor não lista o usuário 2 | passou |
| Desafio: criar pela interface mostra o link `/d/:id`; visão do criador sem tabuleiro | passou |
| Desafio como jogador: banner do criador, chute pelo teclado com estados, palavra ausente do DOM | passou |
| Nenhum erro de console nem de página | passou |

Observações: o Chrome registra no console as respostas 4xx esperadas (401 de `/api/me` sem login e 422 do chute inválido); o roteiro as separa dos erros reais. Os avatares de `cdn.discordapp.com` foram respondidos localmente com uma imagem de 1 px para não depender da internet, por isso aparecem vazios nas capturas.

Capturas (servidor real): `/home/claude/cypher-shots/real/`

`01-entrada-sem-login.png`, `02-entrada-convite-desafio.png`, `03-classico-cofre-antigo-jogando.png`, `04-sombra-cofre-antigo.png`, `05-resultado-hoje.png`, `06-classico-hoje-aberto.png`, `07-cofres-antigos.png`, `08-estatisticas.png`, `09-ranking-global.png`, `10-ranking-servidor.png`, `11-desafio-central.png`, `12-desafio-criador.png`, `13-desafio-jogador.png`.

## 6. Integridade do D1 (consultado só depois dos testes)

| Verificação | Resultado |
|---|---|
| `games.attempts` = número de linhas em `guesses` de cada partida | 0 divergências |
| Sem buraco na sequência de `attempt_no` | 0 |
| `challenge_games.attempts` = linhas em `challenge_guesses` | 0 divergências |
| `daily_words`: slots 0 a 29 contíguos, último dia = hoje (nenhum dia futuro sorteado), 30 palavras distintas | ok |
| Nenhuma partida com mais tentativas que o limite; toda derrota com o limite exato | 0 divergências |
| `sessions` guarda só o hash de 64 caracteres (diferente do token) | ok |
| `user_stats` coerente com as partidas (arquivo só em `archive_*`) | ok |

## 7. Conformidade com a rubrica

Saída de `node validar-local.mjs P26-3A-0CED-4ACD-47F7-EDA9` (cópia temporária da pasta na raiz do repositório da disciplina, removida depois):

```
✅ [OK]     1. Arquivo LICENSE (MIT)
✅ [OK]     2. Chave Única no README.md
✅ [OK]     3. Chave Única no rodapé do HTML
✅ [OK]     4. Documento AGENTS.md (Mín. 3 agentes)
✅ [OK]     5. Agente de Teste e Validação documentado
✅ [OK]     6. Arquivos de Skills na pasta skills/
✅ [OK]     7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)
✅ [OK]     8. Backend Cloudflare Functions + D1 + Discord OAuth2
⚠️ [PENDENTE] 9. Deploy Online na Cloudflare (https://avalia2026-2-5rz.pages.dev)
```

O item 9 fica pendente porque o deploy ainda não foi feito (esperado nesta etapa). Detalhes do validador: 4 skills, agentes detectados ≥ 3, sem framework proibido.

Conferências manuais:
- Nenhum framework de UI: sem `package.json`; nenhuma referência a React, Vue, Angular, Svelte, jQuery, Tailwind ou Bootstrap em `public/`; nenhum script ou CSS externo.
- Nenhum segredo no código: busca por `client_secret`, `WORD_SECRET`, tokens do Discord e chaves de API sem ocorrências com valor. Os segredos só existem como variáveis de ambiente.
- Ao final não há `.dev.vars`, `.wrangler/` nem `node_modules/` na pasta do projeto. O `.gitignore` da raiz do repositório da disciplina já ignora esses três.

## 8. Defeitos encontrados e correções

| # | Defeito | Arquivo | Correção | Reteste |
|---|---|---|---|---|
| 1 | O comando de testes do README (`node --test tests/`) falha no Node 22: o argumento é tratado como arquivo e dá `Cannot find module .../tests` | `README.md` | Trocado por `node --test` (descobre `tests/*.test.mjs`; os de API são pulados sem servidor) e pelos passos do teste de API com `tests/preparar-ambiente.sh` | `node --test`: 17 passaram, 27 pulados, 0 falhas |
| 2 | Ranking mostrava "média 0,0" para quem ainda não tem vitórias (`avgAttempts = null`), o que parece a melhor média possível | `public/js/panels.js` | Quando `avgAttempts` é `null`, mostra "média —" | captura `09-ranking-global.png` |
| 3 | Ranking mostrava "1 jogos" | `public/js/panels.js` | Singular/plural: "1 jogo", "2 jogos" | captura `09-ranking-global.png` |
| 4 | Estatísticas mostravam "Cofres antigos: 1 jogados, 1 abertos" | `public/js/panels.js` | Singular/plural em "jogado(s)" e "aberto(s)" | captura `08-estatisticas.png` |

Também foi preciso ajustar o próprio roteiro de interface: ele esperava o fim da animação de revelação antes de digitar e de ler o cabeçalho. Isso não era defeito do jogo, porque o teclado fica bloqueado de propósito durante a animação.

## 9. Observações (sem defeito confirmado)

- O login real com o Discord não pôde ser testado aqui porque não há credenciais. Os testes cobrem o redirecionamento, o `state` e a recusa do callback. A URL de autorização usa `prompt=none`; vale confirmar no primeiro login real em produção que a tela de consentimento aparece normalmente para um usuário novo.
- Em chutes simultâneos, o servidor responde `409` com o código `conflict`, que não está na lista do contrato (seção 6). O comportamento está correto, porque nada é duplicado e a interface trata qualquer 409 recarregando o cofre. Só falta documentar esse código.
- Antes do deploy, `wrangler.jsonc` ainda precisa receber o `database_id` real (hoje está com `COLE-AQUI-O-DATABASE-ID`), como o README já orienta.
