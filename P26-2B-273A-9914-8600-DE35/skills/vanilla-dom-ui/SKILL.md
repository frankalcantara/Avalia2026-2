---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

Procedimento do **Agente 6 (Interface Vanilla)**. Escrito depois de construir
a tela deste projeto e testá-la em `localhost` e em produção.

## Regras Obrigatórias

1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto. Utilizar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-2B-273A-9914-8600-DE35`) no elemento `<footer>` da aplicação.

## A regra que não estava na lista: nunca `innerHTML` com texto de outra pessoa

Numa biblioteca colaborativa, o conteúdo foi escrito por outro estudante.
Montar HTML por concatenação transforma um resumo com `<script>` dentro em
código executando na sessão de quem abre a página — XSS armazenado, que é
pior que o refletido, porque atinge todo mundo que ler aquele item.

Em JavaScript puro a defesa é escolher a API certa, e ela já é a mais direta:

```js
const titulo = document.createElement("h3");
titulo.textContent = publicacao.titulo;   // texto, sempre
```

`textContent` nunca interpreta marcação. `createElement` mais `appendChild`
constrói a árvore sem passar por string. Se em algum momento você precisar de
`innerHTML`, pare e pergunte de onde veio aquele texto.

Vale também para atributos montados a partir de dados: `img.src` recebendo URL
de terceiro, por exemplo, precisa vir de um campo que o seu servidor montou, e
não de algo que o usuário digitou.

## Estado vem do servidor, não da memória da página

A tentação em Vanilla é guardar a lista numa variável e mexer nela: filtrar
com `.filter()`, ordenar com `.sort()`, incrementar o contador de votos na
mão. Funciona na demonstração e mente para quem usa.

- **Ordenar no cliente** só funciona enquanto ele tiver a lista inteira. Na
  primeira paginação, a "ordem por mais votados" passa a ordenar apenas a
  página atual.
- **Filtrar no cliente** nunca encontra o que não foi baixado.
- **Contador incrementado na mão** diverge do banco no instante em que outra
  pessoa votar.

Neste projeto, busca e ordenação vão para o servidor como `?q=` e saem do
`ORDER BY`. O botão de voto desabilitado vem de `jaVotei`, que é consulta ao
banco — por isso o estado sobrevive ao recarregamento, e sobreviveria mesmo se
a pessoa abrisse em outro computador.

## Busca dinâmica: duas coisas, não uma

Quase todo mundo implementa a primeira e esquece a segunda.

**Debounce** — esperar a pessoa parar de digitar, senão "javascript" dispara
dez requisições:

```js
function comAtraso(funcao, ms) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcao(...args), ms);
  };
}
campoBusca.addEventListener("input", comAtraso(carregarLista, 250));
```

**Ordem de chegada** — as respostas não voltam na ordem em que saíram. A de
"ja" pode chegar depois da de "javascript" e pintar a tela com o resultado
errado. O debounce reduz a chance e não resolve o problema. Numere os pedidos:

```js
let pedidoAtual = 0;
async function carregarLista() {
  const meuPedido = ++pedidoAtual;
  const dados = await buscar();
  if (meuPedido !== pedidoAtual) return;   // chegou atrasada, descarta
  desenhar(dados);
}
```

## Listas sem `innerHTML = ""`

Para trocar o conteúdo de uma lista: `elemento.replaceChildren()` limpa, e
montar os itens num `DocumentFragment` antes de anexar evita um recálculo de
layout por item.

## Área de transferência exige gesto humano

`navigator.clipboard.writeText()` só funciona em contexto seguro (HTTPS ou
`localhost`) **e** com ativação do usuário. Clique disparado por script falha
com `NotAllowedError`, e há navegadores que negam a permissão mesmo com
clique real.

Portanto o botão de copiar precisa de um plano B visível. Neste projeto, a
falha seleciona o texto e troca o rótulo para "Selecione e copie" — a pessoa
descobre o que fazer em vez de ficar olhando um botão que não responde:

```js
try {
  await navigator.clipboard.writeText(texto);
  botao.textContent = "Copiado";
} catch {
  botao.textContent = "Selecione e copie";
  // seleciona o bloco de conteúdo para a cópia manual
}
```

Essa diferença apareceu na prática: a mesma página copiou normalmente em
`localhost` e foi recusada num navegador embutido servindo o endereço HTTPS.

## Opções de `<select>` vêm do servidor

A lista de categorias é definida em um lugar só, no servidor, e viaja na
mesma resposta que lista as publicações. Repetir a lista no JavaScript criaria
duas fontes para manter em sincronia, e no dia em que divergissem o formulário
ofereceria uma opção que o servidor recusa.

## Acessibilidade mínima, que custa pouco

`<label for>` em todo campo; `role="status"` com `aria-live="polite"` nas
mensagens de estado, para que "Publicado." e a contagem de resultados sejam
anunciadas; `alt=""` em imagem decorativa, como o avatar ao lado do nome que
já está escrito em texto.

## Erro cometido e corrigido

Plural montado por concatenação dentro de template:
`` `publicaca${n === 1 ? "o" : "es"}` `` produziu **"publicacaes"** na tela.
Em português não dá para tratar plural como sufixo. Escolha a palavra inteira.

O defeito passou por duas revisões de código e só apareceu quando o texto
renderizado foi lido de verdade. Interface se testa lendo a tela, não o fonte.
