"use strict";

const estado = { usuario: null, aba: "buscar" };

const raiz = document.getElementById("conteudo");
const abasEl = document.getElementById("abas");
const usuarioEl = document.getElementById("usuario");
const avisosEl = document.getElementById("avisos");

const ABAS = [
  { id: "buscar", rotulo: "Buscar caronas" },
  { id: "oferecer", rotulo: "Oferecer carona" },
  { id: "painel", rotulo: "Painel do motorista" },
  { id: "reservas", rotulo: "Minhas reservas" },
];

const ERROS_LOGIN = {
  login_cancelado: "Você cancelou o login no Discord. Tente entrar de novo.",
  estado_invalido: "Não foi possível confirmar o login. Clique em entrar novamente.",
  troca_token: "O Discord não aceitou o login. Confira as credenciais do aplicativo e tente de novo.",
  perfil: "Não foi possível ler seu perfil do Discord. Tente novamente.",
  config: "O servidor ainda não está configurado para o login com Discord.",
};

function el(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") no.className = valor;
    else if (chave === "text") no.textContent = valor;
    else if (chave.startsWith("on") && typeof valor === "function") no.addEventListener(chave.slice(2), valor);
    else if (valor === true) no.setAttribute(chave, "");
    else no.setAttribute(chave, valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    no.append(filho.nodeType ? filho : document.createTextNode(String(filho)));
  }
  return no;
}

function hojeLocal() {
  return new Date().toLocaleDateString("en-CA");
}

