const schedule = document.querySelector('#schedule');
const datePicker = document.querySelector('#date-picker');
const notice = document.querySelector('#notice');
const dialog = document.querySelector('#booking-dialog');
const bookingForm = document.querySelector('#booking-form');
const signin = document.querySelector('#signin');
let currentUser = null;
let dayData = null;
const groups = { meeting_room: 'Salas de reunião', study_cabin: 'Cabines de estudo', lab_bench: 'Bancadas de laboratório' };
const kindNames = { meeting_room: 'Reunião', study_cabin: 'Estudo', lab_bench: 'Laboratório' };
const pad = value => String(value).padStart(2, '0');
const localDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = localDate(new Date());
datePicker.value = today; datePicker.min = today;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  }
  return response.status === 204 ? null : response.json();
}
function dateLabel(value, long = false) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { weekday: long ? 'long' : 'short', day: 'numeric', month: 'long' }).format(new Date(year, month - 1, day));
}
function minute(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
function timeAt(index) { const total = 480 + index * 30; return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`; }
async function loadUser() {
  try {
    currentUser = await api('/api/me');
    document.querySelector('#username').textContent = currentUser.display_name || currentUser.username;
    const avatar = document.querySelector('#avatar');
    if (currentUser.avatar_url) { avatar.src = currentUser.avatar_url; avatar.hidden = false; } else avatar.hidden = true;
    document.querySelector('#profile').hidden = false; signin.hidden = true;
  } catch { currentUser = null; document.querySelector('#profile').hidden = true; signin.hidden = false; }
  if (!currentUser) {
    try {
      const status = await api('/api/auth/status');
      if (!status.discord_configured) {
        document.querySelector('#signin-message').textContent = 'O acesso Discord está aguardando configuração pelo responsável pelo projeto.';
        const login = document.querySelector('#discord-login');
        login.removeAttribute('href'); login.setAttribute('aria-disabled', 'true');
        login.innerHTML = '<span>◉</span> Login em configuração';
        login.classList.add('disabled');
      }
    } catch { /* Mantém a tela acessível se a verificação de status falhar. */ }
  }
}
function render(data) {
  dayData = data;
  const minutes = data.user_minutes_reserved || 0;
  document.querySelector('#quota-value').innerHTML = `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${pad(minutes % 60)}m` : ''} <small>/ 2h</small>`;
  document.querySelector('#quota-fill').style.width = `${Math.min(100, minutes / 120 * 100)}%`;
  document.querySelector('#quota-note').textContent = currentUser ? `${Math.max(0, 120 - minutes)} min restantes hoje` : 'Entre com Discord para reservar';
  const resources = data.resources || [];
  if (!resources.length) { schedule.innerHTML = '<div class="empty-state">Nenhum espaço cadastrado.</div>'; return; }
  const reservationsByResource = new Map();
  for (const reservation of data.reservations || []) {
    if (!reservationsByResource.has(reservation.resource_id)) reservationsByResource.set(reservation.resource_id, []);
    reservationsByResource.get(reservation.resource_id).push(reservation);
  }
  schedule.replaceChildren();
  for (const [kind, title] of Object.entries(groups)) {
    const items = resources.filter(resource => resource.kind === kind);
    if (!items.length) continue;
    const group = document.createElement('section'); group.className = 'resource-group';
    const heading = document.createElement('h3'); heading.className = 'group-heading'; heading.textContent = title; group.append(heading);
    for (const resource of items) {
      const row = document.createElement('div'); row.className = 'resource-row';
      const name = document.createElement('div'); name.className = 'resource-name'; name.append(document.createTextNode(resource.name));
      const sub = document.createElement('small'); sub.textContent = kindNames[kind]; name.append(sub);
      const wrap = document.createElement('div'); wrap.className = 'time-grid-wrap';
      const labels = document.createElement('div'); labels.className = 'time-labels';
      for (let i = 0; i < 12; i++) { const label = document.createElement('span'); label.textContent = `${pad(8 + i)}:00`; labels.append(label); }
      const grid = document.createElement('div'); grid.className = 'slot-grid';
      const reservations = reservationsByResource.get(resource.id) || [];
      const occupied = new Set();
      for (const reservation of reservations) {
        const first = (minute(reservation.start_time) - 480) / 30;
        const count = (minute(reservation.end_time) - minute(reservation.start_time)) / 30;
        for (let i = first; i < first + count; i++) occupied.add(i);
      }
      for (let i = 0; i < 24; i++) {
        if (occupied.has(i)) continue;
        const slot = document.createElement('button'); slot.type = 'button'; slot.className = 'slot';
        slot.style.gridColumn = String(i + 1);
        const start = timeAt(i), end = timeAt(i + 1);
        const isPast = datePicker.value < today || (datePicker.value === today && start <= new Intl.DateTimeFormat('en-GB', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()));
        slot.disabled = isPast || !currentUser;
        slot.classList.toggle('past', isPast);
        slot.setAttribute('aria-label', `${resource.name}, ${start} a ${end}, ${isPast ? 'indisponível' : currentUser ? 'livre, reservar' : 'livre, entre para reservar'}`);
        slot.title = `${start} · ${currentUser ? 'Reservar' : 'Entre com Discord para reservar'}`;
        slot.addEventListener('click', () => openBooking(resource, start)); grid.append(slot);
      }
      for (const reservation of reservations) {
        const block = document.createElement('div'); block.className = `slot reserved${reservation.mine ? ' mine' : ''}`;
        const startIndex = (minute(reservation.start_time) - 480) / 30;
        const count = (minute(reservation.end_time) - minute(reservation.start_time)) / 30;
        block.style.left = `calc(${startIndex / 24 * 100}% + ${startIndex / 12}px)`;
        block.style.width = `calc(${count / 24 * 100}% + ${count / 12 - 2}px)`;
        block.setAttribute('aria-label', `${reservation.mine ? 'Sua reserva' : 'Reservado'}, ${reservation.start_time} a ${reservation.end_time}`);
        const label = document.createElement('span'); label.textContent = `${reservation.mine ? 'Sua · ' : 'Ocupado · '}${reservation.start_time}–${reservation.end_time}`; block.append(label);
        if (reservation.mine && currentUser && (datePicker.value > today || reservation.start_time > new Intl.DateTimeFormat('en-GB', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))) {
          const cancel = document.createElement('button'); cancel.className = 'cancel'; cancel.textContent = '×'; cancel.setAttribute('aria-label', 'Cancelar reserva'); cancel.addEventListener('click', event => { event.stopPropagation(); cancelReservation(reservation.id); }); block.append(cancel);
        }
        grid.append(block);
      }
      wrap.append(labels, grid); row.append(name, wrap); group.append(row);
    }
    schedule.append(group);
  }
}
function openBooking(resource, start) {
  document.querySelector('#booking-title').textContent = resource.name;
  document.querySelector('#booking-subtitle').textContent = `${dateLabel(datePicker.value, true)} · início às ${start}`;
  document.querySelector('#booking-resource').value = resource.id;
  document.querySelector('#booking-date').value = datePicker.value;
  document.querySelector('#booking-start').value = start;
  document.querySelector('#dialog-notice').textContent = '';
  const select = document.querySelector('#duration'); select.value = '30';
  for (const option of select.options) {
    const duration = Number(option.value);
    const overlaps = (dayData.reservations || []).some(item => item.resource_id === resource.id
      && minute(start) < minute(item.end_time) && minute(start) + duration > minute(item.start_time));
    option.disabled = duration > 120 - (dayData.user_minutes_reserved || 0)
      || minute(start) + duration > 1200 || overlaps;
  }
  dialog.showModal();
}
async function refresh() {
  notice.textContent = ''; schedule.innerHTML = '<div class="loading">Carregando agenda…</div>';
  try { render(await api(`/api/availability?date=${encodeURIComponent(datePicker.value)}`)); }
  catch (error) { schedule.innerHTML = `<div class="empty-state">${currentUser ? error.message : 'Entre com Discord para consultar a agenda e reservar um horário.'}</div>`; }
}
async function cancelReservation(id) {
  try { await api(`/api/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' }); notice.textContent = 'Reserva cancelada.'; await refresh(); }
  catch (error) { notice.textContent = error.message; }
}
bookingForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = bookingForm.querySelector('.reserve-button'); button.disabled = true; button.textContent = 'Salvando…';
  try {
    await api('/api/reservations', { method: 'POST', body: JSON.stringify({ resource_id: document.querySelector('#booking-resource').value, date: document.querySelector('#booking-date').value, start_time: document.querySelector('#booking-start').value, duration_minutes: Number(document.querySelector('#duration').value) }) });
    dialog.close(); notice.textContent = 'Reserva confirmada.'; await refresh();
  } catch (error) { document.querySelector('#dialog-notice').textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Confirmar reserva'; }
});
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
document.querySelector('#logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } finally { location.reload(); } });
datePicker.addEventListener('change', () => { if (datePicker.value < today) datePicker.value = today; refresh(); });
for (const [selector, delta] of [['#previous-day', -1], ['#next-day', 1]]) document.querySelector(selector).addEventListener('click', () => { const date = new Date(`${datePicker.value}T12:00:00`); date.setDate(date.getDate() + delta); if (localDate(date) >= today) { datePicker.value = localDate(date); refresh(); } });
document.querySelector('#today').addEventListener('click', () => { datePicker.value = today; refresh(); });
if (new URLSearchParams(location.search).get('login') === 'cancelled') notice.textContent = 'Login cancelado.';
loadUser().then(refresh);
