# DESIGN: Acervo de Citações e Notas de Leitura (Projeto #41, Commonplace Book)

Brief de direção de arte para o builder. Escopo: somente design (referências, conceito, paleta, tokens, tipografia, telas, motion, acessibilidade). Substitui o brief genérico anterior. Idioma da interface: português do Brasil.

## 1. Conceito e ideia-assinatura

- Conceito: "Marginália". Um livro lido com lápis na mão. A citação é o texto principal; a reflexão do estudante vive na margem, como uma anotação a lápis ao lado do trecho. O site deve parecer uma página bem diagramada de livro de bolso, não um painel de app.
- Ideia-assinatura (um único momento memorável): o **marca-texto**. Todo trecho citado recebe uma faixa amarela de marca-texto que "passa" sobre o texto (de esquerda a direita) quando a citação é revelada. É o gesto do botão "Citação Aleatória": a citação sorteada entra e o marca-texto percorre o trecho. O resto da interface é quieto e disciplinado.
- Contrastes de papel: citação em serifa grande e itálica; reflexão em coluna lateral menor (marginália); metadados (autor, obra, página) como linha de referência bibliográfica.
- Evitar: bege creme com terracota, aspas decorativas gigantes em cada cartão, grade de cartões idênticos, rótulos em caixa-alta espaçada, numeração 01/02/03, destacar uma palavra do título com cor.

## 2. Referências (princípios extraídos, nada copiado)

A busca retornou pouco material direto sobre sites de citações; abaixo, o que de fato foi encontrado e o que se aproveita. Nenhuma página foi lida na íntegra (apenas resultados de busca), então trate como princípios, não como análise de cada site.

1. Readwise (commonplace book digital com revisão espaçada): https://stevenhill.org.uk/posts/readwise-commonplace-book . Princípio: resurfacing de trechos antigos é o valor central; inspira o botão "Citação Aleatória" como ação de destaque.
2. Readwise Reader (guia de design): https://blakecrosley.com/guides/design/readwise-reader . Princípio: interface centrada em quem lê texto, controles discretos, texto em primeiro plano. (Conteúdo da página não verificado além do título.)
3. Zenpen (tipografia de escrita): https://fontsinuse.com/uses/64523/zenpen-website . Princípio: parágrafos justificados/hifenizados no estilo de livro são raros na web e dão caráter; usar `hyphens: auto` na reflexão, sem justificar a citação principal.
4. Editorial New (Awwwards, Site of the Day): https://awwwards.com/sites/editorial-new . Princípio: layout editorial com hierarquia por tipografia e ritmo, não por caixas. (Detalhes tipográficos não verificados.)
5. Atlas Journal (conceito de design editorial): https://contra.com/p/grlr7sNE-atlas-journal-premium-editorial-website-design . Princípio: calma, refinamento e leitura fácil como objetivo declarado.
6. Awwwards Inspiration, Editorial Layout: https://www.awwwards.com/inspiration/editorial-layout-books-of-design . Princípio: grade de livro, margens generosas, medida de linha controlada (65 a 75 caracteres).

Padrões destilados: serifa de leitura como protagonista; coluna estreita; margem como lugar de anotação; navegação mínima; movimento só onde ajuda a leitura.

## 3. Paleta (harmonia análoga fria + complemento pontual)

Harmonia: **análoga fria (azul-índigo e verde-acinzentado do papel) com um único complemento quente, o amarelo marca-texto**. Justificativa: tinta azul sobre papel frio lembra caneta e caderno; o amarelo é o objeto do universo (marca-texto) e aparece como preenchimento, nunca como texto sobre fundo claro. Regra 60-30-10: 60% papel (`bg`), 30% superfície e tinta (`surface`, `text`), 10% índigo + marca-texto.

Tema claro (padrão, "papel"):