function formatarData(data) {
  const d = new Date(`${data}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function aviso(mensagem, tipo = "ok") {
  const item = el("p", { class: `aviso ${tipo}`, text: mensagem });
  avisosEl.append(item);
  setTimeout(() => item.remove(), 4500);
}

async function api(caminho, opcoes = {}) {
  const config = { method: opcoes.metodo || "GET", headers: {}, credentials: "same-origin" };
  if (opcoes.corpo !== undefined) {
    config.headers["content-type"] = "application/json";
    config.body = JSON.stringify(opcoes.corpo);
  }
  const resposta = await fetch(caminho, config);
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    dados = null;
  }
  if (resposta.status === 401) {
    estado.usuario = null;
    renderizar();
    throw new Error(dados?.erro || "Sessão expirada. Entre novamente.");
  }
  if (!resposta.ok) throw new Error(dados?.erro || "Algo deu errado. Tente de novo.");
  return dados;
}

function carregando() {
  raiz.replaceChildren(el("p", { class: "vazio", text: "Carregando..." }));
}

function pessoa(nome, username, avatar, grande = false) {
  return el(
    "div",
    { class: "pessoa" },
    el("img", { class: grande ? "avatar grande" : "avatar", src: avatar, alt: "", width: grande ? 44 : 32, height: grande ? 44 : 32 }),
    el("div", { class: "pessoa-texto" }, el("strong", { text: nome }), el("span", { text: `@${username}` }))
  );
}

function linkDiscord(id, rotulo) {
  return el("a", { class: "botao contorno pequeno", href: `https://discord.com/users/${id}`, target: "_blank", rel: "noopener noreferrer", text: rotulo });
}

function textoVagas(livres, totais) {
  if (livres === 0) return "Lotada";
  return `${livres} de ${totais} ${livres === 1 ? "vaga livre" : "vagas livres"}`;
}

function cartaoRota(rota, extras = []) {
  const assentos = el("div", { class: "assentos", role: "img", "aria-label": textoVagas(rota.vagas_livres, rota.vagas_totais) });
  for (let i = 0; i < rota.vagas_totais; i++) {
    assentos.append(el("span", { class: i < rota.vagas_livres ? "assento livre" : "assento" }));
  }
  return el(
    "article",
    { class: "rota" },
    el("div", { class: "rota-horario" }, el("strong", { text: rota.horario }), el("span", { text: formatarData(rota.data) })),
    el(
      "div",
      { class: "rota-trajeto" },
      el("p", { class: "parada" }, el("span", { class: "ponto" }), rota.origem),
      el("p", { class: "parada" }, el("span", { class: "ponto destino" }), rota.destino)
    ),
    el("div", { class: "rota-lateral" }, assentos, el("span", { class: "vagas-texto", text: textoVagas(rota.vagas_livres, rota.vagas_totais) })),
    ...extras
  );
}

function telaLogin(codigoErro) {
  const mensagem = codigoErro ? ERROS_LOGIN[codigoErro] || "Não foi possível entrar. Tente novamente." : null;
  raiz.replaceChildren(
    el(
      "section",
      { class: "apresentacao" },
      el("h2", { text: "Divida o caminho até o campus" }),
      el("p", { class: "subtitulo", text: "Quem tem carro oferece vagas. Quem precisa de transporte reserva a sua. Tudo combinado pelo Discord." }),
      el(
        "ol",
        {},
        el("li", { text: "Entre com sua conta do Discord." }),
        el("li", { text: "Motoristas cadastram bairro de origem, destino, horário e vagas." }),
        el("li", { text: "Passageiros filtram as rotas do dia e reservam uma vaga." }),
        el("li", { text: "O motorista vê quem confirmou e combina o ponto de encontro." })
      ),
      mensagem ? el("p", { class: "aviso erro", role: "alert", text: mensagem }) : null,
      el("a", { class: "botao discord", href: "/api/auth/login", text: "Entrar com Discord" })
    )
  );
}

function renderizarCabecalho() {
  if (!estado.usuario) {
    usuarioEl.replaceChildren();
    abasEl.hidden = true;
    return;
  }
  const u = estado.usuario;
  usuarioEl.replaceChildren(
    el(
      "div",
      { class: "usuario" },
      el("img", { class: "avatar", src: u.avatar_url, alt: "", width: 32, height: 32 }),
      el("span", { class: "nome", text: u.nome }),
      el("button", { class: "botao contorno pequeno", type: "button", text: "Sair", onclick: sair })
    )
  );
  abasEl.hidden = false;
  abasEl.replaceChildren(
    ...ABAS.map((aba) =>
      el("button", {
        class: "aba",
        type: "button",
        text: aba.rotulo,
        "aria-current": estado.aba === aba.id ? "page" : null,
        onclick: () => {
          estado.aba = aba.id;
          renderizar();
        },
      })
    )
  );
}

function renderizar() {
  renderizarCabecalho();
  if (!estado.usuario) return telaLogin(estado.erroLogin);
  if (estado.aba === "buscar") return abaBuscar();
  if (estado.aba === "oferecer") return abaOferecer();
  if (estado.aba === "painel") return abaPainel();
  return abaReservas();
}

async function sair() {
  try {
    await api("/api/auth/logout", { metodo: "POST" });
  } catch {
    estado.usuario = null;
  }
  estado.usuario = null;
  estado.aba = "buscar";
  renderizar();
}

function abaBuscar() {
  const campoData = el("input", { id: "f-data", type: "date", value: estado.filtros?.data || hojeLocal(), min: hojeLocal(), required: true });
  const campoOrigem = el("input", { id: "f-origem", type: "text", maxlength: 60, placeholder: "Ex.: Portão", value: estado.filtros?.origem || "" });
  const campoDestino = el("input", { id: "f-destino", type: "text", maxlength: 60, placeholder: "Ex.: Campus", value: estado.filtros?.destino || "" });
  const lista = el("div", { class: "lista" });

  async function buscar() {
    estado.filtros = { data: campoData.value, origem: campoOrigem.value, destino: campoDestino.value };
    const parametros = new URLSearchParams({ data: campoData.value, origem: campoOrigem.value, destino: campoDestino.value });
    lista.replaceChildren(el("p", { class: "vazio", text: "Buscando rotas..." }));
    try {
      const { rotas } = await api(`/api/rotas?${parametros}`);
      if (rotas.length === 0) {
        lista.replaceChildren(
          el(
            "div",
            { class: "vazio" },
            el("p", { text: "Nenhuma carona encontrada para esse dia e filtros." }),
            el("button", { class: "botao", type: "button", text: "Oferecer uma carona", onclick: () => { estado.aba = "oferecer"; renderizar(); } })
          )
        );
        return;
      }
      lista.replaceChildren(...rotas.map(cartaoRotaBusca));
    } catch (falha) {
      lista.replaceChildren(el("p", { class: "vazio", text: falha.message }));
    }
  }

  function cartaoRotaBusca(rota) {
    let botao;
    if (rota.sou_motorista) {
      botao = el("button", { class: "botao contorno", type: "button", disabled: true, text: "Sua rota" });
    } else if (rota.ja_reservei) {
      botao = el("button", { class: "botao perigo", type: "button", text: "Cancelar reserva", onclick: () => cancelarReserva(rota.id, buscar) });
    } else if (rota.vagas_livres === 0) {
      botao = el("button", { class: "botao", type: "button", disabled: true, text: "Lotada" });
    } else {
      botao = el("button", { class: "botao", type: "button", text: "Reservar vaga", onclick: () => reservar(rota.id, buscar) });
    }
    return cartaoRota(rota, [
      el("div", { class: "rota-rodape" }, pessoa(rota.motorista_nome, rota.motorista_username, rota.motorista_avatar), botao),
    ]);
  }

  raiz.replaceChildren(
    el("h2", { text: "Caronas do dia" }),
    el("p", { class: "subtitulo", text: "Escolha a data e filtre por bairro de origem ou destino." }),
    el(
      "form",
      {
        class: "filtros",
        onsubmit: (evento) => {
          evento.preventDefault();
          buscar();
        },
      },
      el("div", { class: "campo" }, el("label", { for: "f-data", text: "Data" }), campoData),
      el("div", { class: "campo" }, el("label", { for: "f-origem", text: "Bairro de origem" }), campoOrigem),
      el("div", { class: "campo" }, el("label", { for: "f-destino", text: "Destino" }), campoDestino),
      el("button", { class: "botao", type: "submit", text: "Filtrar rotas" })
    ),
    lista
  );
  buscar();
}

async function reservar(id, depois) {
  try {
    await api(`/api/rotas/${id}/reservar`, { metodo: "POST" });
    aviso("Vaga reservada. O contato do motorista está em Minhas reservas.");
  } catch (falha) {
    aviso(falha.message, "erro");
  }
  if (estado.usuario) depois();
}

async function cancelarReserva(id, depois) {
  if (!confirm("Cancelar sua reserva nesta carona?")) return;
  try {
    await api(`/api/rotas/${id}/reservar`, { metodo: "DELETE" });
    aviso("Reserva cancelada.");
  } catch (falha) {
    aviso(falha.message, "erro");
  }
  if (estado.usuario) depois();
}

function abaOferecer() {
  const campos = {
    origem: el("input", { id: "o-origem", type: "text", maxlength: 60, required: true, placeholder: "Ex.: Água Verde" }),
    destino: el("input", { id: "o-destino", type: "text", maxlength: 60, required: true, placeholder: "Ex.: Campus Pinhais" }),
    data: el("input", { id: "o-data", type: "date", required: true, min: hojeLocal(), value: hojeLocal() }),
    horario: el("input", { id: "o-horario", type: "time", required: true }),
    vagas: el("select", { id: "o-vagas" }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => el("option", { value: n, text: String(n), selected: n === 3 }))),
  };
  const botao = el("button", { class: "botao", type: "submit", text: "Publicar rota" });

  raiz.replaceChildren(
    el("h2", { text: "Oferecer carona" }),
    el("p", { class: "subtitulo", text: "Informe a rota e quantas vagas livres você tem no carro." }),
    el(
      "form",
      {
        class: "formulario",
        onsubmit: async (evento) => {
          evento.preventDefault();
          botao.disabled = true;
          try {
            await api("/api/rotas", {
              metodo: "POST",
              corpo: {
                origem: campos.origem.value,
                destino: campos.destino.value,
                data: campos.data.value,
                horario: campos.horario.value,
                vagas: Number(campos.vagas.value),
              },
            });
            aviso("Rota publicada.");
            estado.aba = "painel";
            renderizar();
          } catch (falha) {
            aviso(falha.message, "erro");
            botao.disabled = false;
          }
        },
      },
      el("div", { class: "campo" }, el("label", { for: "o-origem", text: "Bairro de origem" }), campos.origem),
      el("div", { class: "campo" }, el("label", { for: "o-destino", text: "Destino" }), campos.destino),
      el("div", { class: "campo" }, el("label", { for: "o-data", text: "Data" }), campos.data),
      el("div", { class: "campo" }, el("label", { for: "o-horario", text: "Horário de saída" }), campos.horario),
      el(
        "div",
        { class: "campo" },
        el("label", { for: "o-vagas", text: "Vagas livres no carro" }),
        campos.vagas,
        el("p", { class: "dica", text: "Conte só os lugares para passageiros, sem o seu." })
      ),
      botao
    )
  );
}

