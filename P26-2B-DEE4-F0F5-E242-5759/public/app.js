const loginUrl = "/api/auth/discord";
const $ = (id) => document.getElementById(id);
const searchForm = $("search");
const createForm = $("create");
const reserving = new Set();
const campusTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
});
let user = null;
let filters = new URLSearchParams();
let searchVersion = 0;
let rides = [];
let reservedRides = [];

const errors = {
  autenticacao_necessaria: "Sua sessão terminou. Entre novamente com Discord.",
  banco_indisponivel: "O serviço de caronas está indisponível. Tente novamente mais tarde.",
  carona_invalida: "Confira a origem, o destino, o horário futuro e a quantidade de vagas.",
  carona_indisponivel: "Esta carona não tem mais vagas ou já saiu.",
  carona_nao_encontrada: "Esta carona não está disponível.",
  filtro_invalido: "Use até 120 caracteres em cada filtro.",
  origem_invalida: "Recarregue a página antes de tentar novamente.",
  reserva_do_motorista: "Você já é o motorista desta carona.",
};

function message(element, text, kind = "") {
  element.textContent = text;
  element.dataset.kind = kind;
}

async function request(path, options) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    setUser(null);
    message($("session-status"), errors.autenticacao_necessaria, "error");
  }
  if (!response.ok || !data?.ok) {
    const detail = Object.hasOwn(errors, data?.error) ? errors[data.error] : null;
    const error = new Error(detail || "Não foi possível concluir a operação. Tente novamente.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function setUser(profile) {
  user = profile;
  $("login").hidden = Boolean(user);
  $("profile").hidden = !user;
  $("guest-hint").hidden = Boolean(user);
  $("driver-login").hidden = Boolean(user);
  $("driver-panel").hidden = !user;
  createForm.hidden = !user;
  $("offer").href = user ? "#oferecer" : loginUrl;

  if (user) {
    $("username").textContent = user.username;
    $("discord-id").textContent = "ID Discord " + user.userId;
    const fallback = "https://cdn.discordapp.com/embed/avatars/0.png";
    $("avatar").onerror = () => {
      $("avatar").onerror = null;
      $("avatar").src = fallback;
    };
    $("avatar").src = user.avatar?.startsWith("https://cdn.discordapp.com/") ? user.avatar : fallback;
  } else {
    reservedRides = [];
    $("driver-rides").replaceChildren();
  }
  renderResults();
}

function rideCard(ride) {
  const card = element("li", "", "ride");
  const time = element("time", campusTime.format(new Date(ride.departure_at)));
  time.dateTime = ride.departure_at;
  const date = element("p", "Saída ");
  date.append(time);
  card.append(
    element("h3", ride.origin + " → " + ride.destination),
    date,
    element("p", `${ride.available_seats} de ${ride.total_seats} vagas livres`),
  );
  return card;
}

function renderResults() {
  const reservations = user ? reservedRides : [];
  const reservedIds = new Set(reservations.map((ride) => ride.id));
  const visibleRides = [...reservations, ...rides.filter((ride) => !reservedIds.has(ride.id))];
  const cards = visibleRides.map((ride) => {
    const card = rideCard(ride);
    if (reservedIds.has(ride.id)) {
      card.append(element("p", "Sua vaga está confirmada."));
    } else if (!user) {
      const link = element("a", "Entrar para reservar", "button secondary");
      link.href = loginUrl;
      card.append(link);
    } else if (ride.driver_id === user.userId) {
      card.append(element("p", "Você é o motorista"));
    } else {
      const pending = reserving.has(ride.id);
      const button = element("button", pending ? "Reservando…" : "Reservar vaga", "button");
      button.type = "button";
      button.disabled = pending;
      button.addEventListener("click", () => reserve(ride.id, button));
      card.append(button);
    }
    return card;
  });
  $("results").replaceChildren(...cards);
  return visibleRides.length;
}

async function loadResults(feedback = "", kind = "success") {
  const version = ++searchVersion;
  const status = $("search-status");
  message(status, feedback ? feedback + " Atualizando caronas…" : "Carregando caronas…", kind);
  try {
    const query = filters.toString();
    const data = await request("/api/rides" + (query ? "?" + query : ""));
    if (version !== searchVersion) return;
    reservedRides = user ? data.reservedRides : [];
    rides = data.rides;
    const count = renderResults();
    message(status, feedback || (count
      ? `${count} ${count === 1 ? "carona encontrada" : "caronas encontradas"}.`
      : "Nenhuma carona disponível para estes filtros hoje."), feedback ? kind : "");
  } catch (error) {
    if (version !== searchVersion) return;
    rides = [];
    reservedRides = [];
    renderResults();
    message(status, [feedback, error.message || "Falha ao consultar caronas."].filter(Boolean).join(" "), "error");
  }
}

async function reserve(id, button) {
  if (reserving.has(id)) return;
  reserving.add(id);
  button.disabled = true;
  button.textContent = "Reservando…";
  message($("search-status"), "Solicitando vaga…");
  try {
    await request(`/api/rides/${id}`, { method: "POST" });
    await loadResults("Sua vaga está confirmada.");
  } catch (error) {
    if (error.status === 409 || error.status === 404) {
      await loadResults(error.message, "error");
    } else {
      message($("search-status"), error.message || "Falha ao solicitar vaga.", "error");
    }
  } finally {
    reserving.delete(id);
    renderResults();
  }
}

function passengerDetails(rideId) {
  const details = element("details", "");
  const summary = element("summary", "Passageiros confirmados");
  const status = element("p", "", "message");
  status.setAttribute("role", "status");
  const list = element("ul", "", "passengers");
  details.append(summary, status, list);
  let loading = false;

  details.addEventListener("toggle", async () => {
    if (!details.open || loading) return;
    loading = true;
    message(status, "Carregando passageiros…");
    list.replaceChildren();
    try {
      const { passengers } = await request(`/api/rides/${rideId}`);
      list.replaceChildren(...passengers.map(({ username, user_id }) =>
        element("li", `${username} · ID Discord ${user_id}`)));
      message(status, passengers.length ? "" : "Nenhum passageiro confirmado.");
    } catch (error) {
      message(status, error.message || "Falha ao consultar passageiros.", "error");
    } finally {
      loading = false;
    }
  });
  return details;
}

let driverVersion = 0;
async function loadDriverRides() {
  if (!user) return;
  const version = ++driverVersion;
  const status = $("driver-status");
  const list = $("driver-rides");
  message(status, "Carregando suas caronas…");
  try {
    const data = await request("/api/rides/mine");
    if (version !== driverVersion || !user) return;
    list.replaceChildren(...data.rides.map((ride) => {
      const card = rideCard(ride);
      card.append(passengerDetails(ride.id));
      return card;
    }));
    message(status, data.rides.length ? "" : "Você ainda não publicou caronas.");
  } catch (error) {
    if (version !== driverVersion || !user) return;
    message(status, error.message || "Falha ao consultar suas caronas.", "error");
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  filters = new URLSearchParams();
  for (const [name, value] of new FormData(searchForm)) {
    if (value.trim()) filters.set(name, value.trim());
  }
  loadResults();
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = createForm.querySelector("button");
  if (!user || button.disabled) return;
  const values = new FormData(createForm);
  const origin = values.get("origin").trim();
  const destination = values.get("destination").trim();
  // Brasília usa UTC−03:00, independentemente do fuso do dispositivo.
  const departure = new Date(`${values.get("date")}T${values.get("time")}:00-03:00`);
  const status = $("create-status");
  if (!origin || !destination || !Number.isFinite(+departure) || departure <= new Date()) {
    message(status, errors.carona_invalida, "error");
    return;
  }
  button.disabled = true;
  message(status, "Publicando carona…");
  try {
    await request("/api/rides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin, destination, departure_at: departure.toISOString(),
        total_seats: Number(values.get("seats")),
      }),
    });
    createForm.reset();
    message(status, "Carona publicada.", "success");
    await Promise.all([loadDriverRides(), loadResults()]);
  } catch (error) {
    message(status, error.message || "Falha ao publicar carona.", "error");
  } finally {
    button.disabled = false;
  }
});

$("refresh-driver").addEventListener("click", loadDriverRides);

async function loadSession() {
  const status = $("session-status");
  const url = new URL(window.location.href);
  const authError = url.searchParams.has("auth_error");
  const loggedIn = url.searchParams.get("login") === "success";
  if (authError || loggedIn) {
    url.searchParams.delete("auth_error");
    url.searchParams.delete("login");
    history.replaceState(null, "", url);
  }
  message(status, "Verificando sessão Discord…");
  try {
    const data = await request("/api/status");
    setUser(data.sessionUser);
    if (authError) {
      message(status, "O login pelo Discord não foi concluído. Tente novamente.", "error");
    } else if (!data.d1Connected || !data.discordOAuthConfigured) {
      message(status, "O serviço de autenticação está indisponível.", "error");
    } else if (loggedIn) {
      message(status, user ? "Você entrou com Discord." : "Sua sessão não foi encontrada. Entre novamente.",
        user ? "success" : "error");
    } else {
      message(status, "");
    }
  } catch {
    message(status, "Não foi possível verificar sua sessão Discord.", "error");
  }
}

loadSession().then(() => Promise.all([loadResults(), loadDriverRides()]));
