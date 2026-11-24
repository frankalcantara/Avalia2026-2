/* A interface lê dados e apresenta resultados. O sorteio é executado pela API. */
const $ = (id) => document.getElementById(id);
let currentUser = null;
let currentRoom = null;
let currentDraw = null;
let roomPoll = null;

function showMessage(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
  $("message").hidden = !text;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.message || data.error || "Não foi possível concluir a solicitação.",
    );
  return data;
}

async function busy(button, action) {
  button.disabled = true;
  try {
    showMessage("");
    await action();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function dateText(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function routeUrl(key, value) {
  const url = new URL("/", location.origin);
  url.searchParams.set(key, value);
  return url.href;
}

function loginUrl() {
  return `/api/auth/discord?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
}

function renderProfile() {
  document.querySelectorAll(".login").forEach((link) => {
    link.href = loginUrl();
  });
  $("loginHint").hidden = !!currentUser;
  if (!currentUser) return;
  const profile = document.createElement("div");
  profile.className = "profile";
  const avatar = document.createElement("img");
  avatar.src =
    currentUser.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
  avatar.alt = "";
  const name = document.createElement("div");
  const username = document.createElement("div");
  username.className = "username";
  username.textContent = currentUser.username;
  const id = document.createElement("small");
  id.textContent = `Discord · ${currentUser.user_id}`;
  name.append(username, id);
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "Sair";
  logout.addEventListener("click", () =>
    busy(logout, async () => {
      await api("/api/logout", { method: "POST", body: "{}" });
      location.reload();
    }),
  );
  profile.append(avatar, name, logout);
  $("profile").replaceChildren(profile);
}

async function loadMyRooms() {
  if (!currentUser) return;
  const data = await api("/api/rooms");
  $("myRooms").replaceChildren();
  for (const room of data.rooms) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = routeUrl("room", room.id);
    const title = document.createElement("strong");
    title.textContent = room.title;
    const state = document.createElement("span");
    state.textContent = room.draw_code ? "Ata disponível →" : "Sala aberta →";
    link.append(title, state);
    item.append(link);
    $("myRooms").append(item);
  }
  $("myRoomsSection").hidden = data.rooms.length === 0;
}

async function loadRoom(id) {
  const data = await api(`/api/rooms/${encodeURIComponent(id)}`);
  currentRoom = data.room;
  $("roomSection").hidden = false;
  $("roomTitle").textContent = data.room.title;
  $("roomState").textContent = data.draw
    ? "Sorteio concluído"
    : "Entradas abertas";
  const rules =
    data.room.mode === "equipes"
      ? `Equipes com até ${data.room.max_size} pessoas`
      : "Ordem de apresentação";
  $("roomMeta").textContent =
    `${rules} · Organizado por ${data.room.owner_name} · ${dateText(data.room.created_at)}`;
  $("roomLink").value = routeUrl("room", id);
  $("participantCount").textContent = data.participants.length;
  const owner = currentUser?.user_id === data.room.owner_id;
  $("addParticipantForm").hidden = !owner || !!data.draw;
  $("participantList").replaceChildren();
  for (const person of data.participants) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = person.name;
    item.append(name);
    if (owner && !data.draw) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-participant";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remover ${person.name}`);
      remove.addEventListener("click", () =>
        busy(remove, async () => {
          await api(
            `/api/rooms/${encodeURIComponent(id)}/participants/${encodeURIComponent(person.id)}`,
            { method: "DELETE", body: "{}" },
          );
          await loadRoom(id);
        }),
      );
      item.append(remove);
    }
    $("participantList").append(item);
  }
  if (data.participants.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "Aguardando os primeiros participantes.";
    $("participantList").append(empty);
  }
  const joined = data.participants.some(
    (person) => person.user_id === currentUser?.user_id,
  );
  $("joinRoom").hidden = !!data.draw || !currentUser || joined;
  $("loginRoom").hidden = !!data.draw || !!currentUser;
  $("drawRoom").hidden = !!data.draw || !owner;
  $("drawRoom").disabled = data.participants.length < 2;
  $("openReceipt").hidden = !data.draw;
  $("roomHelp").textContent = data.draw
    ? "As entradas foram encerradas. Compartilhe a ata para consultar o resultado."
    : owner
      ? "Compartilhe o link. Com pelo menos duas pessoas, você pode realizar o sorteio. A lista é encerrada ao sortear."
      : joined
        ? "Sua participação está confirmada. Aguarde o organizador realizar o sorteio."
        : "Entre na lista usando seu perfil do Discord. O organizador decide quando realizar o sorteio.";
  if (data.draw) {
    $("openReceipt").href = routeUrl("ata", data.draw.code);
    await renderDraw(data.draw);
    clearInterval(roomPoll);
  }
}

