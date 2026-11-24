/**
 * Sorteador Auditável — front-end em JavaScript puro.
 *
 * Sem frameworks, sem build. Conversa com as Cloudflare Pages Functions e
 * renderiza três telas por rota de hash:
 *   #/            início (criar sala, consultar ata, minhas salas)
 *   #/sala/CODE   sala (participantes, entrada, sorteio e histórico)
 *   #/ata/CODE    ata pública (resultado + verificação no navegador)
 */

import { verificarAta } from "./auditoria.js";

const CHAVE_PROJETO = "P26-2A-B12E-0CFD-70CA-18E1";

const estado = {
  usuario: null,
  configurado: false,
  carregando: true,
};

// ---------------------------------------------------------------------------
// Utilidades de DOM
// ---------------------------------------------------------------------------

/**
 * Cria elementos sem innerHTML: texto vindo de usuários nunca vira HTML.
 * @param {string} tag
 * @param {Record<string, unknown>} [props]
 * @param {...unknown} filhos
 */
function el(tag, props = {}, ...filhos) {
  const node = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props || {})) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (chave === "class") node.className = String(valor);
    else if (chave === "text") node.textContent = String(valor);
    else if (chave === "dataset") Object.assign(node.dataset, valor);
    else if (chave.startsWith("on") && typeof valor === "function") {
      node.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (valor === true) node.setAttribute(chave, "");
    else node.setAttribute(chave, String(valor));
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho === undefined || filho === null || filho === false) continue;
    node.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return node;
}

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
});

function formatarData(iso) {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? String(iso ?? "") : formatadorData.format(data);
}

function encurtarHash(hash, tamanho = 16) {
  const texto = String(hash ?? "");
  return texto.length > tamanho ? `${texto.slice(0, tamanho)}…` : texto;
}

function modoRotulo(modo) {
  return modo === "groups" ? "Equipes" : "Ordem de apresentação";
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

class ErroApi extends Error {
  constructor(mensagem, { status = 0, codigo = "erro", campos = [] } = {}) {
    super(mensagem);
    this.name = "ErroApi";
    this.status = status;
    this.codigo = codigo;
    this.campos = campos;
  }
}

async function api(caminho, { metodo = "GET", corpo, sinal } = {}) {
  const opcoes = {
    method: metodo,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal: sinal,
  };
  if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(caminho, opcoes);
  } catch {
    throw new ErroApi("Não foi possível falar com o servidor. Verifique sua conexão.");
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    throw new ErroApi(dados?.mensagem || `O servidor respondeu com erro ${resposta.status}.`, {
      status: resposta.status,
      codigo: dados?.erro || "erro",
      campos: dados?.campos || [],
    });
  }
  return dados;
}

// ---------------------------------------------------------------------------
// Feedback, login e cópia
// ---------------------------------------------------------------------------

let timerToast = null;

function toast(mensagem, tipo = "ok") {
  const node = document.getElementById("toast");
  if (!node) return;
  node.textContent = mensagem;
  node.className = `toast toast-${tipo} toast-visible`;
  if (timerToast) clearTimeout(timerToast);
  timerToast = window.setTimeout(() => {
    node.classList.remove("toast-visible");
  }, 4500);
}

function destinoLogin() {
  const rota = location.hash || "";
  if (rota.startsWith("#/sala/")) {
    return `/?sala=${encodeURIComponent(rota.slice("#/sala/".length))}`;
  }
  if (rota.startsWith("#/ata/")) {
    return `/?ata=${encodeURIComponent(rota.slice("#/ata/".length))}`;
  }
  return "/";
}

function urlLogin(destino = destinoLogin()) {
  return `/api/auth/discord?next=${encodeURIComponent(destino)}`;
}

async function irParaLogin(destino) {
  location.href = urlLogin(destino);
}

async function sair() {
  try {
    await api("/api/auth/logout", { metodo: "POST" });
    estado.usuario = null;
    renderCabecalho();
    toast("Você saiu da sua conta.");
    await rotear();
  } catch (erro) {
    toast(erro.message, "erro");
  }
}

async function copiar(texto, mensagem = "Link copiado.") {
  try {
    await navigator.clipboard.writeText(texto);
    toast(mensagem);
  } catch {
    const area = el("textarea", { class: "sr-only", "aria-hidden": "true" });
    area.value = texto;
    document.body.append(area);
    area.select();
    try {
      document.execCommand("copy");
      toast(mensagem);
    } catch {
      toast("Não foi possível copiar automaticamente.", "erro");
    } finally {
      area.remove();
    }
  }
}

function urlDaSala(codigo) {
  return `${location.origin}/#/sala/${encodeURIComponent(codigo)}`;
}

function urlDaAta(codigo) {
  return `${location.origin}/#/ata/${encodeURIComponent(codigo)}`;
}

function tratarErroDeAcao(erro) {
  if (erro instanceof ErroApi && erro.status === 401) {
    toast("Sua sessão expirou. Entre novamente com o Discord.", "erro");
    irParaLogin();
    return;
  }
  toast(erro.message || "Não foi possível concluir a ação.", "erro");
}

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------

