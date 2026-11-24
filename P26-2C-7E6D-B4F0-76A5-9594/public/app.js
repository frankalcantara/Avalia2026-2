const ROTULOS = { ensino: "Ensino", pesquisa: "Pesquisa", extensao: "Extensão" };
const $ = (id) => document.getElementById(id);

function mostrarMsg(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = "msg" + (tipo ? " " + tipo : "");
}

function renderUsuario(user) {
  const area = $("userArea");
  area.replaceChildren();
  const box = document.createElement("div");
  box.className = "usuario";
  const img = document.createElement("img");
  img.src = user.avatar;
  img.alt = "Avatar de " + user.username;
  const nome = document.createElement("span");
  nome.textContent = user.username;
  box.append(img, nome);
  area.appendChild(box);
}

function renderBarras(horas, teto) {
  const container = $("bars");
  container.replaceChildren();
  let soma = 0;

  for (const cat of Object.keys(ROTULOS)) {
    const feitas = horas[cat] || 0;
    soma += feitas;
    const pct = Math.min(100, Math.round((feitas / teto) * 100));
    const faltam = Math.max(0, teto - feitas);

    const barra = document.createElement("div");
    barra.className = "barra";

    const topo = document.createElement("div");
    topo.className = "barra-topo";
    const rotulo = document.createElement("strong");
    rotulo.textContent = ROTULOS[cat];
    const detalhe = document.createElement("span");
    detalhe.textContent = feitas + " / " + teto + " h" + (faltam > 0 ? " (faltam " + faltam + " h)" : " (completo)");
    topo.append(rotulo, detalhe);

    const trilho = document.createElement("div");
    trilho.className = "trilho";
    trilho.setAttribute("role", "progressbar");
    trilho.setAttribute("aria-label", ROTULOS[cat]);
    trilho.setAttribute("aria-valuemin", "0");
    trilho.setAttribute("aria-valuemax", String(teto));
    trilho.setAttribute("aria-valuenow", String(feitas));
    const preenche = document.createElement("div");
    preenche.className = "preenche" + (pct >= 100 ? " completo" : "");
    preenche.style.width = pct + "%";
    trilho.appendChild(preenche);

    barra.append(topo, trilho);
    container.appendChild(barra);
  }

  const totalNecessario = teto * Object.keys(ROTULOS).length;
  const faltamTotal = Math.max(0, totalNecessario - soma);
  $("totalGeral").textContent = "Total: " + soma + " / " + totalNecessario + " h — faltam " + faltamTotal + " h para integralizar.";

  const campo = $("horas");
  campo.max = String(teto);
}

function renderLista(atividades) {
  const ul = $("lista");
  ul.replaceChildren();
  if (atividades.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma atividade registrada ainda.";
    ul.appendChild(li);
    return;
  }
  for (const a of atividades) {
    const li = document.createElement("li");
    const esquerda = document.createElement("div");
    const titulo = document.createElement("strong");
    titulo.textContent = a.titulo;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (ROTULOS[a.categoria] || a.categoria) + " · " + a.horas + " h · " + a.created_at;
    esquerda.append(titulo, meta);

    const link = document.createElement("a");
    link.href = a.link_certificado;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Ver certificado";

    li.append(esquerda, link);
    ul.appendChild(li);
  }
}

async function carregarAtividades() {
  const res = await fetch("/api/atividades");
  if (res.status === 401) {
    window.location.href = "/";
    return;
  }
  const dados = await res.json();
  renderBarras(dados.horas, dados.teto);
  renderLista(dados.atividades);
}

async function enviarAtividade(evento) {
  evento.preventDefault();
  const msg = $("formMsg");
  const botao = $("btnEnviar");

  const corpo = {
    titulo: $("titulo").value.trim(),
    categoria: $("categoria").value,
    horas: Number($("horas").value),
    link_certificado: $("link").value.trim(),
  };

  if (!corpo.titulo || !Number.isInteger(corpo.horas) || corpo.horas < 1 || !corpo.link_certificado) {
    mostrarMsg(msg, "Preencha título, horas (número inteiro) e link do certificado.", "erro");
    return;
  }

  botao.disabled = true;
  mostrarMsg(msg, "Enviando...", "");
  try {
    const res = await fetch("/api/atividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await res.json().catch(() => ({}));
    if (res.ok) {
      $("formAtividade").reset();
      mostrarMsg(msg, "Atividade registrada!", "ok");
      await carregarAtividades();
    } else if (res.status === 401) {
      window.location.href = "/";
    } else {
      mostrarMsg(msg, dados.message || "Não foi possível registrar.", "erro");
    }
  } catch {
    mostrarMsg(msg, "Falha de conexão com a API.", "erro");
  } finally {
    botao.disabled = false;
  }
}

async function iniciar() {
  const erro = new URLSearchParams(window.location.search).get("auth_error");
  if (erro) {
    const el = $("authError");
    el.textContent = "Não foi possível entrar com o Discord (" + erro + "). Tente novamente.";
    el.hidden = false;
  }

  let status = null;
  try {
    const res = await fetch("/api/status");
    status = await res.json();
  } catch {}

  const user = status && status.sessionUser;
  if (!user) {
    $("loginPrompt").hidden = false;
    return;
  }

  renderUsuario(user);
  $("app").hidden = false;
  $("formAtividade").addEventListener("submit", enviarAtividade);
  await carregarAtividades();
}

iniciar();