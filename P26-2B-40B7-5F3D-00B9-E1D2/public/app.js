(() => {
  const ROTULOS = { nenhum: "Sem impedimento", baixo: "Baixo", medio: "Médio", critico: "Crítico" };
  const $ = (id) => document.getElementById(id);

  async function carregarSessao() {
    try {
      const r = await fetch("/api/status");
      const d = await r.json();
      return d.sessionUser || null;
    } catch { return null; }
  }

  function mostrarUsuario(u) {
    const box = $("usuario");
    box.textContent = "";
    const img = document.createElement("img");
    img.src = u.avatar; img.alt = ""; img.width = 28; img.height = 28;
    const nome = document.createElement("span");
    nome.textContent = u.username;
    const sair = document.createElement("button");
    sair.type = "button"; sair.className = "btn-link"; sair.textContent = "Sair";
    sair.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.href = "/";
    });
    box.append(img, nome, sair);
  }

  // Tudo entra por textContent: nunca interpretamos o texto como HTML.
  function desenhar(entradas) {
    const ol = $("linha");
    ol.textContent = "";
    if (!entradas.length) {
      const li = document.createElement("li");
      li.className = "vazio";
      li.textContent = "Nenhuma entrada encontrada.";
      ol.append(li);
      return;
    }
    for (const e of entradas) {
      const li = document.createElement("li");
      li.className = "item nivel-" + e.impedimento;
      const meta = document.createElement("div");
      meta.className = "meta";
      const t = document.createElement("time");
      t.dateTime = e.created_at;
      t.textContent = new Date(e.created_at).toLocaleString("pt-BR");
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = ROTULOS[e.impedimento] || e.impedimento;
      meta.append(t, badge);
      const p = document.createElement("p");
      p.textContent = e.texto;
      li.append(meta, p);
      ol.append(li);
    }
  }

  async function listar() {
    const params = new URLSearchParams();
    for (const id of ["q", "de", "ate"]) {
      const v = $(id).value.trim();
      if (v) params.set(id, v);
    }
    const r = await fetch("/api/entradas?" + params);
    if (r.status === 401) { location.href = "/"; return; }
    const d = await r.json();
    desenhar(d.entradas || []);
  }

  $("form-busca").addEventListener("submit", (ev) => { ev.preventDefault(); listar(); });

  $("form-entrada").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msg");
    msg.textContent = "Salvando...";
    // Só mandamos texto e nível: dono e data são decididos pelo servidor.
    const r = await fetch("/api/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: $("texto").value, impedimento: $("impedimento").value }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      $("texto").value = "";
      msg.textContent = "Entrada registrada.";
      listar();
    } else {
      msg.textContent = d.error || "Não foi possível salvar.";
    }
  });

  (async () => {
    const u = await carregarSessao();
    if (!u) { $("login").hidden = false; return; }
    mostrarUsuario(u);
    $("app").hidden = false;
    listar();
  })();
})();