| Papel | Hex | Uso | Contraste (medido) |
|---|---|---|---|
| --bg | #EDF0EB | fundo da página (papel frio esverdeado) | texto/bg 14,24:1 |
| --surface | #F8F9F6 | formulário, painéis, campos | texto/surface 15,50:1 |
| --text | #17202E | tinta: citações e corpo | AAA |
| --muted | #4B576A | metadados, notas, texto de apoio | 6,36:1 bg; 6,92:1 surface |
| --accent | #2E3FA3 | links, botão primário, foco (tinta índigo) | 7,75:1 bg; 8,43:1 surface |
| --accent-ink | #FFFFFF | texto sobre --accent | 8,91:1 |
| --marker | #F4D35E | faixa de marca-texto (só preenchimento) | texto --text sobre marker 11,17:1 |
| --danger | #A32A2A | erros (sempre com ícone e texto) | 6,25:1 bg |
| --success | #1F6B4A | confirmação (com texto) | 5,60:1 bg |
| --line | #C9D0CC | divisores decorativos | decorativo |
| --line-strong | #718096 | borda de campos e controles | 3,49:1 bg; 3,80:1 surface (>= 3:1 UI) |

Tema escuro ("lâmpada de leitura"), via `prefers-color-scheme` e `data-theme="dark"`:

| Papel | Hex | Contraste |
|---|---|---|
| --bg | #12161F | texto/bg 15,16:1 |
| --surface | #1A202C | texto/surface 13,66:1 |
| --text | #E8EBF1 | AAA |
| --muted | #9AA5B8 | 7,28:1 bg; 6,56:1 surface |
| --accent | #8FA0FF | 7,45:1 bg; 6,71:1 surface |
| --accent-ink | #12161F | 7,45:1 sobre accent |
| --marker | #F4D35E | tinta #12161F sobre marker 12,35:1 |
| --danger | #FF8A8A | 7,98:1 |
| --success | #6FD3A2 | 9,92:1 |
| --line-strong | #5A6578 | 3,07:1 (UI) |
| --line | #2A3242 | decorativo |

Regras de uso: marca-texto sempre com `--text` por cima (no escuro, trocar para tinta escura sobre marker, ou usar marker a 28% de opacidade sobre o texto claro, verificando 4,5:1). Nunca usar amarelo como cor de texto no tema claro. Cor nunca é a única informação: Pública/Privada usa ícone + palavra.

## 4. Tokens (para `css/tokens.css` do builder)

- Espaço (base 8px): --space-1 .5rem, -2 1rem, -3 1.5rem, -4 2.5rem, -5 4rem, -6 7rem. Gutter mínimo 16px. Largura de leitura: 40rem (citação), página 64rem com margem lateral de 16rem para a reflexão no desktop.
- Raios: --radius-sm 4px (campos, botões), --radius-md 10px (painel do formulário), --radius-pill 999px (selo Pública/Privada e botão de tema). Citações NÃO ficam em cartões arredondados: são texto sobre o papel, separados por filete.
- Sombras: praticamente nenhuma; apenas --shadow-1 `0 1px 2px rgb(0 0 0 / .12)` no painel do formulário e em popovers.
- Movimento: --ease-out `cubic-bezier(.22,1,.36,1)`; --dur-fast 160ms; --dur-base 320ms; --dur-marker 700ms (varredura do marca-texto).
- Marca-texto (técnica sugerida, não é código final): `background: linear-gradient(var(--marker), var(--marker)) no-repeat 0 85% / 0% 62%`, animando o tamanho para `100% 62%` com `box-decoration-break: clone` para quebrar bem em várias linhas.

## 5. Tipografia (2 famílias, Google Fonts, `font-display: swap`)

