/* Sessão da Turma — JavaScript puro (Vanilla JS), sem frameworks.
 * Todo texto vindo do usuário é inserido com textContent (nunca innerHTML), para evitar XSS. */

const estado = { usuario: null, loginConfigurado: false, ordem: "media", tipo: "", busca: "", titulos: [] };

const $ = (seletor) => document.querySelector(seletor);

/** Cria um elemento: el("p", { class: "x", onclick: fn }, "texto", outroElemento) */
function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (nome.startsWith("on")) elemento.addEventListener(nome.slice(2), valor);
    else if (nome === "class") elemento.className = valor;
    else elemento.setAttribute(nome, valor === true ? "" : valor);
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return elemento;
}

/** Chamada à API com tratamento de erro padronizado. */
async function api(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    credentials: "same-origin",
    headers: opcoes.corpo ? { "Content-Type": "application/json" } : {},
    method: opcoes.metodo || "GET",
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });
  let dados = {};
  try { dados = await resposta.json(); } catch {}
  if (!resposta.ok) {
    const falha = new Error(dados.erro || `Erro ${resposta.status}`);
    falha.status = resposta.status;
    falha.dados = dados;
    throw falha;
  }
  return dados;
}

/* ---------- Utilidades visuais ---------- */

function estrelas(media) {
  const cheias = Math.round(media);
  return el("span", { class: "estrelas", "aria-label": `${formatarMedia(media)} de 5 estrelas` },
    "★".repeat(cheias), el("span", { class: "vazia" }, "★".repeat(5 - cheias)));
}

function formatarMedia(media) {
  return Number(media).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function plural(n, um, varios) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Gera uma cor de "cartaz" estável a partir do nome do título. */
function corDoCartaz(nome) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.codePointAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 32%), hsl(${(h + 40) % 360} 60% 18%))`;
}

function iniciais(nome) {
  return nome.split(/\s+/).filter((p) => p.length > 2 || /^\d/.test(p)).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || nome[0].toUpperCase();
}

function formatarData(texto) {
  const data = new Date(texto.replace(" ", "T") + "Z");
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function mostrarAviso(texto, tipo = "info") {
  const aviso = $("#aviso");
  aviso.textContent = texto;
  aviso.className = `aviso${tipo === "erro" ? " erro" : ""}`;
  aviso.hidden = !texto;
}

/* ---------- Usuário (Discord) ---------- */

async function carregarUsuario() {
  try {
    const dados = await api("/api/me");
    estado.usuario = dados.usuario;
    estado.loginConfigurado = dados.loginConfigurado;
  } catch {
    estado.usuario = null;
  }
  desenharUsuario();
}

function desenharUsuario() {
  const area = $("#areaUsuario");
  area.replaceChildren();
  if (estado.usuario) {
    const u = estado.usuario;
    area.append(
      el("div", { class: "perfil" },
        el("img", { src: u.avatar, alt: "", width: 34, height: 34 }),
        el("span", { class: "perfil-nome" }, u.username, el("small", {}, `Discord · id ${u.user_id}`))),
      el("button", { class: "botao", type: "button", onclick: sair }, "Sair"));
  } else {
    area.append(el("a", { class: "botao botao-discord", href: "/api/auth/discord" }, "Entrar com Discord"));
  }
}

async function sair() {
  await api("/api/auth/logout", { metodo: "POST" }).catch(() => {});
  estado.usuario = null;
  desenharUsuario();
  carregarTitulos();
}

function exigirLogin(acao) {
  if (estado.usuario) return true;
  mostrarAviso(`Entre com o Discord para ${acao}.`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  return false;
}

/* ---------- Galeria ---------- */

async function carregarTitulos() {
  const galeria = $("#galeria");
  galeria.setAttribute("aria-busy", "true");
  if (!estado.titulos.length) galeria.replaceChildren(...Array.from({ length: 8 }, () => el("div", { class: "esqueleto" })));

  const params = new URLSearchParams({ ordem: estado.ordem });
  if (estado.tipo) params.set("tipo", estado.tipo);
  if (estado.busca) params.set("busca", estado.busca);

  try {
    const dados = await api(`/api/titulos?${params}`);
    estado.titulos = dados.titulos;
    desenharGaleria();
  } catch (e) {
    galeria.replaceChildren(el("p", { class: "vazio" }, `Não foi possível carregar o catálogo: ${e.message}`));
  } finally {
    galeria.setAttribute("aria-busy", "false");
  }
}

function desenharGaleria() {
  const galeria = $("#galeria");
  if (!estado.titulos.length) {
    galeria.replaceChildren(el("p", { class: "vazio" }, estado.busca ? "Nenhum título encontrado. Que tal cadastrá-lo?" : "Nenhum título ainda."));
    return;
  }
  galeria.replaceChildren(...estado.titulos.map((t, i) => {
    const mostrarRanking = estado.ordem !== "recentes" && t.total > 0 && i < 3;
    return el("button", { class: "cartao", type: "button", onclick: () => abrirTitulo(t.id), "aria-label": `${t.nome}, média ${formatarMedia(t.media)}, ${plural(t.total, "avaliação", "avaliações")}` },
      el("div", { class: "cartaz", style: `background:${corDoCartaz(t.nome)}`, "aria-hidden": "true" },
        el("span", { class: "selo" }, t.tipo === "serie" ? "Série" : "Filme"),
        mostrarRanking ? el("span", { class: "ranking" }, `#${i + 1}`) : null,
        iniciais(t.nome)),
      el("div", { class: "cartao-info" },
        el("h3", {}, t.nome),
        el("span", { class: "cartao-meta" }, [t.ano_lancamento, t.genero].filter(Boolean).join(" · ")),
        el("div", { class: "cartao-nota" },
          t.total ? [estrelas(t.media), el("strong", {}, formatarMedia(t.media))] : el("span", { class: "cartao-meta" }, "Sem notas ainda"),
          el("span", { class: "cartao-meta" }, `(${t.total})`)),
        t.minha_nota ? el("span", { class: "minha" }, `✓ Sua nota: ${t.minha_nota}★`) : null));
  }));
}