async function abaPainel() {
  carregando();
  try {
    const { rotas } = await api("/api/minhas-rotas");
    const titulo = [el("h2", { text: "Painel do motorista" }), el("p", { class: "subtitulo", text: "Veja quem confirmou vaga e combine o ponto exato de encontro pelo Discord." })];
    if (rotas.length === 0) {
      raiz.replaceChildren(
        ...titulo,
        el(
          "div",
          { class: "vazio" },
          el("p", { text: "Você ainda não tem rotas ativas." }),
          el("button", { class: "botao", type: "button", text: "Oferecer uma carona", onclick: () => { estado.aba = "oferecer"; renderizar(); } })
        )
      );
      return;
    }
    raiz.replaceChildren(
      ...titulo,
      el(
        "div",
        { class: "lista" },
        ...rotas.map((rota) => {
          const extras = [];
          if (rota.passageiros.length === 0) {
            extras.push(el("p", { class: "passageiros-titulo", text: "Nenhum passageiro confirmado ainda." }));
          } else {
            extras.push(el("p", { class: "passageiros-titulo", text: `Passageiros confirmados (${rota.passageiros.length})` }));
            extras.push(
              el(
                "ul",
                { class: "passageiros" },
                ...rota.passageiros.map((p) =>
                  el(
                    "li",
                    {},
                    pessoa(p.nome, p.username, p.avatar_url),
                    el("span", { class: "dica", text: `ID Discord: ${p.discord_id}` }),
                    linkDiscord(p.discord_id, "Abrir no Discord")
                  )
                )
              )
            );
          }
          extras.push(
            el(
              "div",
              { class: "rota-rodape" },
              el("span", { class: "dica", text: "Cancelar a rota não avisa ninguém automaticamente. Combine pelo Discord." }),
              el("button", { class: "botao perigo pequeno", type: "button", text: "Cancelar rota", onclick: () => cancelarRota(rota.id) })
            )
          );
          return cartaoRota(rota, extras);
        })
      )
    );
  } catch (falha) {
    if (estado.usuario) raiz.replaceChildren(el("p", { class: "vazio", text: falha.message }));
  }
}