function renderCabecalho() {
  const area = document.getElementById("userArea");
  if (!area) return;
  area.replaceChildren();

  if (estado.carregando) {
    area.append(el("span", { class: "user-placeholder", "aria-hidden": "true" }, "Carregando…"));
    return;
  }

  if (!estado.usuario) {
    if (!estado.configurado) {
      area.append(
        el("span", { class: "user-hint" }, "Login Discord não configurado neste ambiente.")
      );
      return;
    }
    area.append(
      el("span", { class: "user-hint" }, "Entre para criar e gerenciar salas"),
      el("a", { class: "btn btn-primary btn-sm", href: urlLogin() }, "Entrar com Discord")
    );
    return;
  }

  const nome = estado.usuario.globalName || estado.usuario.username;
  const avatar = estado.usuario.avatar
    ? el("img", {
        class: "avatar",
        src: estado.usuario.avatar,
        alt: "",
        width: "32",
        height: "32",
        loading: "lazy",
        referrerpolicy: "no-referrer",
      })
    : el("span", { class: "avatar avatar-fallback", "aria-hidden": "true" }, nome.slice(0, 1).toUpperCase());

  area.append(
    el(
      "div",
      { class: "user-chip" },
      avatar,
      el("span", { class: "user-name" }, nome),
      el("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: sair }, "Sair")
    )
  );
}

// ---------------------------------------------------------------------------
// Componentes reutilizáveis
// ---------------------------------------------------------------------------

function viewCarregando(mensagem = "Carregando…") {
  return el(
    "section",
    { class: "card loading-card", "aria-busy": "true" },
    el("span", { class: "spinner", "aria-hidden": "true" }),
    el("p", {}, mensagem)
  );
}

function viewErro(mensagem, { titulo = "Não foi possível abrir esta página" } = {}) {
  return el(
    "section",
    { class: "card empty-state" },
    el("h1", {}, titulo),
    el("p", {}, mensagem),
    el("a", { class: "btn btn-primary", href: "#/" }, "Voltar ao início")
  );
}

function campoRotulado(id, rotulo, controle, dica) {
  return el(
    "div",
    { class: "field" },
    el("label", { for: id }, rotulo),
    controle,
    dica ? el("small", { class: "field-hint" }, dica) : null
  );
}

function botaoCopiar(texto, rotulo = "Copiar") {
  return el(
    "button",
    {
      class: "btn btn-ghost btn-sm",
      type: "button",
      onclick: () => copiar(texto, "Copiado para a área de transferência."),
    },
    rotulo
  );
}

function codigoChip(codigo, { copiavel = true } = {}) {
  return el(
    "span",
    { class: "code-chip" },
    el("code", {}, codigo),
    copiavel ? botaoCopiar(codigo) : null
  );
}

function badgeOrigem(source) {
  return el(
    "span",
    { class: `badge ${source === "discord" ? "badge-discord" : "badge-manual"}` },
    source === "discord" ? "Discord" : "Manual"
  );
}

function listaVazia(titulo, texto) {
  return el(
    "div",
    { class: "empty-inline" },
    el("strong", {}, titulo),
    el("p", {}, texto)
  );
}

// ---------------------------------------------------------------------------
// Tela inicial
// ---------------------------------------------------------------------------

function blocoCriarSala() {
  const campoTitle = el("input", {
    id: "titulo-sala",
    class: "input",
    type: "text",
    required: true,
    minlength: "3",
    maxlength: "80",
    placeholder: "Ex.: Trabalho de Linguagem de Programação",
    autocomplete: "off",
  });

  const campoMode = el(
    "select",
    { id: "modo-sala", class: "input" },
    el("option", { value: "groups" }, "Dividir em equipes"),
    el("option", { value: "order" }, "Definir ordem de apresentação")
  );

  const campoGrupo = el("input", {
    id: "tamanho-grupo",
    class: "input",
    type: "number",
    min: "2",
    max: "50",
    step: "1",
    value: "4",
    inputmode: "numeric",
  });

  const campoTamanho = campoRotulado(
    "tamanho-grupo",
    "Tamanho máximo de cada equipe",
    campoGrupo,
    "Entre 2 e 50. As equipes ficam balanceadas (diferença de no máximo 1)."
  );

  const campoEntrada = el("input", { id: "permitir-entrada", type: "checkbox", checked: true });
  const rotuloEntrada = el(
    "label",
    { class: "check" },
    campoEntrada,
    el("span", {}, "Permitir que os alunos entrem sozinhos com o Discord")
  );

  campoMode.addEventListener("change", () => {
    const ehGrupos = campoMode.value === "groups";
    campoTamanho.hidden = !ehGrupos;
    campoGrupo.required = ehGrupos;
  });

  const erro = el("p", { class: "form-error", role: "alert", hidden: true });
  const botao = el("button", { class: "btn btn-primary", type: "submit" }, "Criar sala");
  const form = el(
    "form",
    { class: "stack-form", novalidate: true },
    campoRotulado("titulo-sala", "Nome do sorteio", campoTitle, "Ex.: Seminário de Engenharia — 2A"),
    campoRotulado("modo-sala", "O que você quer sortear?", campoMode),
    campoTamanho,
    rotuloEntrada,
    erro,
    botao
  );

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    const titulo = campoTitle.value.trim();
    if (titulo.length < 3) {
      erro.textContent = "Informe um nome com pelo menos 3 caracteres.";
      erro.hidden = false;
      campoTitle.focus();
      return;
    }

    if (!estado.usuario) {
      toast("Entre com o Discord para criar sua sala.", "info");
      await irParaLogin("/");
      return;
    }

    const corpo = {
      title: titulo,
      mode: campoMode.value,
      allowJoin: campoEntrada.checked,
    };
    if (campoMode.value === "groups") {
      const tamanho = Number(campoGrupo.value);
      if (!Number.isInteger(tamanho) || tamanho < 2 || tamanho > 50) {
        erro.textContent = "O tamanho da equipe deve ser um inteiro entre 2 e 50.";
        erro.hidden = false;
        campoGrupo.focus();
        return;
      }
      corpo.groupSize = tamanho;
    }

    botao.disabled = true;
    botao.textContent = "Criando…";
    try {
      const dados = await api("/api/rooms", { metodo: "POST", corpo });
      toast(`Sala ${dados.sala.code} criada.`);
      location.hash = `#/sala/${dados.sala.code}`;
    } catch (falha) {
      tratarErroDeAcao(falha);
      erro.textContent = falha.message;
      erro.hidden = false;
    } finally {
      botao.disabled = false;
      botao.textContent = "Criar sala";
    }
  });

  return el(
    "section",
    { class: "card", id: "criar-sala" },
    el("h2", {}, "Criar uma sala"),
    el(
      "p",
      { class: "muted" },
      "O organizador define o formato. Depois é possível adicionar nomes manualmente, abrir a entrada pelo Discord ou as duas coisas."
    ),
    form
  );
}

