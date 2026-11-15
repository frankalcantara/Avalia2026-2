/*
 * Resumos & Snippets da Turma 2B — P26-2B-273A-9914-8600-DE35
 *
 * JavaScript puro, sem framework e sem dependencia externa.
 *
 * Divisao de responsabilidade com o servidor: este arquivo desenha e pede.
 * Ele nao decide quem e o autor de nada, nao decide se um voto vale, e nao
 * ordena a lista. Isso tudo mora nas Pages Functions e no D1, porque qualquer
 * regra escrita aqui e so uma sugestao — o navegador e do usuario e o codigo
 * pode ser alterado por quem abrir o devtools. O que esta aqui e conveniencia
 * para quem usa: desabilitar um botao que o servidor recusaria, mostrar o
 * estado certo, evitar uma requisicao inutil.
 */

(() => {
  "use strict";

  // ----------------------------------------------------------- referencias

  const $ = (id) => document.getElementById(id);

  const entrar          = $("entrar");
  const perfil          = $("perfil");
  const perfilAvatar    = $("perfil-avatar");
  const perfilNome      = $("perfil-nome");
  const sair            = $("sair");

  const formulario      = $("form-publicacao");
  const avisoLogin      = $("aviso-login");
  const campoTipo       = $("campo-tipo");
  const campoCategoria  = $("campo-categoria");
  const campoTitulo     = $("campo-titulo");
  const campoConteudo   = $("campo-conteudo");
  const contador        = $("contador");
  const botaoPublicar   = $("publicar");
  const formMensagem    = $("form-mensagem");

  const campoBusca      = $("campo-busca");
  const filtroCategoria = $("filtro-categoria");
  const listaEstado     = $("lista-estado");
  const lista           = $("lista");

  let autenticado = false;
  let categoriasCarregadas = false;

  /*
   * Contador de requisicoes de listagem. A busca dinamica dispara uma
   * requisicao a cada pausa na digitacao, e elas nao voltam necessariamente na
   * ordem em que sairam: uma resposta de "ja" pode chegar depois de uma de
   * "javascript" e sobrescrever a tela com o resultado errado. Guardamos o
   * numero do pedido e descartamos qualquer resposta que nao seja a do mais
   * recente.
   */
  let pedidoAtual = 0;

  // -------------------------------------------------------------- utilidades

  function mensagem(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.classList.remove("mensagem--erro", "mensagem--sucesso");
    if (tipo) elemento.classList.add(`mensagem--${tipo}`);
  }

  /** Espera a pessoa parar de digitar antes de chamar o servidor. */
  function comAtraso(funcao, milissegundos) {
    let temporizador;
    return (...argumentos) => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => funcao(...argumentos), milissegundos);
    };
  }

  function dataLegivel(texto) {
    const data = new Date(`${texto}Z`);
    if (Number.isNaN(data.getTime())) return "";
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  /** Le o corpo como JSON sem explodir quando a resposta nao for JSON. */
  async function corpoJson(resposta) {
    try {
      return await resposta.json();
    } catch {
      return {};
    }
  }

  // ------------------------------------------------------------------ sessao

  function aplicarSessao(dados) {
    autenticado = Boolean(dados.autenticado);

    entrar.classList.toggle("oculto", autenticado);
    perfil.classList.toggle("oculto", !autenticado);
    avisoLogin.classList.toggle("oculto", autenticado);

    if (autenticado) {
      perfilNome.textContent = dados.nome || "";
      perfilAvatar.src = dados.avatarUrl || "";
      perfilAvatar.alt = `Avatar de ${dados.nome || "usuário"}`;
    }

    // Formulario desabilitado para quem nao entrou. O servidor responderia 401
    // de qualquer forma; isso so evita a pessoa escrever um resumo inteiro
    // para descobrir no final que precisava estar logada.
    for (const campo of [campoTipo, campoCategoria, campoTitulo, campoConteudo, botaoPublicar]) {
      campo.disabled = !autenticado;
    }
  }

  async function carregarSessao() {
    try {
      const resposta = await fetch("/api/auth/eu", { headers: { Accept: "application/json" } });
      aplicarSessao(await corpoJson(resposta));
    } catch {
      aplicarSessao({ autenticado: false });
    }
  }

  sair.addEventListener("click", async () => {
    // POST, nao GET: com GET, uma tag <img> em qualquer site deslogaria quem
    // visitasse a pagina.
    await fetch("/api/auth/sair", { method: "POST" });
    window.location.reload();
  });

  // -------------------------------------------------------------- categorias

  function preencherCategorias(categorias) {
    if (categoriasCarregadas || !Array.isArray(categorias)) return;

    for (const categoria of categorias) {
      const opcaoForm = document.createElement("option");
      opcaoForm.value = categoria;
      opcaoForm.textContent = categoria;
      campoCategoria.appendChild(opcaoForm);

      const opcaoFiltro = document.createElement("option");
      opcaoFiltro.value = categoria;
      opcaoFiltro.textContent = categoria;
      filtroCategoria.appendChild(opcaoFiltro);
    }

    categoriasCarregadas = true;
  }

  // ------------------------------------------------------------------- copiar

  async function copiar(texto, botao) {
    const rotulo = botao.textContent;
    try {
      await navigator.clipboard.writeText(texto);
      botao.textContent = "Copiado";
    } catch {
      // navigator.clipboard so existe em contexto seguro (HTTPS ou localhost) e
      // pode ser recusado pela permissao do navegador. Em vez de falhar calado,
      // seleciona o texto para a pessoa copiar na mao.
      botao.textContent = "Selecione e copie";
      const bloco = botao.closest(".item").querySelector(".item__conteudo");
      const intervalo = document.createRange();
      intervalo.selectNodeContents(bloco);
      const selecao = window.getSelection();
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
    }
    setTimeout(() => { botao.textContent = rotulo; }, 1800);
  }

  // -------------------------------------------------------------------- votar

  async function votar(publicacao, botao, total) {
    botao.disabled = true;
    try {
      const resposta = await fetch(`/api/publicacoes/${publicacao.id}/voto`, { method: "POST" });
      const dados = await corpoJson(resposta);

      if (resposta.ok) {
        total.textContent = dados.totalVotos;
        const rotulo = botao.querySelector(".voto__rotulo");
        if (rotulo) rotulo.textContent = dados.totalVotos === 1 ? "voto" : "votos";
        botao.classList.add("voto--votado");
        botao.title = "Você já votou nesta publicação";
        return;
      }

      // 409 e a restricao UNIQUE do banco chegando ate aqui: a pessoa ja tinha
      // votado, possivelmente em outra aba. Nao e erro do sistema, entao a tela
      // so se corrige.
      if (resposta.status === 409) {
        botao.classList.add("voto--votado");
        botao.title = "Você já votou nesta publicação";
        return;
      }

      if (resposta.status === 401) {
        mensagem(listaEstado, "Entre com o Discord para votar.", "erro");
        botao.disabled = false;
        return;
      }

      mensagem(listaEstado, dados.erro || "Não foi possível votar.", "erro");
      botao.disabled = false;
    } catch {
      mensagem(listaEstado, "Sem conexão com o servidor.", "erro");
      botao.disabled = false;
    }
  }

  // ----------------------------------------------------------------- desenhar

  /*
   * Monta um item da lista.
   *
   * Tudo que veio do servidor entra por textContent ou por createElement.
   * Nada de innerHTML: o conteudo foi escrito por outro estudante, e montar
   * HTML por concatenacao transformaria um resumo com <script> dentro em
   * codigo executando na sessao de quem le a pagina.
   */
  function montarItem(publicacao) {
    const item = document.createElement("li");
    item.className = "item";

    // --- topo: titulo e etiquetas
    const topo = document.createElement("div");
    topo.className = "item__topo";

    const bloco = document.createElement("div");

    const titulo = document.createElement("h3");
    titulo.className = "item__titulo";
    titulo.textContent = publicacao.titulo;
    bloco.appendChild(titulo);

    const etiquetas = document.createElement("p");
    etiquetas.className = "item__etiquetas";

    const etiquetaTipo = document.createElement("span");
    etiquetaTipo.className = "etiqueta etiqueta--tipo";
    etiquetaTipo.textContent = publicacao.tipo;
    etiquetas.appendChild(etiquetaTipo);

    const etiquetaCategoria = document.createElement("span");
    etiquetaCategoria.className = "etiqueta";
    etiquetaCategoria.textContent = publicacao.categoria;
    etiquetas.appendChild(etiquetaCategoria);

    const quando = dataLegivel(publicacao.criadoEm);
    if (quando) {
      const etiquetaData = document.createElement("span");
      etiquetaData.className = "etiqueta";
      etiquetaData.textContent = quando;
      etiquetas.appendChild(etiquetaData);
    }

    bloco.appendChild(etiquetas);
    topo.appendChild(bloco);
    item.appendChild(topo);

    // --- autor
    const autor = document.createElement("p");
    autor.className = "item__autor";

    const avatar = document.createElement("img");
    avatar.src = publicacao.autor.avatarUrl;
    avatar.alt = "";
    avatar.width = 22;
    avatar.height = 22;
    avatar.loading = "lazy";
    autor.appendChild(avatar);

    const nome = document.createElement("span");
    nome.textContent = publicacao.souAutor
      ? `${publicacao.autor.nome} (você)`
      : publicacao.autor.nome;
    autor.appendChild(nome);
    item.appendChild(autor);

    // --- conteudo
    const conteudo = document.createElement("pre");
    conteudo.className = "item__conteudo";
    conteudo.textContent = publicacao.conteudo;
    item.appendChild(conteudo);

    // --- acoes
    const acoes = document.createElement("div");
    acoes.className = "item__acoes";

    const botaoVoto = document.createElement("button");
    botaoVoto.type = "button";
    botaoVoto.className = publicacao.jaVotei ? "voto voto--votado" : "voto";

    const seta = document.createElement("span");
    seta.textContent = "▲";
    seta.setAttribute("aria-hidden", "true");
    botaoVoto.appendChild(seta);

    const total = document.createElement("span");
    total.className = "voto__total";
    total.textContent = publicacao.totalVotos;
    botaoVoto.appendChild(total);

    const rotuloVoto = document.createElement("span");
    rotuloVoto.className = "voto__rotulo";
    rotuloVoto.textContent = publicacao.totalVotos === 1 ? "voto" : "votos";
    botaoVoto.appendChild(rotuloVoto);

    // Ja votou ou nao entrou: o botao fica inerte. Quem garante o voto unico
    // continua sendo a restricao UNIQUE no banco, nao este atributo.
    if (publicacao.jaVotei) {
      botaoVoto.disabled = true;
      botaoVoto.title = "Você já votou nesta publicação";
    } else if (!autenticado) {
      botaoVoto.disabled = true;
      botaoVoto.title = "Entre com o Discord para votar";
    } else {
      botaoVoto.addEventListener("click", () => votar(publicacao, botaoVoto, total));
    }

    acoes.appendChild(botaoVoto);

    const botaoCopiar = document.createElement("button");
    botaoCopiar.type = "button";
    botaoCopiar.className = "botao botao--discreto";
    botaoCopiar.textContent = "Copiar";
    botaoCopiar.addEventListener("click", () => copiar(publicacao.conteudo, botaoCopiar));
    acoes.appendChild(botaoCopiar);

    item.appendChild(acoes);
    return item;
  }

  function desenharLista(publicacoes) {
    lista.replaceChildren();

    if (!publicacoes.length) {
      mensagem(listaEstado, "Nenhuma publicação encontrada.");
      return;
    }

    const rotulo = publicacoes.length === 1 ? "publicação" : "publicações";
    mensagem(listaEstado, `${publicacoes.length} ${rotulo}.`);

    // Nada de .sort() aqui: a ordem por votos vem pronta do SQL. Reordenar no
    // cliente so funcionaria enquanto ele tivesse a lista inteira.
    const fragmento = document.createDocumentFragment();
    for (const publicacao of publicacoes) fragmento.appendChild(montarItem(publicacao));
    lista.appendChild(fragmento);
  }

  // ----------------------------------------------------------------- listagem

  async function carregarLista() {
    const meuPedido = ++pedidoAtual;

    const parametros = new URLSearchParams();
    const busca = campoBusca.value.trim();
    if (busca) parametros.set("q", busca);
    if (filtroCategoria.value) parametros.set("categoria", filtroCategoria.value);

    const consulta = parametros.toString();
    mensagem(listaEstado, "Carregando…");

    try {
      const resposta = await fetch(`/api/publicacoes${consulta ? `?${consulta}` : ""}`, {
        headers: { Accept: "application/json" },
      });

      // Chegou atrasada: ja existe um pedido mais novo. Descarta.
      if (meuPedido !== pedidoAtual) return;

      if (!resposta.ok) {
        mensagem(listaEstado, "Não foi possível carregar a biblioteca.", "erro");
        return;
      }

      const dados = await corpoJson(resposta);
      preencherCategorias(dados.categorias);
      desenharLista(dados.publicacoes || []);
    } catch {
      if (meuPedido !== pedidoAtual) return;
      mensagem(listaEstado, "Sem conexão com o servidor.", "erro");
    }
  }

  // Busca dinamica: 250 ms depois da ultima tecla.
  campoBusca.addEventListener("input", comAtraso(carregarLista, 250));
  filtroCategoria.addEventListener("change", carregarLista);

  // ------------------------------------------------------------------ publicar

  campoConteudo.addEventListener("input", () => {
    contador.textContent = campoConteudo.value.length;
  });

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!autenticado) return;

    botaoPublicar.disabled = true;
    mensagem(formMensagem, "Publicando…");

    try {
      const resposta = await fetch("/api/publicacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: campoTipo.value,
          categoria: campoCategoria.value,
          titulo: campoTitulo.value,
          conteudo: campoConteudo.value,
          // Nenhum campo de autor vai daqui. O servidor usa a sessao, e
          // ignoraria um autor_id enviado no corpo.
        }),
      });

      const dados = await corpoJson(resposta);

      if (resposta.status === 201) {
        formulario.reset();
        contador.textContent = "0";
        mensagem(formMensagem, "Publicado.", "sucesso");
        await carregarLista();
      } else if (resposta.status === 401) {
        mensagem(formMensagem, "Sua sessão expirou. Entre de novo.", "erro");
        await carregarSessao();
      } else {
        mensagem(formMensagem, dados.erro || "Não foi possível publicar.", "erro");
      }
    } catch {
      mensagem(formMensagem, "Sem conexão com o servidor.", "erro");
    } finally {
      botaoPublicar.disabled = !autenticado;
    }
  });

  // -------------------------------------------------------------------- inicio

  // A sessao primeiro: a listagem precisa saber se ha alguem logado para
  // desenhar os botoes de voto no estado certo.
  carregarSessao().then(carregarLista);
})();