- **Literata** (Google Fonts, desenhada para leitura em tela): citações, títulos e reflexões. Pesos 400, 500, 600; itálico 400 para a citação. Fallback `Georgia, serif`.
- **Hanken Grotesk**: interface (botões, campos, filtros, metadados, navegação). Pesos 400, 500, 600. Fallback `system-ui, sans-serif`.
- Escala fluida: --fs-quote-lg `clamp(1.5rem, 2.2vw + 1rem, 2.5rem)` (citação aleatória em destaque, itálico, `line-height` 1,35); --fs-quote `1.25rem` (citações na lista, `line-height` 1,6); --fs-h1 `clamp(2rem, 3vw + 1rem, 3.25rem)`; --fs-h2 `1.5rem`; --fs-body `1.0625rem`; --fs-note `0.9375rem` (marginália); --fs-ui `0.9375rem`; --fs-small `0.8125rem` (mínimo; apenas dados secundários).
- Medida: citação e reflexão limitadas a 66ch. Reflexão em `hyphens: auto`, alinhada à esquerda. Interface alinhada à esquerda, sem centralizar blocos de texto.
- Referência bibliográfica: "Autor, *Obra*, p. 42" em Hanken Grotesk, `--muted`, sem caixa-alta, sem pontos médios; obra em itálico.
- Evitar: rótulos em caixa-alta acima de seções, numeração, palavra de título em outra cor, "→" em links.

## 6. Telas e seções (SPA estática; telas alternadas por rota/hash ou seções)

Cabeçalho fixo simples em todas as telas: marca em texto ("Acervo"), navegação (Feed da turma, Minhas citações, Nova citação), campo de busca compacto, botão de tema (`aria-pressed`), avatar + "Sair" quando logado. Colapsa em menu acessível no mobile.

1. **Entrada (login com Discord)**. Tela deslizante em duas colunas no desktop: à esquerda, uma citação-exemplo grande com marca-texto já aplicado e, na margem, uma anotação; à direita, título "Guarde o que vale reler", uma frase de apoio e um único botão "Entrar com Discord" (cor `--accent`, ícone do Discord em SVG, rótulo textual). Abaixo, uma linha: "Só usamos seu nome e avatar do Discord." Estados: carregando ("Abrindo o Discord..."), erro ("Não foi possível entrar. Tente de novo.") com botão de repetir.
2. **Nova citação (formulário)**. Painel `--surface`. Campos, nesta ordem: Trecho da citação (textarea grande, serifa, contador de caracteres), Autor, Obra (livro, artigo ou palestra), Página (numérico, opcional para palestra), Minha reflexão (textarea), Visibilidade (grupo de rádio: Pública / Privada, com ícone e texto de ajuda: "Pública aparece no feed da turma. Privada só você vê."; padrão Privada), botão "Salvar citação". Rótulos sempre visíveis acima do campo; erros em texto abaixo do campo; sucesso: "Citação salva" com opção de ver em Minhas citações. Pré-visualização ao vivo do trecho com marca-texto ao lado (desktop), opcional.
3. **Minhas citações**. Lista vertical (não grade) no formato página de livro: citação em itálico, referência abaixo, reflexão na margem direita (desktop) ou recuada com filete (mobile). Cada item tem selo Pública/Privada (ícone cadeado aberto/fechado + palavra), ações "Editar" e "Excluir" (confirmação textual). Filtro por visibilidade (Todas, Públicas, Privadas) como grupo de botões. Estado vazio: "Você ainda não guardou nenhuma citação." + botão "Nova citação".
4. **Feed público da turma**. Mesma anatomia da lista, mais a linha de autoria (avatar pequeno + nome do estudante, "compartilhou em 12 de out."). Sem curtidas ou ranking (fora de escopo). Paginação "Carregar mais" (botão real). Estado vazio: "Ninguém compartilhou ainda. Marque uma citação como Pública para abrir o feed."
5. **Busca instantânea por autor ou tema**. Campo `type="search"` no cabeçalho e no topo do feed/minhas citações, filtrando ao digitar (debounce ~150 ms). Alternador "Autor / Tema / Tudo". Termo encontrado destacado com o mesmo marca-texto (mais claro). Contagem em região `aria-live="polite"` ("12 citações encontradas"). Sem resultado: "Nada para 'borges'. Tente outro autor ou tema." Botão "Limpar busca".
6. **Citação Aleatória**. Botão secundário de destaque, na parte superior do feed ("Citação aleatória"). Ao acionar, abre uma faixa/painel de leitura com a citação em --fs-quote-lg, reflexão na margem e referência; botão "Sortear outra" e "Fechar". Estados: carregando (esqueleto simples), erro de rede ("Não foi possível sortear agora. Tente de novo."), acervo vazio ("Ainda não há citações públicas para sortear."). Foco move para o painel; conteúdo anunciado via `aria-live`.
7. **Rodapé** mínimo: nome do projeto, ano, link "Código no GitHub" e a **Chave Única (Hash)** da entrega, exigida pela rubrica, visível em todas as telas. Apresentar o hash em linha própria com o texto "Chave única:" seguido do valor em fonte monoespaçada do sistema (`ui-monospace`, 0,8125rem, `--muted`, selecionável, com quebra permitida em 320px). O valor real é fornecido pelo aluno (placeholder `[CHAVE-UNICA-AQUI]`); o mesmo valor vai no README.md. Sem links sociais.