function blocoAcessoRapido() {
  const codigoSala = el("input", {
    id: "codigo-sala",
    class: "input input-code",
    type: "text",
    maxlength: "16",
    placeholder: "ABCD2345",
    autocomplete: "off",
    spellcheck: "false",
  });
  const codigoAta = el("input", {
    id: "codigo-ata",
    class: "input input-code",
    type: "text",
    maxlength: "14",
    placeholder: "SORT-XXXX-XXXX",
    autocomplete: "off",
    spellcheck: "false",
  });

  const formSala = el(
    "form",
    { class: "inline-form" },
    el("label", { for: "codigo-sala", class: "sr-only" }, "Código da sala"),
    codigoSala,
    el("button", { class: "btn btn-secondary", type: "submit" }, "Abrir sala")
  );
  formSala.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const codigo = codigoSala.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (codigo.length < 6) {
      toast("Informe o código de 8 caracteres da sala.", "erro");
      codigoSala.focus();
      return;
    }
    location.hash = `#/sala/${codigo}`;
  });

  const formAta = el(
    "form",
    { class: "inline-form" },
    el("label", { for: "codigo-ata", class: "sr-only" }, "Código da ata"),
    codigoAta,
    el("button", { class: "btn btn-secondary", type: "submit" }, "Consultar ata")
  );
  formAta.addEventListener("submit", (evento) => {
    evento.preventDefault();
    let codigo = codigoAta.value.trim().toUpperCase().replace(/\s+/g, "");
    if (!codigo.startsWith("SORT-") && /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(codigo)) {
      codigo = `SORT-${codigo.replace(/^([A-Z0-9]{4})-?/, "$1-")}`;
    }
    if (!/^SORT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo)) {
      toast("Código de ata inválido. O formato é SORT-XXXX-XXXX.", "erro");
      codigoAta.focus();
      return;
    }
    location.hash = `#/ata/${codigo}`;
  });

  return el(
    "section",
    { class: "card" },
    el("h2", {}, "Já tem um código?"),
    el("h3", { class: "subhead" }, "Sala"),
    formSala,
    el("h3", { class: "subhead" }, "Ata pública"),
    formAta,
    el(
      "p",
      { class: "muted small" },
      "A ata é pública: qualquer pessoa com o código pode conferir o resultado, o hash e a trilha do sorteio."
    )
  );
}

function blocoHero() {
  return el(
    "section",
    { class: "hero" },
    el(
      "div",
      { class: "hero-copy" },
      el("span", { class: "pill" }, "Projeto #43 · Cloudflare Pages + D1"),
      el("h1", {}, "Sorteios de equipes que qualquer pessoa pode conferir."),
      el(
        "p",
        { class: "hero-lead" },
        "O embaralhamento Fisher-Yates roda dentro da Cloudflare Function. O resultado vira uma ata imutável no D1, com código de verificação, data/hora e hash SHA-256 — e o seu navegador pode recalcular tudo."
      ),
      el(
        "ul",
        { class: "hero-facts" },
        el("li", {}, "Resultado gravado no servidor, nunca no cliente"),
        el("li", {}, "Re-sorteios viram novas atas encadeadas, sem apagar as anteriores"),
        el("li", {}, "Verificação independente no navegador, sem confiar na API")
      )
    ),
    el(
      "div",
      { class: "hero-panel", "aria-hidden": "true" },
      el("span", { class: "hero-step" }, "1"),
      el("p", {}, "O organizador cria a sala e define o formato."),
      el("span", { class: "hero-step" }, "2"),
      el("p", {}, "Fisher-Yates roda no servidor e gera a ata."),
      el("span", { class: "hero-step" }, "3"),
      el("p", {}, "Qualquer pessoa confere o hash pelo código."),
      el("code", { class: "hero-code" }, "SORT-XXXX-XXXX")
    )
  );
}