async function renderDraw(draw) {
  currentDraw = draw;
  $("receiptSection").hidden = false;
  $("receiptTitle").textContent = draw.payload.title;
  const payload = draw.payload;
  $("receiptMeta").textContent =
    `${dateText(draw.created_at)} · Organizado por ${payload.organizer.username} · ${payload.participants.length} participantes`;
  $("receiptCode").textContent = draw.code;
  $("receiptHash").textContent = draw.hash;
  $("drawResults").replaceChildren();
  const groups =
    payload.mode === "ordem" ? [payload.result.flat()] : payload.result;
  groups.forEach((people, index) => {
    const card = document.createElement("section");
    card.className = "result-card";
    const heading = document.createElement("h3");
    heading.textContent =
      payload.mode === "ordem"
        ? "Ordem de apresentação"
        : `Equipe ${index + 1}`;
    const list = document.createElement("ol");
    people.forEach((person) => {
      const item = document.createElement("li");
      item.textContent = person.name;
      list.append(item);
    });
    card.append(heading, list);
    $("drawResults").append(card);
  });
  $("verification").textContent = "Verificando o conteúdo da ata…";
  if (!globalThis.crypto?.subtle) {
    $("verification").textContent =
      "A verificação local requer uma conexão HTTPS ou localhost.";
    return;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  $("verification").textContent =
    hash === draw.hash
      ? "✓ Conteúdo conferido neste navegador. O resumo corresponde à ata registrada."
      : "Falha na verificação. O conteúdo recebido diverge do resumo registrado.";
  if (hash !== draw.hash)
    showMessage(
      "A verificação da ata falhou. Confira o código com o organizador.",
      true,
    );
}

async function loadDraw(code) {
  const data = await api(`/api/draws/${encodeURIComponent(code)}`);
  await renderDraw(data.draw);
}

$("mode").addEventListener("change", () => {
  const teams = $("mode").value === "equipes";
  $("groupSizeField").hidden = !teams;
  $("groupSize").required = teams;
  $("groupSize").disabled = !teams;
});

$("createForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentUser) {
    location.href = loginUrl();
    return;
  }
  busy($("createButton"), async () => {
    const participants = $("names")
      .value.split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (participants.length > 500)
      throw new Error("Adicione no máximo 500 participantes.");
    const data = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        title: $("title").value.trim(),
        mode: $("mode").value,
        max_size:
          $("mode").value === "equipes" ? Number($("groupSize").value) : 1,
        participants,
      }),
    });
    location.href = routeUrl("room", data.room.id);
  });
});

$("lookupForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = $("lookupCode").value.trim();
  if (code) location.href = routeUrl("ata", code);
});

$("addParticipantForm").addEventListener("submit", (event) => {
  event.preventDefault();
  busy($("addParticipantButton"), async () => {
    await api(`/api/rooms/${encodeURIComponent(currentRoom.id)}/participants`, {
      method: "POST",
      body: JSON.stringify({ name: $("newParticipant").value.trim() }),
    });
    $("newParticipant").value = "";
    await loadRoom(currentRoom.id);
  });
});

$("joinRoom").addEventListener("click", () =>
  busy($("joinRoom"), async () => {
    await api(`/api/rooms/${encodeURIComponent(currentRoom.id)}/join`, {
      method: "POST",
      body: "{}",
    });
    await loadRoom(currentRoom.id);
    showMessage("Você está na lista de participantes.");
  }),
);

$("drawRoom").addEventListener("click", () => {
  if (
    !confirm(
      "Realizar o sorteio agora? A lista de participantes será encerrada e o resultado ficará registrado na ata pública.",
    )
  )
    return;
  busy($("drawRoom"), async () => {
    const data = await api(
      `/api/rooms/${encodeURIComponent(currentRoom.id)}/draw`,
      { method: "POST", body: "{}" },
    );
    await loadRoom(currentRoom.id);
    await renderDraw(data.draw);
    $("receiptSection").scrollIntoView({ behavior: "smooth", block: "start" });
    await loadMyRooms();
  });
});

async function copyLink(value) {
  try {
    await navigator.clipboard.writeText(value);
    showMessage("Link copiado. Agora é só compartilhar com a turma.");
  } catch {
    showMessage(`Copie este link para compartilhar: ${value}`);
  }
}
$("copyRoom").addEventListener("click", () => copyLink($("roomLink").value));
$("copyReceipt").addEventListener("click", () =>
  copyLink(routeUrl("ata", currentDraw.code)),
);
$("printReceipt").addEventListener("click", () => window.print());

async function start() {
  if (location.protocol === "file:") {
    showMessage(
      "A tela está aberta como arquivo. Para usar login, salas e atas, execute o projeto pelo Wrangler ou acesse o endereço publicado na Cloudflare.",
    );
    return;
  }
  const params = new URLSearchParams(location.search);
  try {
    const data = await api("/api/me");
    currentUser = data.user;
    renderProfile();
    if (params.has("auth_error"))
      showMessage(
        "O login com Discord não foi concluído. Tente entrar novamente.",
        true,
      );
    if (params.get("ata")) await loadDraw(params.get("ata"));
    if (params.get("room")) {
      await loadRoom(params.get("room"));
      if (!currentDraw)
        roomPoll = setInterval(() => {
          if (document.visibilityState === "visible")
            loadRoom(params.get("room")).catch((error) => {
              showMessage(error.message, true);
              clearInterval(roomPoll);
            });
        }, 8000);
    }
    await loadMyRooms();
  } catch (error) {
    showMessage(error.message, true);
  }
}
start();