Copy: específica e do domínio, sem lorem ipsum. Exemplos de conteúdo: citações reais de domínio público ou claramente fictícias marcadas como exemplo, autor e página plausíveis.

## 7. Motion

- Um momento orquestrado: a varredura do marca-texto (--dur-marker, --ease-out) sobre a citação ao ser revelada (Citação Aleatória, e uma vez na tela de entrada). Por cima, fade curto do bloco (--dur-base).
- Movimento em resposta a ação: abrir/fechar o painel aleatório, confirmar salvamento, filtrar lista (itens que saem simplesmente somem; sem animação em cascata).
- Proibido: fade-and-slide em cada seção, hover animado em tudo, paralaxe, 3D. Este projeto não usa three.js nem GSAP: a rubrica exige HTML5, CSS3 e JavaScript puro, sem frameworks de UI; a varredura é feita só com CSS (transição de `background-size`) disparada por uma classe via JS vanilla.
- `prefers-reduced-motion: reduce`: marca-texto aparece já aplicado, sem varredura; sem transições além de mudança de cor.

## 8. Acessibilidade e responsividade

- `lang="pt-BR"`; HTML semântico (`header`, `nav`, `main`, `section` com `aria-labelledby`, `footer`); um único `h1` por tela; link "Pular para o conteúdo".
- Foco visível: outline 2px `--accent`, offset 3px, em todo interativo; alvos >= 44x44px.
- Contrastes do item 3 já medidos; bordas de campo >= 3:1. Pública/Privada nunca só por cor.
- Formulário: `label` associado, `required`, `aria-describedby` para ajuda e erro, foco no primeiro campo inválido ao enviar, `autocomplete="off"` onde fizer sentido.
- Busca: `role="search"`, resultado anunciado em `aria-live="polite"`; resultados atualizam sem tirar o foco do campo.
- Citação Aleatória: foco no painel ao abrir, retorno ao botão ao fechar; Esc fecha.
- Mobile-first; breakpoints 640px, 900px, 1200px; sem rolagem horizontal em 320px; em mobile a reflexão desce para baixo da citação, recuada com filete lateral.
- Texto de usuário sempre renderizado como texto (nunca HTML); quebra de palavras longas (`overflow-wrap: anywhere`) para citações e URLs coladas.

## 9. Rubrica de avaliação: o que toca o design e o que não toca