function cartaoSala(sala) {
  return el(
    "a",
    { class: "room-card", href: `#/sala/${sala.code}` },
    el(
      "div",
      { class: "room-card-top" },
      el("span", { class: "room-code" }, sala.code),
      el("span", { class: `badge ${sala.mode === "groups" ? "badge-groups" : "badge-order"}` }, modoRotulo(sala.mode))
    ),
    el("strong", { class: "room-card-title" }, sala.title),
    el(
      "span",
      { class: "room-card-meta" },
      `${sala.participantsCount} ${sala.participantsCount === 1 ? "participante" : "participantes"} · ${sala.drawsCount} ${sala.drawsCount === 1 ? "ata" : "atas"}`
    )
  );
}

function cartaoAta(ata) {
  return el(
    "a",
    { class: "draw-row", href: `#/ata/${ata.verificationCode}` },
    el(
      "span",
      { class: "draw-row-main" },
      el("strong", {}, ata.verificationCode),
      el("span", { class: "muted small" }, `${ata.room?.title ?? "Sala"} · ${formatarData(ata.createdAt)}`)
    ),
    el("span", { class: "draw-row-side" }, el("code", { class: "mono small" }, encurtarHash(ata.auditHash)))
  );
}

async function renderInicio() {
  document.title = "Sorteador Auditável · Equipes e Ordem de Apresentação";
  const alvo = document.getElementById("app");
  alvo.replaceChildren(
    blocoHero(),
    el("div", { class: "grid-2 grid-top" }, blocoCriarSala(), blocoAcessoRapido())
  );

  const carregando = viewCarregando("Carregando salas e atas públicas…");
  alvo.append(carregando);

  const [minhas, publicas] = await Promise.allSettled([
    estado.usuario ? api("/api/rooms") : Promise.resolve({ salas: [] }),
    api("/api/draws?limite=8"),
  ]);

  alvo.removeChild(carregando);

  if (estado.usuario) {
    const secao = el("section", { class: "section-block" }, el("h2", {}, "Minhas salas"));
    if (minhas.status === "fulfilled" && minhas.value.salas.length > 0) {
      secao.append(el("div", { class: "room-grid" }, minhas.value.salas.map(cartaoSala)));
    } else if (minhas.status === "rejected") {
      secao.append(el("p", { class: "muted" }, "Não foi possível carregar suas salas agora."));
    } else {
      secao.append(
        listaVazia(
          "Nenhuma sala ainda.",
          "Crie a primeira sala no formulário acima. Ela aparece aqui com o código para compartilhar."
        )
      );
    }
    alvo.append(secao);
  }

  const secaoAtas = el("section", { class: "section-block" }, el("h2", {}, "Últimas atas públicas"));
  if (publicas.status === "fulfilled" && publicas.value.draws.length > 0) {
    secaoAtas.append(el("div", { class: "draw-list" }, publicas.value.draws.map(cartaoAta)));
  } else if (publicas.status === "rejected") {
    secaoAtas.append(el("p", { class: "muted" }, "Não foi possível carregar as atas agora."));
  } else {
    secaoAtas.append(
      listaVazia("Nenhuma ata registrada ainda.", "Assim que a primeira sala sortear, a ata aparece aqui.")
    );
  }
  alvo.append(secaoAtas);
}

// ---------------------------------------------------------------------------
// Tela da sala
// ---------------------------------------------------------------------------

function linhaParticipante(participante, sala, recarregar) {
  const remover = sala.isOwner
    ? el(
        "button",
        {
          class: "btn btn-danger-ghost btn-sm",
          type: "button",
          title: `Remover ${participante.displayName}`,
          onclick: async () => {
            if (!confirm(`Remover "${participante.displayName}" da sala?`)) return;
            try {
              await api(`/api/rooms/${sala.code}/participants/${participante.id}`, {
                metodo: "DELETE",
              });
              toast("Participante removido.");
              await recarregar();
            } catch (erro) {
              tratarErroDeAcao(erro);
            }
          },
        },
        "Remover"
      )
    : null;

  return el(
    "li",
    { class: "person-row" },
    el("span", { class: "person-name" }, participante.displayName),
    badgeOrigem(participante.source),
    el("span", { class: "person-date small muted" }, formatarData(participante.joinedAt)),
    remover
  );
}