async function cancelarRota(id) {
  if (!confirm("Cancelar esta rota? Os passageiros deixam de vê-la.")) return;
  try {
    await api(`/api/rotas/${id}`, { metodo: "DELETE" });
    aviso("Rota cancelada.");
  } catch (falha) {
    aviso(falha.message, "erro");
  }
  if (estado.usuario) abaPainel();
}

async function abaReservas() {
  carregando();
  try {
    const { reservas } = await api("/api/minhas-reservas");
    const titulo = [el("h2", { text: "Minhas reservas" }), el("p", { class: "subtitulo", text: "Chame o motorista no Discord para combinar o ponto de encontro." })];
    if (reservas.length === 0) {
      raiz.replaceChildren(
        ...titulo,
        el(
          "div",
          { class: "vazio" },
          el("p", { text: "Você não tem reservas ativas." }),
          el("button", { class: "botao", type: "button", text: "Buscar caronas", onclick: () => { estado.aba = "buscar"; renderizar(); } })
        )
      );
      return;
    }
    raiz.replaceChildren(
      ...titulo,
      el(
        "div",
        { class: "lista" },
        ...reservas.map((rota) =>
          cartaoRota(rota, [
            el(
              "div",
              { class: "rota-rodape" },
              pessoa(rota.motorista_nome, rota.motorista_username, rota.motorista_avatar),
              el(
                "div",
                { class: "pessoa" },
                linkDiscord(rota.motorista_id, "Falar com o motorista"),
                el("button", { class: "botao perigo pequeno", type: "button", text: "Cancelar reserva", onclick: () => cancelarReserva(rota.id, abaReservas) })
              )
            ),
          ])
        )
      )
    );
  } catch (falha) {
    if (estado.usuario) raiz.replaceChildren(el("p", { class: "vazio", text: falha.message }));
  }
}

async function iniciar() {
  const parametros = new URLSearchParams(location.search);
  estado.erroLogin = parametros.get("erro");
  if (estado.erroLogin) history.replaceState(null, "", "/");
  carregando();
  try {
    const resposta = await fetch("/api/me", { credentials: "same-origin" });
    if (resposta.ok) estado.usuario = (await resposta.json()).usuario;
  } catch {
    estado.usuario = null;
  }
  renderizar();
}

iniciar();