/* ---------- Detalhes e avaliação ---------- */

async function abrirTitulo(id) {
  const dialogo = $("#dlgTitulo");
  const corpo = $("#dlgTituloCorpo");
  corpo.replaceChildren(el("p", { class: "vazio" }, "Carregando..."));
  if (!dialogo.open) dialogo.showModal();

  try {
    const dados = await api(`/api/titulos/${id}`);
    desenharDetalhes(dados);
  } catch (e) {
    corpo.replaceChildren(el("p", { class: "vazio" }, e.message));
  }
}

function desenharDetalhes({ titulo, distribuicao, avaliacoes, minha }) {
  const corpo = $("#dlgTituloCorpo");
  const maximo = Math.max(1, ...distribuicao);

  const barras = el("div", { class: "barras", "aria-label": "Distribuição das notas" },
    [5, 4, 3, 2, 1].map((n) => el("div", { class: "barra" },
      el("span", {}, `${n}★`),
      el("div", { class: "barra-fundo" }, el("div", { class: "barra-cheia", style: `width:${(distribuicao[n - 1] / maximo) * 100}%` })),
      el("span", {}, distribuicao[n - 1]))));

  corpo.replaceChildren(
    el("h2", { id: "dlgTituloNome" }, titulo.nome),
    el("p", { class: "cartao-meta" }, [titulo.tipo === "serie" ? "Série" : "Filme", titulo.ano_lancamento, titulo.genero].filter(Boolean).join(" · ")),
    el("div", { class: "resumo" },
      el("div", { class: "resumo-media" },
        el("strong", {}, titulo.total ? formatarMedia(titulo.media) : "–"),
        estrelas(titulo.media),
        el("div", { class: "cartao-meta" }, plural(titulo.total, "avaliação", "avaliações"))),
      barras),
    formularioAvaliacao(titulo, minha),
    el("h3", {}, "Resenhas da turma"),
    avaliacoes.length
      ? el("ul", { class: "resenhas" }, avaliacoes.map((a) => el("li", { class: "resenha" },
          el("img", { src: a.avatar, alt: "", width: 38, height: 38, loading: "lazy" }),
          el("div", {},
            el("div", { class: "resenha-topo" }, el("strong", {}, a.username), estrelas(a.nota), el("small", {}, formatarData(a.atualizado_em))),
            a.resenha ? el("p", {}, a.resenha) : el("p", { class: "cartao-meta" }, "(sem resenha)")))))
      : el("p", { class: "cartao-meta" }, "Ninguém avaliou ainda. Seja a primeira pessoa!"));
}