function formularioConfiguracoes(sala, recarregar) {
  const titulo = el("input", {
    id: "config-titulo",
    class: "input",
    type: "text",
    required: true,
    minlength: "3",
    maxlength: "80",
    value: sala.title,
  });
  const modo = el(
    "select",
    { id: "config-modo", class: "input" },
    el("option", { value: "groups", selected: sala.mode === "groups" }, "Dividir em equipes"),
    el("option", { value: "order", selected: sala.mode === "order" }, "Ordem de apresentação")
  );
  const tamanho = el("input", {
    id: "config-grupo",
    class: "input",
    type: "number",
    min: "2",
    max: "50",
    step: "1",
    value: sala.groupSize ?? 4,
  });
  const campoTamanho = campoRotulado("config-grupo", "Tamanho máximo da equipe", tamanho);
  campoTamanho.hidden = sala.mode !== "groups";

  modo.addEventListener("change", () => {
    campoTamanho.hidden = modo.value !== "groups";
  });

  const entrada = el("input", { type: "checkbox", checked: sala.allowJoin });
  const botao = el("button", { class: "btn btn-secondary", type: "submit" }, "Salvar configurações");
  const erro = el("p", { class: "form-error", role: "alert", hidden: true });

  const form = el(
    "form",
    { class: "stack-form compact" },
    campoRotulado("config-titulo", "Nome do sorteio", titulo),
    campoRotulado("config-modo", "Formato", modo),
    campoTamanho,
    el("label", { class: "check" }, entrada, el("span", {}, "Permitir entrada pelo Discord")),
    erro,
    botao
  );

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    const corpo = {
      title: titulo.value.trim(),
      mode: modo.value,
      allowJoin: entrada.checked,
    };
    if (modo.value === "groups") {
      const valor = Number(tamanho.value);
      if (!Number.isInteger(valor) || valor < 2 || valor > 50) {
        erro.textContent = "O tamanho da equipe deve estar entre 2 e 50.";
        erro.hidden = false;
        return;
      }
      corpo.groupSize = valor;
    }

    botao.disabled = true;
    try {
      await api(`/api/rooms/${sala.code}`, { metodo: "PATCH", corpo });
      toast("Configurações salvas.");
      await recarregar();
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
      botao.disabled = false;
    }
  });

  return form;
}

function formularioAdicionarNomes(sala, recarregar) {
  const texto = el("textarea", {
    id: "nomes-manuais",
    class: "input textarea",
    rows: "4",
    placeholder: "Ana\nBruno\nCarla\nDiego",
    spellcheck: "false",
  });
  const botao = el("button", { class: "btn btn-secondary", type: "submit" }, "Adicionar à sala");
  const erro = el("p", { class: "form-error", role: "alert", hidden: true });

  const form = el(
    "form",
    { class: "stack-form compact" },
    el("label", { for: "nomes-manuais" }, "Adicionar nomes manualmente (um por linha)"),
    texto,
    erro,
    botao
  );

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    const nomes = texto.value
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter(Boolean);
    if (nomes.length === 0) {
      erro.textContent = "Digite pelo menos um nome.";
      erro.hidden = false;
      return;
    }

    botao.disabled = true;
    botao.textContent = "Adicionando…";
    try {
      const dados = await api(`/api/rooms/${sala.code}/participants`, {
        metodo: "POST",
        corpo: { nomes },
      });
      texto.value = "";
      toast(`${dados.adicionados} ${dados.adicionados === 1 ? "nome adicionado" : "nomes adicionados"}.`);
      await recarregar();
    } catch (falha) {
      erro.textContent = falha.message;
      erro.hidden = false;
      botao.disabled = false;
      botao.textContent = "Adicionar à sala";
    }
  });

  return form;
}

