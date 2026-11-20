const $ = (id) => document.getElementById(id);
let currentUser = null;
let capsuleTimers = [];

async function api(path, options) {
  const res = await fetch(path, options);
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { res, data };
}

function avatarImg(url) {
  const img = document.createElement("img");
  img.alt = "";
  const ok = typeof url === "string" && url.startsWith("https://cdn.discordapp.com/");
  img.src = ok ? url : "https://cdn.discordapp.com/embed/avatars/0.png";
  return img;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("pt-BR");
}

function formatCountdown(ms) {
  if (ms <= 0) return "Desbloqueando...";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}min ${sec}s`;
}

function showAlert(msg) {
  const a = $("alert");
  a.textContent = msg;
  a.hidden = !msg;
}

async function loadUser() {
  const { res, data } = await api("/api/me");
  currentUser = res.ok && data && data.ok ? data.user : null;

  const box = $("auth");
  box.replaceChildren();
  if (currentUser) {
    const name = document.createElement("span");
    name.textContent = currentUser.username;
    const out = document.createElement("button");
    out.className = "btn-light";
    out.textContent = "Sair";
    out.addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      location.href = "/";
    });
    box.append(avatarImg(currentUser.avatar), name, out);
  } else {
    const a = document.createElement("a");
    a.className = "btn";
    a.href = "/api/auth/discord";
    a.textContent = "Entrar com Discord";
    box.append(a);
  }

  $("form-msg").hidden = !currentUser;
  $("msg-hint").hidden = !!currentUser;
  $("form-cap").hidden = !currentUser;
  $("cap-hint").hidden = !!currentUser;
}

async function loadMessages() {
  const { data } = await api("/api/messages");
  const ul = $("messages");
  ul.replaceChildren();
  const list = data && data.messages ? data.messages : [];
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nenhum depoimento ainda. Seja a primeira pessoa!";
    ul.append(li);
    return;
  }
  for (const m of list) {
    const li = document.createElement("li");
    li.className = "item";
    const box = document.createElement("div");
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${m.author} · ${formatDate(m.created_at.replace(" ", "T") + "Z")}`;
    const text = document.createElement("p");
    text.className = "text";
    text.textContent = m.body;
    box.append(meta, text);
    li.append(avatarImg(m.avatar), box);
    ul.append(li);
  }
}

async function loadCapsules() {
  capsuleTimers.forEach(clearInterval);
  capsuleTimers = [];

  const { data } = await api("/api/capsules");
  const ul = $("capsules");
  ul.replaceChildren();
  const list = data && data.capsules ? data.capsules : [];
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nenhuma cápsula criada ainda.";
    ul.append(li);
    return;
  }

  for (const c of list) {
    const li = document.createElement("li");
    li.className = "item" + (c.locked ? " locked" : "");
    const box = document.createElement("div");

    const title = document.createElement("strong");
    title.textContent = (c.locked ? "🔒 " : "🔓 ") + c.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    const dest = c.target === "self" ? "para si mesmo(a)" : "para a turma";
    meta.textContent = `${c.author} · ${dest} · desbloqueia em ${formatDate(c.unlock_date)}`;

    box.append(title, meta);

    if (c.locked) {
      const cd = document.createElement("p");
      cd.className = "countdown";
      const unlockAt = Date.now() + c.seconds_left * 1000;
      const tick = () => {
        const left = unlockAt - Date.now();
        cd.textContent = formatCountdown(left);
        if (left <= 0) { clearInterval(timer); loadCapsules(); }
      };
      const timer = setInterval(tick, 1000);
      capsuleTimers.push(timer);
      tick();
      box.append(cd);
    } else {
      const text = document.createElement("p");
      text.className = "text";
      text.textContent = c.body;
      box.append(text);
    }

    li.append(avatarImg(c.avatar), box);
    ul.append(li);
  }
}

$("form-msg").addEventListener("submit", async (e) => {
  e.preventDefault();
  showAlert("");
  const { res, data } = await api("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: $("msg-body").value }),
  });
  if (!res.ok) return showAlert((data && data.error) || "Erro ao publicar.");
  $("msg-body").value = "";
  loadMessages();
});

$("form-cap").addEventListener("submit", async (e) => {
  e.preventDefault();
  showAlert("");
  const when = new Date($("cap-date").value);
  if (isNaN(when.getTime())) return showAlert("Escolha uma data válida.");
  const { res, data } = await api("/api/capsules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: $("cap-title").value,
      body: $("cap-body").value,
      target: $("cap-target").value,
      unlock_date: when.toISOString(),
    }),
  });
  if (!res.ok) return showAlert((data && data.error) || "Erro ao criar cápsula.");
  e.target.reset();
  loadCapsules();
});

(async function init() {
  const err = new URLSearchParams(location.search).get("auth_error");
  if (err) showAlert("Não foi possível entrar com o Discord (" + err + "). Tente de novo.");
  await loadUser();
  loadMessages();
  loadCapsules();
})();