function formularioAvaliacao(titulo, minha) {
  if (!estado.usuario) {
    return el("div", { class: "caixa" },
      el("p", {}, "Entre com o Discord para dar sua nota e escrever uma resenha."),
      el("p", { style: "margin-top:.6rem" }, el("a", { class: "botao botao-discord", href: "/api/auth/discord" }, "Entrar com Discord")));
  }

  const seletor = el("div", { class: "seletor-estrelas", role: "radiogroup", "aria-label": "Sua nota" },
    [5, 4, 3, 2, 1].map((n) => [
      el("input", { type: "radio", name: "nota", value: n, id: `nota${n}`, checked: minha?.nota === n }),
      el("label", { for: `nota${n}`, title: plural(n, "estrela", "estrelas") }, "★"),
    ]));

  const textarea = el("textarea", { name: "resenha", maxlength: 500, placeholder: "O que você achou? (opcional, até 500 caracteres)" });
  textarea.value = minha?.resenha || "";
  const contador = el("span", { class: "contador" }, `${textarea.value.length}/500`);
  textarea.addEventListener("input", () => { contador.textContent = `${textarea.value.length}/500`; });

  const erroMsg = el("p", { class: "erro-form", role: "alert" });
  const botaoSalvar = el("button", { class: "botao botao-primario", type: "submit" }, minha ? "Salvar alterações" : "Publicar avaliação");

  const formulario = el("form", { class: "formulario", novalidate: true },
    seletor,
    el("label", {}, "Resenha curta", textarea, contador),
    erroMsg,
    el("div", { class: "acoes" },
      botaoSalvar,
      minha ? el("button", { class: "botao botao-perigo", type: "button", onclick: () => removerAvaliacao(titulo.id) }, "Remover minha nota") : null));

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const escolhida = formulario.querySelector('input[name="nota"]:checked');
    if (!escolhida) { erroMsg.textContent = "Escolha de 1 a 5 estrelas."; return; }
    erroMsg.textContent = "";
    botaoSalvar.disabled = true;
    try {
      const r = await api(`/api/titulos/${titulo.id}/avaliacao`, {
        metodo: "PUT", corpo: { nota: Number(escolhida.value), resenha: textarea.value },
      });
      mostrarAviso(r.editada ? `Sua avaliação de "${titulo.nome}" foi atualizada.` : `Avaliação de "${titulo.nome}" publicada!`);
      await Promise.all([abrirTitulo(titulo.id), carregarTitulos()]);
    } catch (e) {
      erroMsg.textContent = e.message;
      if (e.status === 401) carregarUsuario();
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  return el("div", { class: "caixa" }, el("h3", {}, minha ? "Editar sua avaliação" : "Sua avaliação"), formulario);
}

async function removerAvaliacao(id) {
  if (!confirm("Remover sua nota e resenha deste título?")) return;
  try {
    await api(`/api/titulos/${id}/avaliacao`, { metodo: "DELETE" });
    mostrarAviso("Sua avaliação foi removida.");
    await Promise.all([abrirTitulo(id), carregarTitulos()]);
  } catch (e) {
    mostrarAviso(e.message, "erro");
  }
}

/* ---------- Cadastro de título ---------- */

function abrirCadastro() {
  if (!exigirLogin("cadastrar títulos")) return;
  const formulario = $("#formNovo");
  formulario.reset();
  formulario.ano_lancamento.max = new Date().getFullYear() + 2;
  $("#erroNovo").textContent = "";
  $("#dlgNovo").showModal();
}

async function enviarCadastro(evento) {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const erroMsg = $("#erroNovo");
  const dados = Object.fromEntries(new FormData(formulario));
  dados.ano_lancamento = Number(dados.ano_lancamento);

  if (!dados.nome.trim()) { erroMsg.textContent = "Informe o nome."; return; }
  if (!Number.isInteger(dados.ano_lancamento) || !dados.ano_lancamento) { erroMsg.textContent = "Informe o ano de lançamento."; return; }

  const botao = formulario.querySelector("button[type=submit]");
  botao.disabled = true;
  try {
    const r = await api("/api/titulos", { metodo: "POST", corpo: dados });
    $("#dlgNovo").close();
    mostrarAviso(`"${dados.nome.trim()}" entrou no catálogo. Agora é só avaliar!`);
    await carregarTitulos();
    abrirTitulo(r.id);
  } catch (e) {
    if (e.status === 409 && e.dados.id) {
      $("#dlgNovo").close();
      mostrarAviso("Esse título já estava no catálogo. Abrimos ele para você.");
      abrirTitulo(e.dados.id);
    } else {
      erroMsg.textContent = e.message;
    }
  } finally {
    botao.disabled = false;
  }
}

/* ---------- Eventos ---------- */

function configurarEventos() {
  document.querySelectorAll(".aba").forEach((aba) => aba.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach((a) => { a.classList.toggle("ativa", a === aba); a.setAttribute("aria-selected", a === aba); });
    estado.ordem = aba.dataset.ordem;
    carregarTitulos();
  }));

  $("#filtroTipo").addEventListener("change", (e) => { estado.tipo = e.target.value; carregarTitulos(); });

  let espera;
  $("#busca").addEventListener("input", (e) => {
    clearTimeout(espera);
    espera = setTimeout(() => { estado.busca = e.target.value.trim(); carregarTitulos(); }, 300);
  });

  $("#btnNovo").addEventListener("click", abrirCadastro);
  $("#formNovo").addEventListener("submit", enviarCadastro);

  // Fecha janelas ao clicar fora
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
}

function lerMensagemDeLogin() {
  const params = new URLSearchParams(location.search);
  const motivo = params.get("erro_login");
  if (motivo) {
    const textos = { cancelado: "Login cancelado.", nao_configurado: "O login com Discord ainda não foi configurado." };
    mostrarAviso(textos[motivo] || "Não foi possível entrar com o Discord. Tente novamente.", "erro");
    history.replaceState(null, "", "/");
  }
}

configurarEventos();
lerMensagemDeLogin();
carregarUsuario().then(carregarTitulos);