async function renderSala(codigo) {
  const alvo = document.getElementById("app");
  alvo.replaceChildren(viewCarregando("Abrindo a sala…"));

  let sala;
  try {
    const dados = await api(`/api/rooms/${encodeURIComponent(codigo)}`);
    sala = dados.sala;
  } catch (erro) {
    document.title = "Sala não encontrada · Sorteador Auditável";
    alvo.replaceChildren(
      viewErro(
        erro.status === 404
          ? "Confira o código digitado. A sala pode ter sido removida pelo organizador."
          : erro.message,
        { titulo: erro.status === 404 ? "Sala não encontrada" : "Erro ao abrir a sala" }
      )
    );
    return;
  }

  const recarregar = () => renderSala(sala.code);
  document.title = `${sala.title} · Sorteador Auditável`;

  const podeSortear = sala.isOwner && sala.participants.length >= 2 && sala.status !== "closed";

  const acoes = el(
    "div",
    { class: "room-actions" },
    botaoCopiar(urlDaSala(sala.code), "Copiar link da sala"),
    estado.usuario
      ? sala.isParticipant
        ? el(
            "button",
            {
              class: "btn btn-ghost",
              type: "button",
              onclick: async () => {
                if (!confirm("Sair desta sala? Seu nome sai da lista de participantes.")) return;
                try {
                  await api(`/api/rooms/${sala.code}/join`, { metodo: "DELETE" });
                  toast("Você saiu da sala.");
                  await recarregar();
                } catch (erro) {
                  tratarErroDeAcao(erro);
                }
              },
            },
            "Sair da sala"
          )
        : sala.allowJoin && sala.status !== "closed"
          ? el(
              "button",
              {
                class: "btn btn-primary",
                type: "button",
                onclick: async (evento) => {
                  const botao = evento.currentTarget;
                  botao.disabled = true;
                  try {
                    const dados = await api(`/api/rooms/${sala.code}/join`, { metodo: "POST" });
                    toast(dados.jaParticipava ? "Você já estava na sala." : "Entrada confirmada!");
                    await recarregar();
                  } catch (erro) {
                    tratarErroDeAcao(erro);
                    botao.disabled = false;
                  }
                },
              },
              "Entrar na sala"
            )
          : el("span", { class: "pill pill-muted" }, "Entrada fechada")
      : sala.allowJoin
        ? el("a", { class: "btn btn-primary", href: urlLogin(`/?sala=${sala.code}`) }, "Entrar com Discord")
        : el("span", { class: "pill pill-muted" }, "Entrada fechada"),
    sala.isOwner
      ? el(
          "button",
          {
            class: "btn btn-danger-ghost",
            type: "button",
            onclick: async () => {
              if (
                !confirm(
                  "Excluir esta sala? Só é possível excluir salas que ainda não têm ata registrada."
                )
              ) {
                return;
              }
              try {
                await api(`/api/rooms/${sala.code}`, { metodo: "DELETE" });
                toast("Sala excluída.");
                location.hash = "#/";
              } catch (erro) {
                tratarErroDeAcao(erro);
              }
            },
          },
          "Excluir sala"
        )
      : null
  );

  const cabecalho = el(
    "section",
    { class: "card room-head" },
    el(
      "div",
      { class: "room-head-main" },
      el(
        "div",
        { class: "room-meta" },
        el("span", { class: `badge ${sala.mode === "groups" ? "badge-groups" : "badge-order"}` }, modoRotulo(sala.mode)),
        codigoChip(sala.code),
        sala.status === "drawn" ? el("span", { class: "badge badge-done" }, "Já sorteada") : null
      ),
      el("h1", {}, sala.title),
      el(
        "p",
        { class: "muted" },
        `Organizador: ${sala.ownerName ?? "—"} · ${sala.participants.length} ${
          sala.participants.length === 1 ? "participante" : "participantes"
        }${sala.mode === "groups" && sala.groupSize ? ` · equipes de até ${sala.groupSize}` : ""} · ${sala.draws.length} ${
          sala.draws.length === 1 ? "ata" : "atas"
        }`
      )
    ),
    acoes
  );

  const listaParticipantes = el("section", { class: "card" }, el("h2", {}, "Participantes"));
  if (sala.participants.length === 0) {
    listaParticipantes.append(
      listaVazia(
        "Ninguém entrou ainda.",
        sala.isOwner
          ? "Adicione nomes manualmente no painel ao lado ou compartilhe o link para os alunos entrarem com o Discord."
          : "Compartilhe o link da sala ou peça ao organizador para adicionar seu nome."
      )
    );
  } else {
    listaParticipantes.append(
      el("ul", { class: "person-list" }, sala.participants.map((p) => linhaParticipante(p, sala, recarregar)))
    );
  }

  const colunaDireita = el("div", { class: "stack" });

  if (sala.isOwner) {
    const painel = el(
      "section",
      { class: "card owner-panel" },
      el("h2", {}, "Painel do organizador"),
      el(
        "p",
        { class: "muted small" },
        sala.draws.length === 0
          ? "Quando estiver tudo certo, execute o sorteio. O resultado vira uma ata imutável."
          : "Cada novo sorteio cria uma ata nova (seq + 1), encadeada pelo hash da anterior. Nenhuma ata é apagada."
      ),
      el(
        "button",
        {
          class: "btn btn-primary btn-lg",
          type: "button",
          disabled: !podeSortear,
          onclick: async (evento) => {
            const botao = evento.currentTarget;
            botao.disabled = true;
            botao.textContent = "Sorteando no servidor…";
            try {
              const dados = await api(`/api/rooms/${sala.code}/draw`, { metodo: "POST" });
              toast(`Ata ${dados.ata.verificationCode} registrada.`);
              location.hash = `#/ata/${dados.ata.verificationCode}`;
            } catch (erro) {
              tratarErroDeAcao(erro);
              botao.disabled = false;
              botao.textContent = "Sortear agora";
            }
          },
        },
        sala.draws.length === 0 ? "Sortear agora" : "Sortear novamente (nova ata)"
      ),
      !podeSortear
        ? el(
            "p",
            { class: "field-hint" },
            sala.status === "closed"
              ? "Esta sala está encerrada."
              : "Adicione pelo menos 2 participantes para liberar o sorteio."
          )
        : null,
      el("hr", { class: "divider" }),
      el("h3", {}, "Configurações"),
      formularioConfiguracoes(sala, recarregar),
      el("hr", { class: "divider" }),
      formularioAdicionarNomes(sala, recarregar)
    );
    colunaDireita.append(painel);
  }

  const listaAtas = el("section", { class: "card" }, el("h2", {}, "Atas desta sala"));
  if (sala.draws.length === 0) {
    listaAtas.append(
      listaVazia("Nenhuma ata ainda.", "O histórico aparece aqui depois do primeiro sorteio.")
    );
  } else {
    listaAtas.append(
      el(
        "div",
        { class: "draw-list" },
        sala.draws.map((ata) =>
          el(
            "a",
            { class: "draw-row", href: `#/ata/${ata.verificationCode}` },
            el(
              "span",
              { class: "draw-row-main" },
              el("strong", {}, `#${ata.seq} · ${ata.verificationCode}`),
              el("span", { class: "muted small" }, formatarData(ata.createdAt))
            ),
            el("span", { class: "draw-row-side" }, el("code", { class: "mono small" }, encurtarHash(ata.auditHash)))
          )
        )
      )
    );
  }

  const atalhoVerificar = el(
    "section",
    { class: "card callout" },
    el("h2", {}, "Como conferir"),
    el(
      "p",
      { class: "muted" },
      "Abra qualquer ata, copie o link público e use o botão “Verificar no meu navegador”. O navegador recalcula o SHA-256 e reaplica o Fisher-Yates sem pedir nada ao servidor."
    )
  );

  alvo.replaceChildren(
    el(
      "nav",
      { class: "breadcrumb", "aria-label": "Você está em" },
      el("a", { href: "#/" }, "Início"),
      el("span", { "aria-hidden": "true" }, "/"),
      el("span", { "aria-current": "page" }, sala.code)
    ),
    cabecalho,
    el("div", { class: "grid-2 grid-top" }, listaParticipantes, colunaDireita),
    atalhoVerificar
  );
  colunaDireita.append(listaAtas);
}

