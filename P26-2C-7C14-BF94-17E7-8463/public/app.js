(() => {
  "use strict";

  const COLUNAS = ["a-fazer", "em-execucao", "concluido"];
  const PRIORIDADES = ["baixa", "media", "alta"];
  const TIPO_DADOS_CARTAO = "text/plain";
  const TITULO_MAX_CARACTERES = 120;
  const TEMA_CHAVE = "quadro-kanban:tema";

  const NOMES_COLUNA = {
    "a-fazer": "A Fazer",
    "em-execucao": "Em Execução",
    concluido: "Concluído",
  };

  const prioridadeTexto = {
    baixa: "baixa",
    media: "média",
    alta: "alta",
  };

  let usuario = null;
  let cartoes = [];
  let idArrastado = null;
  let colunaDestacada = null;
  let operacaoEmAndamento = false;
  let mensagemTimer = null;

  const perfilEl = document.getElementById("discordProfile");
  const avatarEl = document.getElementById("discordAvatar");
  const avatarFallbackEl = document.getElementById("discordAvatarFallback");
  const nomeEl = document.getElementById("discordUserName");
  const userIdEl = document.getElementById("discordUserId");
  const loginLinkEl = document.getElementById("discordLoginLink");
  const logoutBtnEl = document.getElementById("discordLogoutBtn");
  const statusEl = document.getElementById("appStatus");
  const loginPromptEl = document.getElementById("loginPrompt");
  const boardAreaEl = document.getElementById("boardArea");
  const boardTotalEl = document.getElementById("boardTotal");
  const todayLabelEl = document.getElementById("todayLabel");
  const formCriarEl = document.getElementById("createCardForm");
  const inputNovoTituloEl = document.getElementById("novoTitulo");
  const selectNovaPrioridadeEl = document.getElementById("novaPrioridade");
  const botaoCriarEl = document.getElementById("criarCartaoBtn");
  const quadroEl = document.querySelector(".kanban-board");
  const temaBtnEl = document.getElementById("themeToggle");
  const temaTextoEl = document.getElementById("themeToggleText");

  /* ------------------------------------------------------------------ */
  /* Tema claro/escuro                                                   */
  /* ------------------------------------------------------------------ */

  function lerTemaSalvo() {
    try {
      const valor = window.localStorage.getItem(TEMA_CHAVE);
      return valor === "dark" || valor === "light" ? valor : null;
    } catch {
      return null;
    }
  }

  function salvarTema(tema) {
    try {
      window.localStorage.setItem(TEMA_CHAVE, tema);
    } catch {
      /* Armazenamento indisponível: o tema continua valendo nesta página. */
    }
  }

  function temaDoSistema() {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  }

  function aplicarTema(tema, opcoes = {}) {
    const alvo = tema === "dark" ? "dark" : "light";
    const escuro = alvo === "dark";

    document.documentElement.setAttribute("data-theme", alvo);

    if (temaBtnEl) {
      const rotulo = escuro ? "Ativar modo claro" : "Ativar modo escuro";
      temaBtnEl.setAttribute("aria-pressed", escuro ? "true" : "false");
      temaBtnEl.setAttribute("aria-label", rotulo);
      temaBtnEl.title = rotulo;
      if (temaTextoEl) temaTextoEl.textContent = rotulo;
    }

    if (opcoes.persistir) salvarTema(alvo);
  }

  function alternarTema() {
    const atual =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";

    aplicarTema(atual === "dark" ? "light" : "dark", { persistir: true });
  }

  function observarTemaDoSistema() {
    let consulta = null;

    try {
      consulta = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return;
    }

    if (!consulta) return;

    const aoMudar = (evento) => {
      // Uma escolha salva sempre vence a preferência do sistema.
      if (lerTemaSalvo()) return;
      aplicarTema(evento.matches ? "dark" : "light");
    };

    if (typeof consulta.addEventListener === "function") {
      consulta.addEventListener("change", aoMudar);
    } else if (typeof consulta.addListener === "function") {
      consulta.addListener(aoMudar);
    }
  }

  aplicarTema(lerTemaSalvo() || temaDoSistema());
  observarTemaDoSistema();

  /* ------------------------------------------------------------------ */
  /* Mensagens e estado de carregamento                                  */
  /* ------------------------------------------------------------------ */

  function definirMensagem(texto, tipo = "info", opcoes = {}) {
    const { ariaBusy = false, autoLimpar = false } = opcoes;

    if (mensagemTimer !== null) {
      window.clearTimeout(mensagemTimer);
      mensagemTimer = null;
    }

    if (!statusEl) return;

    if (!texto) {
      statusEl.textContent = "";
      statusEl.className = "app-status";
      statusEl.setAttribute("role", "status");
      statusEl.setAttribute("aria-live", "polite");
      statusEl.hidden = true;
      statusEl.removeAttribute("aria-busy");
      return;
    }

    const erro = tipo === "erro";

    statusEl.className = "app-status app-status--" + tipo;
    statusEl.setAttribute("role", erro ? "alert" : "status");
    statusEl.setAttribute("aria-live", erro ? "assertive" : "polite");

    if (ariaBusy) {
      statusEl.setAttribute("aria-busy", "true");
    } else {
      statusEl.removeAttribute("aria-busy");
    }

    statusEl.hidden = false;
    statusEl.textContent = texto;

    if (autoLimpar) {
      mensagemTimer = window.setTimeout(() => {
        mensagemTimer = null;
        definirMensagem("", "info");
      }, 4000);
    }
  }

  function mensagemPadrao(status) {
    switch (status) {
      case 400:
        return "Não foi possível concluir a ação: os dados enviados são inválidos.";
      case 401:
        return "Sua sessão expirou. Entre novamente com o Discord.";
      case 404:
        return "O cartão não foi encontrado. Atualize o quadro e tente novamente.";
      case 500:
        return "O servidor encontrou um erro. Tente novamente em instantes.";
      default:
        return "Não foi possível concluir a ação. Tente novamente.";
    }
  }

  async function chamarApi(caminho, opcoes = {}) {
    const init = {
      method: opcoes.metodo || "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };

    if (opcoes.corpo !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opcoes.corpo);
    }

    let resposta;
    try {
      resposta = await fetch(caminho, init);
    } catch {
      return {
        ok: false,
        status: 0,
        dados: null,
        mensagem:
          "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      };
    }

    let dados = null;
    try {
      const texto = await resposta.text();
      if (texto) dados = JSON.parse(texto);
    } catch {
      dados = null;
    }

    const mensagemServidor =
      dados && typeof dados.message === "string" ? dados.message.trim() : "";

    return {
      ok: resposta.ok,
      status: resposta.status,
      dados,
      mensagem: mensagemServidor || mensagemPadrao(resposta.status),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Sessão e cabeçalho                                                  */
  /* ------------------------------------------------------------------ */

  function normalizarUsuario(bruto) {
    if (!bruto || typeof bruto !== "object") return null;

    const userId = String(bruto.userId || bruto.user_id || "").trim();
    if (!userId) return null;

    return {
      userId,
      username:
        typeof bruto.username === "string" ? bruto.username.trim() : "",
      avatar: typeof bruto.avatar === "string" ? bruto.avatar.trim() : "",
    };
  }

  function urlAvatar(dados) {
    const avatar = dados.avatar;
    if (!avatar) return null;

    // O backend pode devolver a URL completa do Discord (fluxo OAuth2 real).
    if (/^https?:\/\//i.test(avatar)) {
      return avatar.includes("?") ? avatar : avatar + "?size=64";
    }

    // Caso o avatar venha apenas como hash, monta a URL pedida.
    return (
      "https://cdn.discordapp.com/avatars/" +
      encodeURIComponent(dados.userId) +
      "/" +
      encodeURIComponent(avatar) +
      ".png?size=64"
    );
  }

  function mostrarInicial(nome) {
    const letra = (nome.trim().charAt(0) || "?").toLocaleUpperCase("pt-BR");

    if (avatarEl) {
      avatarEl.alt = "";
      avatarEl.hidden = true;
    }
    if (avatarFallbackEl) {
      avatarFallbackEl.textContent = letra;
      avatarFallbackEl.hidden = false;
    }
  }

  function mostrarPerfil(dados) {
    usuario = dados;

    if (perfilEl) perfilEl.hidden = false;
    if (logoutBtnEl) logoutBtnEl.hidden = false;
    if (loginLinkEl) loginLinkEl.hidden = true;
    if (boardAreaEl) boardAreaEl.hidden = false;
    if (loginPromptEl) loginPromptEl.hidden = true;

    const nome = dados.username || "Usuário Discord";
    if (nomeEl) nomeEl.textContent = nome;
    if (userIdEl) userIdEl.textContent = "ID " + dados.userId;

    const url = urlAvatar(dados);
    if (url && avatarEl) {
      if (avatarFallbackEl) avatarFallbackEl.hidden = true;
      avatarEl.alt = "Foto de perfil de " + nome + " no Discord";
      avatarEl.hidden = false;
      avatarEl.src = url;
    } else {
      mostrarInicial(nome);
    }
  }

  function mostrarNaoLogado() {
    usuario = null;
    cartoes = [];

    if (perfilEl) perfilEl.hidden = true;
    if (logoutBtnEl) {
      logoutBtnEl.hidden = true;
      logoutBtnEl.disabled = false;
      logoutBtnEl.textContent = "Sair";
    }
    if (loginLinkEl) loginLinkEl.hidden = false;
    if (boardAreaEl) boardAreaEl.hidden = true;
    if (loginPromptEl) loginPromptEl.hidden = false;

    renderizarQuadro();
  }

  function perderSessao() {
    operacaoEmAndamento = false;
    mostrarNaoLogado();
    definirMensagem(
      "Sua sessão expirou. Entre novamente com o Discord.",
      "erro"
    );
  }

  async function aoSair() {
    if (logoutBtnEl && logoutBtnEl.disabled) return;

    if (logoutBtnEl) {
      logoutBtnEl.disabled = true;
      logoutBtnEl.textContent = "Saindo...";
    }
    definirMensagem("Encerrando sessão...", "carregando", { ariaBusy: true });

    const resultado = await chamarApi("/api/auth/logout", { metodo: "POST" });

    if (!resultado.ok) {
      if (logoutBtnEl) {
        logoutBtnEl.disabled = false;
        logoutBtnEl.textContent = "Sair";
      }
      definirMensagem(resultado.mensagem, "erro");
      return;
    }

    mostrarNaoLogado();
    definirMensagem("Você saiu da sua conta.", "sucesso", {
      autoLimpar: true,
    });
  }

  function aoFalharAvatar() {
    if (!usuario) return;
    mostrarInicial(usuario.username || "Usuário Discord");
  }

  /* ------------------------------------------------------------------ */
  /* Dados                                                               */
  /* ------------------------------------------------------------------ */

  function normalizarCartao(bruto) {
    if (!bruto || typeof bruto !== "object") return null;

    const id = Number(bruto.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;

    const titulo = typeof bruto.titulo === "string" ? bruto.titulo : "";
    if (!titulo.trim()) return null;

    const numeroPosicao = Number(bruto.posicao);

    return {
      id,
      titulo,
      prioridade: PRIORIDADES.includes(bruto.prioridade)
        ? bruto.prioridade
        : "media",
      coluna: COLUNAS.includes(bruto.coluna) ? bruto.coluna : COLUNAS[0],
      posicao:
        Number.isInteger(numeroPosicao) && numeroPosicao >= 0
          ? numeroPosicao
          : 0,
    };
  }

  function extrairCartoes(dados) {
    const lista = dados && Array.isArray(dados.cards) ? dados.cards : [];
    return lista.map(normalizarCartao).filter(Boolean);
  }

  function cartoesDaColuna(coluna) {
    return cartoes
      .filter((cartao) => cartao.coluna === coluna)
      .sort((a, b) => a.posicao - b.posicao || a.id - b.id);
  }

  function renumerarColuna(coluna) {
    cartoesDaColuna(coluna).forEach((cartao, indice) => {
      cartao.posicao = indice;
    });
  }

  function moverLocalmente(cartao, colunaDestino, indiceDestino) {
    const colunaOrigem = cartao.coluna;

    const listaDestino = cartoesDaColuna(colunaDestino).filter(
      (item) => item.id !== cartao.id
    );
    const indice = Math.max(0, Math.min(indiceDestino, listaDestino.length));
    listaDestino.splice(indice, 0, cartao);
    listaDestino.forEach((item, novaPosicao) => {
      item.coluna = colunaDestino;
      item.posicao = novaPosicao;
    });

    if (colunaOrigem !== colunaDestino) {
      cartoesDaColuna(colunaOrigem).forEach((item, novaPosicao) => {
        item.posicao = novaPosicao;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Requisições de cartões                                              */
  /* ------------------------------------------------------------------ */

  async function carregarCartoes(opcoes = {}) {
    const silencioso = Boolean(opcoes.silencioso);

    if (!silencioso) {
      definirMensagem("Carregando cartões...", "carregando", {
        ariaBusy: true,
      });
    }

    const resultado = await chamarApi("/api/cards");

    if (resultado.status === 401) {
      perderSessao();
      return;
    }

    if (!resultado.ok) {
      definirMensagem(resultado.mensagem, "erro");
      return;
    }

    cartoes = extrairCartoes(resultado.dados);
    renderizarQuadro();

    if (!silencioso) definirMensagem("", "info");
  }

  async function sincronizarCartoes() {
    const resultado = await chamarApi("/api/cards");

    if (resultado.status === 401) {
      perderSessao();
      return;
    }

    if (!resultado.ok) return;

    cartoes = extrairCartoes(resultado.dados);
    renderizarQuadro();
  }

  async function aoCriarCartao(event) {
    event.preventDefault();

    if (!usuario) {
      perderSessao();
      return;
    }
    if (operacaoEmAndamento) return;

    const titulo = inputNovoTituloEl
      ? inputNovoTituloEl.value.trim()
      : "";
    const prioridade = selectNovaPrioridadeEl
      ? selectNovaPrioridadeEl.value
      : "media";

    if (!titulo) {
      definirMensagem("Digite um título para o cartão.", "erro");
      if (inputNovoTituloEl) inputNovoTituloEl.focus();
      return;
    }

    if (titulo.length > TITULO_MAX_CARACTERES) {
      definirMensagem(
        "O título deve ter no máximo " +
          TITULO_MAX_CARACTERES +
          " caracteres.",
        "erro"
      );
      return;
    }

    if (!PRIORIDADES.includes(prioridade)) {
      definirMensagem("Escolha uma prioridade válida.", "erro");
      return;
    }

    operacaoEmAndamento = true;
    if (botaoCriarEl) {
      botaoCriarEl.disabled = true;
      botaoCriarEl.textContent = "Adicionando...";
    }
    definirMensagem("Criando cartão...", "carregando", { ariaBusy: true });

    const resultado = await chamarApi("/api/cards", {
      metodo: "POST",
      corpo: { titulo, prioridade, coluna: "a-fazer" },
    });

    operacaoEmAndamento = false;
    if (botaoCriarEl) {
      botaoCriarEl.disabled = false;
      botaoCriarEl.textContent = "Adicionar cartão";
    }

    if (resultado.status === 401) {
      perderSessao();
      return;
    }

    if (!resultado.ok) {
      definirMensagem(resultado.mensagem, "erro");
      return;
    }

    const novo =
      resultado.dados && resultado.dados.card
        ? normalizarCartao(resultado.dados.card)
        : null;

    if (novo) {
      cartoes.push(novo);
      renderizarQuadro();
    } else {
      await carregarCartoes({ silencioso: true });
    }

    if (formCriarEl) formCriarEl.reset();
    if (selectNovaPrioridadeEl) selectNovaPrioridadeEl.value = "media";
    if (inputNovoTituloEl) inputNovoTituloEl.focus();

    definirMensagem("Cartão criado em A Fazer.", "sucesso", {
      autoLimpar: true,
    });
  }

  function bloquearFormulario(form, bloquear, textoBotao) {
    form.querySelectorAll("input, select, button").forEach((campo) => {
      campo.disabled = bloquear;
    });

    const botao = form.querySelector('button[type="submit"]');
    if (botao && textoBotao) botao.textContent = textoBotao;
  }

  async function salvarEdicao(cartao, tituloBruto, prioridade, form) {
    if (operacaoEmAndamento) return;

    const titulo = tituloBruto.trim();
    if (!titulo) {
      definirMensagem("O título não pode ficar vazio.", "erro");
      return;
    }

    operacaoEmAndamento = true;
    bloquearFormulario(form, true, "Salvando...");
    definirMensagem("Salvando alterações...", "carregando", { ariaBusy: true });

    const resultado = await chamarApi("/api/cards/" + cartao.id, {
      metodo: "PATCH",
      corpo: { titulo, prioridade },
    });

    operacaoEmAndamento = false;

    if (resultado.status === 401) {
      perderSessao();
      return;
    }

    if (!resultado.ok) {
      bloquearFormulario(form, false, "Salvar");
      definirMensagem(resultado.mensagem, "erro");
      return;
    }

    const atualizado =
      resultado.dados && resultado.dados.card
        ? normalizarCartao(resultado.dados.card)
        : null;

    const indice = cartoes.findIndex((item) => item.id === cartao.id);
    if (indice >= 0) {
      if (atualizado) {
        cartoes[indice] = atualizado;
      } else {
        cartoes[indice].titulo = titulo;
        cartoes[indice].prioridade = prioridade;
      }
    }

    renderizarQuadro();
    definirMensagem("Cartão atualizado.", "sucesso", { autoLimpar: true });
    focarCartao(cartao.id, "editar");
  }

  function abrirEdicao(elemento, cartao) {
    if (operacaoEmAndamento) return;

    const form = document.createElement("form");
    form.className = "card-edit-form";

    const campoTitulo = document.createElement("label");
    campoTitulo.className = "field";
    const rotuloTitulo = document.createElement("span");
    rotuloTitulo.className = "field-label";
    rotuloTitulo.textContent = "Título";
    const inputTitulo = document.createElement("input");
    inputTitulo.className = "field-input";
    inputTitulo.type = "text";
    inputTitulo.maxLength = TITULO_MAX_CARACTERES;
    inputTitulo.required = true;
    inputTitulo.autocomplete = "off";
    inputTitulo.value = cartao.titulo;
    campoTitulo.append(rotuloTitulo, inputTitulo);

    const campoPrioridade = document.createElement("label");
    campoPrioridade.className = "field";
    const rotuloPrioridade = document.createElement("span");
    rotuloPrioridade.className = "field-label";
    rotuloPrioridade.textContent = "Prioridade";
    const selectPrioridade = document.createElement("select");
    selectPrioridade.className = "field-input";

    PRIORIDADES.forEach((valor) => {
      const opcao = document.createElement("option");
      opcao.value = valor;
      opcao.textContent = prioridadeTexto[valor];
      if (valor === cartao.prioridade) opcao.selected = true;
      selectPrioridade.appendChild(opcao);
    });

    campoPrioridade.append(rotuloPrioridade, selectPrioridade);

    const acoes = document.createElement("div");
    acoes.className = "card-edit-actions";

    const botaoSalvar = document.createElement("button");
    botaoSalvar.type = "submit";
    botaoSalvar.className = "primary-btn";
    botaoSalvar.textContent = "Salvar";

    const botaoCancelar = document.createElement("button");
    botaoCancelar.type = "button";
    botaoCancelar.className = "card-action";
    botaoCancelar.textContent = "Cancelar";
    botaoCancelar.setAttribute(
      "aria-label",
      "Cancelar edição do cartão: " + cartao.titulo
    );
    botaoCancelar.addEventListener("click", () => renderizarQuadro());

    acoes.append(botaoSalvar, botaoCancelar);
    form.append(campoTitulo, campoPrioridade, acoes);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await salvarEdicao(cartao, inputTitulo.value, selectPrioridade.value, form);
    });

    // Mantém o título visível durante a edição, para o cartão continuar
    // identificável no quadro.
    const tituloVisivel = document.createElement("h3");
    tituloVisivel.className = "kanban-card-title";
    tituloVisivel.textContent = cartao.titulo;

    elemento.draggable = false;
    elemento.classList.add("is-editing");
    elemento.replaceChildren(tituloVisivel, form);
    inputTitulo.focus();
    inputTitulo.select();
  }

  async function excluirCartao(cartao, opcoes = {}) {
    if (operacaoEmAndamento) return;

    operacaoEmAndamento = true;
    definirMensagem("Apagando cartão...", "carregando", { ariaBusy: true });

    const resultado = await chamarApi("/api/cards/" + cartao.id, {
      metodo: "DELETE",
    });

    operacaoEmAndamento = false;

    if (resultado.status === 401) {
      perderSessao();
      return;
    }

    if (!resultado.ok) {
      renderizarQuadro();
      definirMensagem(resultado.mensagem, "erro");
      return;
    }

    cartoes = cartoes.filter((item) => item.id !== cartao.id);
    renumerarColuna(cartao.coluna);
    renderizarQuadro();

    definirMensagem("Cartão apagado.", "sucesso", { autoLimpar: true });

    // Quem apagou pelo teclado perde o botão de confirmação: devolve o foco
    // para o formulário de criação, em vez de mandar o foco para o início.
    if (opcoes.viaTeclado && inputNovoTituloEl) {
      inputNovoTituloEl.focus();
    }

    await sincronizarCartoes();
  }

  function pedirConfirmacaoExclusao(elemento, cartao) {
    if (operacaoEmAndamento || elemento.querySelector(".card-confirm")) {
      return;
    }

    const grupo = document.createElement("div");
    grupo.className = "card-confirm";

    const texto = document.createElement("span");
    texto.className = "card-confirm-text";
    texto.textContent = "Apagar este cartão?";

    const botaoConfirmar = document.createElement("button");
    botaoConfirmar.type = "button";
    botaoConfirmar.className = "card-action card-action--danger";
    botaoConfirmar.textContent = "Confirmar";
    botaoConfirmar.setAttribute(
      "aria-label",
      "Confirmar exclusão do cartão: " + cartao.titulo
    );

    const botaoCancelar = document.createElement("button");
    botaoCancelar.type = "button";
    botaoCancelar.className = "card-action";
    botaoCancelar.textContent = "Cancelar";
    botaoCancelar.setAttribute(
      "aria-label",
      "Cancelar exclusão do cartão: " + cartao.titulo
    );
    botaoCancelar.addEventListener("click", () => renderizarQuadro());

    botaoConfirmar.addEventListener("click", async (evento) => {
      const viaTeclado = evento.detail === 0;
      botaoConfirmar.disabled = true;
      botaoCancelar.disabled = true;
      await excluirCartao(cartao, { viaTeclado });
    });

    grupo.append(texto, botaoConfirmar, botaoCancelar);
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Confirmação de exclusão");

    const acoes = elemento.querySelector(".card-actions");
    if (acoes) {
      acoes.replaceWith(grupo);
    } else {
      elemento.appendChild(grupo);
    }

    // Sem isso, o foco cai no <body> quando os botões do cartão são
    // substituídos. Vai para "Cancelar" (ação segura) para o teclado seguir.
    botaoCancelar.focus();
  }

  function aoClicarNoQuadro(event) {
    const alvo = event.target;
    if (!(alvo instanceof Element)) return;

    const botao = alvo.closest("button[data-action]");
    if (!botao) return;

    const elemento = botao.closest(".kanban-card");
    if (!elemento) return;

    const id = Number(elemento.dataset.id);
    const cartao = cartoes.find((item) => item.id === id);
    if (!cartao) return;

    const acao = botao.getAttribute("data-action");
    if (acao === "editar") {
      abrirEdicao(elemento, cartao);
    } else if (acao === "apagar") {
      pedirConfirmacaoExclusao(elemento, cartao);
    } else if (acao === "mover-esquerda") {
      moverCartaoPorPasso(cartao, -1, acao);
    } else if (acao === "mover-direita") {
      moverCartaoPorPasso(cartao, 1, acao);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Renderização                                                        */
  /* ------------------------------------------------------------------ */

  function criarBotaoAcao(acao, texto, rotulo, extra, desabilitado) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = extra ? "card-action " + extra : "card-action";
    botao.dataset.action = acao;
    botao.textContent = texto;
    botao.setAttribute("aria-label", rotulo);
    botao.disabled = Boolean(desabilitado);
    return botao;
  }

  function criarElementoCartao(cartao) {
    const item = document.createElement("li");
    item.className = "kanban-card";
    item.dataset.id = String(cartao.id);
    item.dataset.prioridade = cartao.prioridade;
    item.draggable = true;
    item.tabIndex = -1;
    item.title = "Arraste para mover de coluna ou reordenar";

    const titulo = document.createElement("h3");
    titulo.className = "kanban-card-title";
    titulo.id = "cartao-titulo-" + cartao.id;
    titulo.textContent = cartao.titulo;

    const meta = document.createElement("div");
    meta.className = "kanban-card-meta";

    const rotulo = document.createElement("span");
    rotulo.className = "priority-label";
    rotulo.textContent = "prioridade";

    const textoPrioridade =
      prioridadeTexto[cartao.prioridade] || cartao.prioridade;
    const pill = document.createElement("span");
    pill.className = "priority-pill priority-pill--" + cartao.prioridade;
    pill.textContent = textoPrioridade;
    pill.setAttribute("aria-label", "Prioridade " + textoPrioridade);

    meta.append(rotulo, pill);

    const indiceColuna = COLUNAS.indexOf(cartao.coluna);
    const destinoEsquerda = COLUNAS[indiceColuna - 1];
    const destinoDireita = COLUNAS[indiceColuna + 1];

    const botaoEsquerda = criarBotaoAcao(
      "mover-esquerda",
      "← Mover",
      "Mover para a esquerda",
      "card-action--move",
      !destinoEsquerda
    );
    botaoEsquerda.setAttribute("aria-describedby", titulo.id);
    botaoEsquerda.title = destinoEsquerda
      ? "Mover para " + NOMES_COLUNA[destinoEsquerda]
      : "Este cartão já está na primeira coluna";

    const botaoDireita = criarBotaoAcao(
      "mover-direita",
      "Mover →",
      "Mover para a direita",
      "card-action--move",
      !destinoDireita
    );
    botaoDireita.setAttribute("aria-describedby", titulo.id);
    botaoDireita.title = destinoDireita
      ? "Mover para " + NOMES_COLUNA[destinoDireita]
      : "Este cartão já está na última coluna";

    const botaoEditar = criarBotaoAcao(
      "editar",
      "Editar",
      "Editar cartão: " + cartao.titulo
    );

    const botaoApagar = criarBotaoAcao(
      "apagar",
      "Apagar",
      "Apagar cartão: " + cartao.titulo,
      "card-action--danger"
    );

    const acoes = document.createElement("div");
    acoes.className = "card-actions";
    acoes.append(botaoEsquerda, botaoDireita, botaoEditar, botaoApagar);

    item.append(titulo, meta, acoes);
    return item;
  }

  function renderizarQuadro() {
    COLUNAS.forEach((coluna) => {
      const lista = document.querySelector(
        '.card-list[data-column="' + coluna + '"]'
      );
      if (!lista) return;

      const itens = cartoesDaColuna(coluna);
      const fragmento = document.createDocumentFragment();

      itens.forEach((cartao) => {
        fragmento.appendChild(criarElementoCartao(cartao));
      });

      if (itens.length === 0) {
        const vazio = document.createElement("li");
        vazio.className = "column-empty";
        vazio.textContent = "Nenhuma tarefa por aqui.";
        fragmento.appendChild(vazio);
      }

      lista.replaceChildren(fragmento);
    });

    document.querySelectorAll("[data-count]").forEach((contador) => {
      const coluna = contador.getAttribute("data-count");
      const total = cartoesDaColuna(coluna).length;
      contador.textContent = String(total);
    });

    document.querySelectorAll("[data-count-label]").forEach((rotulo) => {
      const coluna = rotulo.getAttribute("data-count-label");
      const total = cartoesDaColuna(coluna).length;
      rotulo.textContent = total + (total === 1 ? " tarefa" : " tarefas");
    });

    if (boardTotalEl) boardTotalEl.textContent = String(cartoes.length);
  }

  function renderizarData() {
    if (!todayLabelEl) return;

    const texto = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());

    todayLabelEl.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function focarCartao(id, acao) {
    const elemento = document.querySelector(
      '.kanban-card[data-id="' + id + '"]'
    );
    if (!elemento) return;

    const tentativas = [acao, "mover-esquerda", "mover-direita", "editar"];

    for (const nome of tentativas) {
      if (!nome) continue;
      const botao = elemento.querySelector(
        'button[data-action="' + nome + '"]'
      );
      if (botao && !botao.disabled) {
        botao.focus();
        return;
      }
    }

    elemento.focus();
  }

  /* ------------------------------------------------------------------ */
  /* Arrastar e soltar                                                   */
  /* ------------------------------------------------------------------ */

  function elementoDaColuna(alvo) {
    return alvo instanceof Element ? alvo.closest(".kanban-column") : null;
  }

  function elementoDoCartao(alvo) {
    return alvo instanceof Element ? alvo.closest(".kanban-card") : null;
  }

  function destacarColuna(coluna) {
    if (colunaDestacada === coluna) return;

    if (colunaDestacada) {
      colunaDestacada.classList.remove("is-drag-over");
    }

    colunaDestacada = coluna;
    coluna.classList.add("is-drag-over");
  }

  function limparDestaques() {
    document
      .querySelectorAll(".kanban-column.is-drag-over")
      .forEach((coluna) => {
        coluna.classList.remove("is-drag-over");
      });
    colunaDestacada = null;
  }

  function iniciarArrasto(event) {
    if (operacaoEmAndamento) return;

    const alvo = event.target;
    if (alvo instanceof Element && alvo.closest(".card-edit-form")) return;

    const elemento = elementoDoCartao(alvo);
    if (!elemento) return;

    const id = Number(elemento.dataset.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;

    idArrastado = id;
    elemento.classList.add("is-dragging");

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setData(TIPO_DADOS_CARTAO, String(id));
      } catch {
        /* alguns navegadores restringem o DataTransfer em testes */
      }
    }
  }

  function permitirSoltura(event) {
    const coluna = elementoDaColuna(event.target);
    if (!coluna || operacaoEmAndamento) return;

    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    destacarColuna(coluna);
  }

  function sairDaColuna(event) {
    const coluna = elementoDaColuna(event.target);
    if (!coluna) return;

    const relacionado = event.relatedTarget;
    if (relacionado instanceof Node && coluna.contains(relacionado)) return;

    coluna.classList.remove("is-drag-over");
    if (colunaDestacada === coluna) {
      colunaDestacada = null;
    }
  }

  function finalizarArrasto() {
    idArrastado = null;

    document.querySelectorAll(".kanban-card.is-dragging").forEach((cartao) => {
      cartao.classList.remove("is-dragging");
    });

    limparDestaques();
  }

  /**
   * Único ponto de movimentação: usado pelo arrastar e soltar e pelos botões
   * de teclado. Sempre persiste com PATCH /api/cards/:id.
   */
  async function moverCartao(cartao, colunaDestino, indiceDestino, opcoes = {}) {
    if (!cartao || !usuario) return;
    if (operacaoEmAndamento) return;
    if (!COLUNAS.includes(colunaDestino)) return;

    const acaoFoco = typeof opcoes.foco === "string" ? opcoes.foco : "";
    const id = cartao.id;

    const listaDestino = cartoesDaColuna(colunaDestino).filter(
      (item) => item.id !== id
    );
    const indice = Math.max(0, Math.min(indiceDestino, listaDestino.length));

    if (cartao.coluna === colunaDestino && cartao.posicao === indice) return;

    const estadoAnterior = cartoes.map((item) => ({ ...item }));

    moverLocalmente(cartao, colunaDestino, indice);
    renderizarQuadro();

    operacaoEmAndamento = true;
    definirMensagem("Movendo cartão...", "carregando", { ariaBusy: true });

    const resultado = await chamarApi("/api/cards/" + id, {
      metodo: "PATCH",
      corpo: { coluna: colunaDestino, posicao: cartao.posicao },
    });

    operacaoEmAndamento = false;

    if (resultado.status === 401) {
      perderSessao();
      return;
    }

    if (!resultado.ok) {
      cartoes = estadoAnterior;
      renderizarQuadro();
      definirMensagem(resultado.mensagem, "erro");
      if (acaoFoco) focarCartao(id, acaoFoco);
      return;
    }

    const atualizado =
      resultado.dados && resultado.dados.card
        ? normalizarCartao(resultado.dados.card)
        : null;

    if (atualizado) {
      const indiceAtual = cartoes.findIndex(
        (item) => item.id === atualizado.id
      );
      if (indiceAtual >= 0) {
        cartoes[indiceAtual] = atualizado;
      } else {
        cartoes.push(atualizado);
      }
    }

    renderizarQuadro();
    definirMensagem(
      "Cartão movido para " +
        (NOMES_COLUNA[colunaDestino] || "outra coluna") +
        ".",
      "sucesso",
      { autoLimpar: true }
    );
    await sincronizarCartoes();
    if (acaoFoco) focarCartao(id, acaoFoco);
  }

  function moverCartaoPorPasso(cartao, passo, acao) {
    if (operacaoEmAndamento) return;

    const indiceAtual = COLUNAS.indexOf(cartao.coluna);
    const colunaDestino = COLUNAS[indiceAtual + passo];
    if (!colunaDestino) return;

    const total = cartoesDaColuna(colunaDestino).filter(
      (item) => item.id !== cartao.id
    ).length;

    moverCartao(cartao, colunaDestino, total, { foco: acao });
  }

  async function soltarCartao(event) {
    const colunaEl = elementoDaColuna(event.target);
    if (!colunaEl) return;

    event.preventDefault();

    const transferido = event.dataTransfer
      ? event.dataTransfer.getData(TIPO_DADOS_CARTAO)
      : "";
    const id = Number(transferido || idArrastado);
    const alvoCartao = elementoDoCartao(event.target);
    const alvoId = alvoCartao ? Number(alvoCartao.dataset.id) : null;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;

    finalizarArrasto();

    if (operacaoEmAndamento || !usuario) return;
    if (!Number.isSafeInteger(id) || id <= 0) return;

    const cartao = cartoes.find((item) => item.id === id);
    if (!cartao) return;

    const colunaDestino = colunaEl.id;
    if (!COLUNAS.includes(colunaDestino)) return;

    if (alvoCartao && alvoId === id) return;

    const listaDestino = cartoesDaColuna(colunaDestino).filter(
      (item) => item.id !== id
    );

    let indiceDestino;
    if (!alvoCartao) {
      indiceDestino = listaDestino.length;
    } else {
      const indiceAlvo = listaDestino.findIndex((item) => item.id === alvoId);
      if (indiceAlvo === -1) {
        indiceDestino = listaDestino.length;
      } else {
        const retangulo = alvoCartao.getBoundingClientRect();
        const depois = clientY > retangulo.top + retangulo.height / 2;
        indiceDestino = depois ? indiceAlvo + 1 : indiceAlvo;
      }
    }

    moverCartao(cartao, colunaDestino, indiceDestino);
  }

  /* ------------------------------------------------------------------ */
  /* Inicialização                                                       */
  /* ------------------------------------------------------------------ */

  function configurarEventos() {
    if (formCriarEl) formCriarEl.addEventListener("submit", aoCriarCartao);

    if (quadroEl) {
      quadroEl.addEventListener("dragstart", iniciarArrasto);
      quadroEl.addEventListener("dragover", permitirSoltura);
      quadroEl.addEventListener("dragleave", sairDaColuna);
      quadroEl.addEventListener("drop", soltarCartao);
      quadroEl.addEventListener("dragend", finalizarArrasto);
      quadroEl.addEventListener("click", aoClicarNoQuadro);
    }

    if (avatarEl) avatarEl.addEventListener("error", aoFalharAvatar);
    if (logoutBtnEl) logoutBtnEl.addEventListener("click", aoSair);
    if (temaBtnEl) temaBtnEl.addEventListener("click", alternarTema);
  }

  async function iniciar() {
    configurarEventos();
    renderizarData();
    renderizarQuadro();

    definirMensagem("Carregando seu quadro...", "carregando", {
      ariaBusy: true,
    });

    const resultado = await chamarApi("/api/status");

    if (!resultado.ok) {
      mostrarNaoLogado();
      definirMensagem(resultado.mensagem, "erro");
      return;
    }

    const sessao = normalizarUsuario(
      resultado.dados ? resultado.dados.sessionUser : null
    );

    if (!sessao) {
      mostrarNaoLogado();
      definirMensagem(
        "Entre com o Discord para ver e gerenciar seus cartões.",
        "info"
      );
      return;
    }

    mostrarPerfil(sessao);
    await carregarCartoes();
  }

  iniciar();
})();