Itens que afetam este brief (já incorporados):
- Interface em HTML5, CSS3 e JS vanilla, sem frameworks de UI, com manipulação direta do DOM e responsividade (15 pts). Sem Tailwind, React, GSAP ou three.js.
- Login exclusivamente via Discord OAuth2, importando user_id, nome e avatar: a tela de entrada tem só o botão "Entrar com Discord" (sem e-mail/senha); cabeçalho e feed mostram nome e avatar importados; avatar com `alt` vazio quando o nome já está ao lado, e fallback de iniciais se a imagem falhar.
- Visibilidade Pública/Privada e regras de negócio são validadas no servidor (Cloudflare Functions). A interface deve tratar respostas de erro do servidor (403, 401 com retorno à tela de entrada, 400 com mensagens por campo), nunca assumir que o cliente decide.
- Chave Única (Hash) no rodapé da interface e no README (10 pts): ver rodapé, seção 6.
- Online e funcionando em HTTPS no Cloudflare (25 pts): estados de carregando, erro e vazio de todas as telas já especificados; nenhum recurso externo além de Google Fonts (com fallback de sistema) para não quebrar o carregamento.

Fora do escopo deste brief de design (cabem a outros agentes/etapas): deploy no Cloudflare Pages/Workers, modelagem do D1 e Functions, repositório público com licença MIT e LICENSE, documento de agentes/harness e arquivos de skills (mínimo de 3 agentes, um deles de teste e validação), entrega das URLs no AVA. Este brief é o insumo do agente de interface; o agente de testes deve usar as seções 6 e 8 como checklist (estados, foco, contraste, 320px/390px/1440px, reduced-motion).

## 10. Observações para o builder

- Não alterar paleta nem tipografia sem reportar o motivo.
- Este brief não define backend (Discord OAuth, D1, endpoint aleatório); apenas os estados de interface que dependem deles (carregando, erro, vazio).
- Não verificado: pesquisa de referências foi limitada a resultados de busca; nenhuma página foi lida na íntegra. Fontes (Literata, Hanken Grotesk) e contrastes foram escolhidos/calculados, mas não testados em tela.

## 11. Página de login (adição)

Desenhada no FigCraft (página "Acervo - Marginalia", abaixo das demais telas): frames "Login · Desktop 1440", "Login · Mobile 390", "Login · Estados Desktop 1440" e "Login · Estados Mobile 390". Capturas em `mockups/07-login-*.png` (capturas da janela do FigCraft, com a interface do app ao redor).

Decisões:
- O OBJETIVO exige login só via Discord OAuth2: não há campos de e-mail/senha. A página é uma tela própria de "Entrar" (distinta da tela de Entrada com citação-exemplo), foco total no botão.
- Composição: painel `--surface` (raio 10px, borda `--line`, sem sombra no mockup; usar `--shadow-1`) com texto alinhado à esquerda, centrado na página; à direita, nota de marginália (Literata 15px, `--muted`, filete `--line-strong` de 2px). No mobile a nota desce abaixo do painel.
- Conteúdo do painel: h1 "Entrar no Acervo" (Literata 36/44; 30/38 no mobile), apoio (Hanken/Inter 17/28 `--muted`), botão "Entrar com Discord" (56px, `--accent`, texto `--accent-ink`, ícone SVG do Discord, raio 4px), aviso "Só usamos seu nome e avatar. Não pedimos senha." (14px `--muted`), filete, link "Problemas para entrar?" (`--accent`, sublinhado) com texto de ajuda.
- Estados: foco (outline 2px `--accent`, offset 3px); carregando ("Abrindo o Discord...", spinner e barra de progresso com `--marker` sobre `--line`, ecoando a ideia-assinatura); erro (caixa com borda `--danger`, ícone "!" + texto "Não foi possível entrar. Tente de novo." e botão "Tentar de novo"). 401 do servidor volta a esta tela.
- Tokens usados: `--bg` #EDF0EB, `--surface` #F8F9F6, `--text` #17202E, `--muted` #4B576A, `--accent` #2E3FA3, `--accent-ink` #FFFFFF, `--marker` #F4D35E, `--danger` #A32A2A, `--line` #C9D0CC, `--line-strong` #718096; `--radius-sm`, `--radius-md`, `--space-*`. Cabeçalho (marca "Acervo", botão de tema) e rodapé (com Chave única) iguais às outras telas.
- Fora do mockup: tema escuro da página (seguir tokens escuros da seção 3).