// ---------------------------------------------------------------------------
// Tela da ata
// ---------------------------------------------------------------------------

function blocoResultado(ata) {
  const secao = el("section", { class: "card result-card" }, el("h2", {}, "Resultado publicado"));

  if (ata.mode === "order") {
    secao.append(
      el(
        "ol",
        { class: "order-list" },
        ata.result.order.map((item) =>
          el(
            "li",
            {},
            el("span", { class: "order-position" }, `${item.position}º`),
            el("span", { class: "order-name" }, item.displayName)
          )
        )
      )
    );
    return secao;
  }

  secao.append(
    el(
      "div",
      { class: "group-grid" },
      ata.result.groups.map((grupo) =>
        el(
          "article",
          { class: "group-card" },
          el("h3", {}, `Equipe ${grupo.index}`),
          el(
            "ol",
            { class: "group-members" },
            grupo.members.map((membro) => el("li", {}, membro.displayName))
          )
        )
      )
    )
  );
  return secao;
}

function blocoVerificacao(ata) {
  const saida = el("div", { class: "verify-output", "aria-live": "polite" });
  const botao = el("button", { class: "btn btn-primary", type: "button" }, "Verificar no meu navegador");

  botao.addEventListener("click", async () => {
    botao.disabled = true;
    botao.textContent = "Recalculando SHA-256…";
    saida.replaceChildren();
    try {
      const resultado = await verificarAta(ata);
      const tudoCerto = resultado.hashConfere && resultado.replayConfere;

      saida.append(
        el(
          "div",
          { class: `verify-box ${tudoCerto ? "verify-ok" : "verify-fail"}` },
          el("strong", {}, tudoCerto ? "Ata íntegra ✔" : "Divergência encontrada ✘"),
          el(
            "ul",
            { class: "verify-list" },
            el(
              "li",
              {},
              `Hash SHA-256: ${resultado.hashConfere ? "confere" : "não confere"}`
            ),
            el(
              "li",
              {},
              `Fisher-Yates reproduzido: ${resultado.replayConfere ? "confere" : "não confere"}`
            )
          ),
          el("p", { class: "muted small" }, "Hash recalculado no seu navegador:"),
          el("code", { class: "hash-block" }, resultado.hashCalculado)
        )
      );
    } catch (erro) {
      saida.append(
        el("div", { class: "verify-box verify-fail" }, el("strong", {}, "Falha na verificação"), el("p", {}, erro.message))
      );
    } finally {
      botao.disabled = false;
      botao.textContent = "Verificar novamente";
    }
  });

  return el(
    "section",
    { class: "card verify-card" },
    el("h2", {}, "Verificação independente"),
    el(
      "p",
      { class: "muted" },
      "O navegador reconstrói o JSON canônico, calcula o SHA-256 e reaplica a trilha de trocas do Fisher-Yates. Nada é confiado à API."
    ),
    botao,
    saida
  );
}

