let currentUser = null;

async function verificarSessao() {
  const res = await fetch("/api/auth/me");
  const data = await res.json();
  const authArea = document.getElementById("auth-area");
  const createSection = document.getElementById("create-section");

  if (data.authenticated) {
    currentUser = data.user;
    createSection.classList.remove("hidden");

    const avatarHtml = currentUser.avatar
      ? `<img src="${currentUser.avatar}" alt="Avatar" class="avatar" />`
      : "";

    authArea.innerHTML = `
      <div class="user-profile">
        ${avatarHtml}
        <span><strong>${currentUser.nome}</strong> <small class="meta">(#${currentUser.discord_id})</small></span>
        <button id="btn-logout" type="button" class="btn btn-outline">Sair</button>
      </div>
    `;
    document.getElementById("btn-logout").addEventListener("click", logout);
  } else {
    currentUser = null;
    createSection.classList.add("hidden");
    authArea.innerHTML = `
      <a href="/api/auth/discord" class="btn btn-discord">Entrar com Discord</a>
    `;
  }
}

async function logout() {
  await fetch("/api/auth/me", { method: "POST" });
  window.location.reload();
}

async function carregarEventos() {
  const grid = document.getElementById("events-grid");
  const res = await fetch("/api/eventos");
  const eventos = await res.json();

  if (!eventos.length) {
    grid.innerHTML = `<p class="meta">Nenhum evento cadastrado ainda. Faça login e crie o primeiro!</p>`;
    return;
  }

  grid.innerHTML = eventos.map((ev) => {
    const lotado = ev.confirmados_count >= ev.capacidade_maxima;
    const esperaBadge = ev.espera_count > 0
      ? `<span class="pill">${ev.espera_count} na fila</span>`
      : "";

    let actionHtml = "";
    if (!currentUser) {
      actionHtml = `<span class="meta">Faça login com Discord para reservar vaga</span>`;
    } else if (ev.meu_status === "confirmado") {
      actionHtml = `
        <div class="status-row">
          <span style="color: #34d399;">✔ Confirmado</span>
          <button type="button" class="btn btn-danger" data-id="${ev.id}" data-acao="cancelar">Cancelar Vaga</button>
        </div>
      `;
    } else if (ev.meu_status === "espera") {
      actionHtml = `
        <div class="status-row">
          <span style="color: #fbbf24;">⏳ Na Fila de Espera</span>
          <button type="button" class="btn btn-outline" data-id="${ev.id}" data-acao="cancelar">Sair da Fila</button>
        </div>
      `;
    } else {
      const label = lotado ? "Entrar na Fila de Espera" : "Confirmar Presença";
      const cls = lotado ? "btn-warning" : "btn-success";
      actionHtml = `
        <button type="button" class="btn ${cls}" data-id="${ev.id}" data-acao="inscrever">${label}</button>
      `;
    }

    return `
      <article class="event-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <h3>${ev.titulo}</h3>
            ${esperaBadge}
          </div>
          <p class="meta">Local: ${ev.local} &bull; Data: ${ev.data} às ${ev.horario}</p>
          <p class="meta">Criado por: ${ev.criador_nome}</p>
        </div>
        <div class="event-footer">
          <div class="occupancy">
            <span class="meta">Vagas ocupadas:</span>
            <span>${ev.confirmados_count} / ${ev.capacidade_maxima}</span>
          </div>
          ${actionHtml}
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      gerirRsvp(Number(btn.dataset.id), btn.dataset.acao);
    });
  });
}

document.getElementById("create-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());

  const res = await fetch("/api/eventos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    e.target.reset();
    carregarEventos();
  } else {
    const err = await res.json();
    alert(err.error || "Erro ao criar evento.");
  }
});

async function gerirRsvp(eventoId, acao) {
  const res = await fetch("/api/eventos/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evento_id: eventoId, acao })
  });

  if (res.ok) {
    carregarEventos();
  } else {
    const err = await res.json();
    alert(err.error || "Erro ao processar inscrição.");
  }
}

document.getElementById("btn-refresh").addEventListener("click", carregarEventos);

(async () => {
  await verificarSessao();
  await carregarEventos();
})();