async function renderAta(codigo) {
  const alvo = document.getElementById("app");
  alvo.replaceChildren(viewCarregando("Buscando a ata pública…"));

  let ata;
  try {
    const dados = await api(`/api/draws/${encodeURIComponent(codigo)}`);
    ata = dados.ata;
  } catch (erro) {
    document.title = "Ata não encontrada · Sorteador Auditável";
    alvo.replaceChildren(
      viewErro(
        erro.status === 404
          ? "Nenhuma ata foi encontrada com esse código. Confira os caracteres e tente novamente."
          : erro.message,
        { titulo: erro.status === 404 ? "Ata não encontrada" : "Erro ao consultar a ata" }
      )
    );
    return;
  }

  document.title = `${ata.verificationCode} · Ata pública`;

  const cabecalho = el(
    "section",
    { class: "card room-head" },
    el(
      "div",
      { class: "room-head-main" },
      el(
        "div",
        { class: "room-meta" },
        el("span", { class: "badge badge-done" }, "Ata imutável"),
        el("span", { class: `badge ${ata.mode === "groups" ? "badge-groups" : "badge-order"}` }, modoRotulo(ata.mode)),
        codigoChip(ata.verificationCode)
      ),
      el("h1", {}, ata.room.title),
      el(
        "p",
        { class: "muted" },
        `${formatarData(ata.createdAt)} · ${ata.participants.length} ${
          ata.participants.length === 1 ? "participante" : "participantes"
        }${ata.mode === "groups" && ata.groupSize ? ` · equipes de até ${ata.groupSize}` : ""}`
      ),
      el(
        "p",
        { class: "muted small" },
        "Sala de origem: ",
        el("a", { href: `#/sala/${ata.room.publicCode}` }, ata.room.publicCode),
        ata.prevDrawCode ? el("span", {}, " · ata anterior: ", el("a", { href: `#/ata/${ata.prevDrawCode}` }, ata.prevDrawCode)) : null
      )
    ),
    el(
      "div",
      { class: "room-actions" },
      botaoCopiar(urlDaAta(ata.verificationCode), "Copiar link público"),
      el("button", { class: "btn btn-secondary", type: "button", onclick: () => window.print() }, "Imprimir ata")
    )
  );

  const blocoHash = el(
    "section",
    { class: "card" },
    el("h2", {}, "Integridade"),
    el(
      "dl",
      { class: "hash-list" },
      el("dt", {}, "Algoritmo"),
      el("dd", {}, `${ata.algorithm} v${ata.algorithmVersion}`),
      el("dt", {}, "SHA-256 da ata"),
      el("dd", {}, el("code", { class: "hash-block" }, ata.auditHash)),
      el("dt", {}, "Hash da ata anterior"),
      el("dd", {}, ata.prevHash ? el("code", { class: "hash-block" }, ata.prevHash) : "— (primeira ata desta sala)"),
      el("dt", {}, "Data/hora do registro"),
      el("dd", {}, `${formatarData(ata.createdAt)} (${ata.createdAt})`)
    ),
    el(
      "p",
      { class: "muted small" },
      "A ata é append-only: os triggers do D1 bloqueiam UPDATE e DELETE. Re-sorteios criam novas atas com seq + 1."
    )
  );

  const snapshot = el(
    "section",
    { class: "card" },
    el("h2", {}, "Snapshot dos participantes"),
    el(
      "ul",
      { class: "person-list" },
      ata.participants.map((pessoa) =>
        el(
          "li",
          { class: "person-row" },
          el("span", { class: "person-name" }, pessoa.displayName),
          badgeOrigem(pessoa.source)
        )
      )
    )
  );

  alvo.replaceChildren(
    el(
      "nav",
      { class: "breadcrumb", "aria-label": "Você está em" },
      el("a", { href: "#/" }, "Início"),
      el("span", { "aria-hidden": "true" }, "/"),
      el("a", { href: `#/sala/${ata.room.publicCode}` }, ata.room.publicCode),
      el("span", { "aria-hidden": "true" }, "/"),
      el("span", { "aria-current": "page" }, ata.verificationCode)
    ),
    cabecalho,
    el("div", { class: "grid-2 grid-top" }, blocoResultado(ata), el("div", { class: "stack" }, blocoVerificacao(ata), blocoHash)),
    snapshot,
    el(
      "p",
      { class: "muted small project-key" },
      `Chave do projeto: ${CHAVE_PROJETO}`
    )
  );
}

// ---------------------------------------------------------------------------
// Roteador
// ---------------------------------------------------------------------------

async function rotear() {
  const rota = decodeURIComponent((location.hash || "#/").replace(/^#/, "")) || "/";
  const alvo = document.getElementById("app");
  if (!alvo) return;

  try {
    if (rota.startsWith("/sala/")) {
      const codigo = rota.slice("/sala/".length).split("/")[0];
      if (!codigo) location.hash = "#/";
      else await renderSala(codigo);
      return;
    }
    if (rota.startsWith("/ata/")) {
      const codigo = rota.slice("/ata/".length).split("/")[0];
      if (!codigo) location.hash = "#/";
      else await renderAta(codigo);
      return;
    }
    await renderInicio();
  } catch (erro) {
    console.error(erro);
    alvo.replaceChildren(viewErro("Ocorreu um erro inesperado ao montar a página."));
  }
}

function prepararQueryInicial() {
  const url = new URL(location.href);
  const sala = url.searchParams.get("sala");
  const ata = url.searchParams.get("ata");
  const login = url.searchParams.get("login");
  const erroLogin = url.searchParams.get("auth_error");

  if (!sala && !ata && !login && !erroLogin) return;

  let destino = "#/";
  if (sala) destino = `#/sala/${encodeURIComponent(sala)}`;
  else if (ata) destino = `#/ata/${encodeURIComponent(ata)}`;

  history.replaceState(null, "", `${url.pathname}${destino}`);

  if (login === "success") toast("Login realizado com o Discord.");
  if (erroLogin) {
    const mensagens = {
      nao_configurado: "O login Discord ainda não está configurado neste deploy.",
      state_invalido: "A sessão de login expirou. Tente novamente.",
      discord_recusou: "O Discord recusou a autorização.",
      callback_incompleto: "O Discord não devolveu o código de autorização.",
      falha_login: "Não foi possível concluir o login. Tente novamente.",
    };
    toast(mensagens[erroLogin] || "Falha no login com o Discord.", "erro");
  }
}

async function iniciar() {
  prepararQueryInicial();
  renderCabecalho();

  try {
    const dados = await api("/api/me");
    estado.usuario = dados.autenticado ? dados.usuario : null;
    estado.configurado = Boolean(dados.discordConfigurado);
  } catch {
    estado.usuario = null;
    estado.configurado = false;
  } finally {
    estado.carregando = false;
    renderCabecalho();
  }

  window.addEventListener("hashchange", rotear);
  await rotear();
}

iniciar();
