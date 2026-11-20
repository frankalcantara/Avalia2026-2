const $ = selector => document.querySelector(selector);
const signin = $('#signin');
const workspace = $('#workspace');
const datePicker = $('#date-picker');
let user = null;
let entries = [];
let modules = [];
let activeTimer = null;
let tickHandle = null;
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
datePicker.value = today;

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  }
  return response.status === 204 ? null : response.json();
}
function formatMinutes(value) {
  const mins = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
function elapsedSeconds(start) { return Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 1000)); }
function renderTimer() {
  if (!activeTimer) return;
  const seconds = elapsedSeconds(activeTimer.started_at);
  $('#timer-readout').textContent = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function setTimerState(entry) {
  activeTimer = entry || null;
  const button = $('#timer-button');
  const pill = $('#timer-state');
  if (activeTimer) {
    button.textContent = 'Encerrar cronômetro';
    pill.textContent = 'Em andamento'; pill.classList.add('running');
    $('#timer-project').value = activeTimer.project_name;
    $('#timer-module').value = activeTimer.module;
    $('#timer-description').value = activeTimer.description || '';
    renderTimer();
    clearInterval(tickHandle); tickHandle = setInterval(renderTimer, 1000);
  } else {
    button.textContent = 'Iniciar cronômetro';
    pill.textContent = 'Parado'; pill.classList.remove('running');
    $('#timer-readout').textContent = '00:00:00';
    clearInterval(tickHandle); tickHandle = null;
  }
}
function renderEstimates() {
  const tbody = $('#estimate-rows'); tbody.replaceChildren();
  let totalEstimate = 0, totalActual = 0;
  for (const item of modules) {
    totalEstimate += item.estimate_minutes; totalActual += item.actual_minutes;
    const row = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = item.name;
    const estimateCell = document.createElement('td');
    const input = document.createElement('input'); input.className = 'estimate-input'; input.type = 'number'; input.min = '0'; input.max = '1666'; input.step = '0.5'; input.value = (item.estimate_minutes / 60).toString(); input.setAttribute('aria-label', `Estimativa em horas para ${item.name}`);
    input.addEventListener('change', async () => {
      const hours = Number(input.value);
      if (!Number.isFinite(hours) || hours < 0 || hours > 1666) { $('#estimate-message').textContent = 'Use uma estimativa válida em horas.'; return; }
      try {
        const result = await api('/api/time/estimates', { method: 'PUT', body: JSON.stringify({ module: item.name, estimate_minutes: Math.round(hours * 60) }) });
        item.estimate_minutes = result.estimate_minutes; $('#estimate-message').textContent = 'Estimativa salva.'; renderEstimates();
      } catch (error) { $('#estimate-message').textContent = error.message; }
    });
    estimateCell.append(input);
    const actual = document.createElement('td'); actual.textContent = formatMinutes(item.actual_minutes);
    const difference = item.actual_minutes - item.estimate_minutes;
    const variance = document.createElement('td'); variance.textContent = `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${formatMinutes(Math.abs(difference))}`; variance.className = difference > 0 ? 'variance-positive' : 'variance-negative';
    const progressCell = document.createElement('td'); const track = document.createElement('div'); track.className = 'progress-track'; const fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = `${item.estimate_minutes ? Math.min(100, item.actual_minutes / item.estimate_minutes * 100) : item.actual_minutes ? 100 : 0}%`; track.append(fill); progressCell.append(track);
    row.append(name, estimateCell, actual, variance, progressCell); tbody.append(row);
  }
  const delta = totalActual - totalEstimate;
  $('#variance-total').textContent = `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatMinutes(Math.abs(delta))}`;
  $('#variance-total').className = delta > 0 ? 'variance-positive' : 'variance-negative';
}
function renderEntries() {
  const container = $('#entries'); container.replaceChildren();
  $('#entry-count').textContent = `${entries.length} ${entries.length === 1 ? 'registro' : 'registros'}`;
  if (!entries.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Nenhum apontamento neste dia.'; container.append(empty); return; }
  for (const item of entries) {
    const row = document.createElement('article'); row.className = 'entry';
    const project = document.createElement('div'); project.className = 'entry-project'; project.textContent = item.project_name;
    if (item.description) { const note = document.createElement('span'); note.className = 'entry-description'; note.textContent = item.description; project.append(note); }
    const module = document.createElement('div'); module.className = 'entry-module'; module.textContent = item.module;
    const start = new Date(item.started_at); const end = item.ended_at ? new Date(item.ended_at) : null;
    const times = document.createElement('div'); times.className = 'entry-time'; times.textContent = `${start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}–${end ? end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : 'agora'} · ${formatMinutes(item.duration_minutes || elapsedSeconds(item.started_at) / 60)}`;
    const owner = document.createElement('div'); owner.className = 'entry-owner'; owner.textContent = item.mine ? 'Você' : (item.display_name || item.username);
    row.append(project, module, times, owner); container.append(row);
  }
}
async function refresh() {
  try {
    const data = await api(`/api/time/entries?date=${encodeURIComponent(datePicker.value)}`);
    entries = data.entries || []; modules = data.modules || [];
    $('#own-total').textContent = formatMinutes(data.own_minutes);
    $('#team-total').textContent = formatMinutes(data.team_minutes);
    renderEstimates(); renderEntries();
    setTimerState(entries.find(item => item.mine && !item.ended_at));
  } catch (error) { $('#manual-message').textContent = error.message; }
}
async function initialize() {
  try {
    user = await api('/api/me');
    $('#username').textContent = user.display_name || user.username;
    if (user.avatar_url) { $('#avatar').src = user.avatar_url; $('#avatar').hidden = false; }
    $('#profile').hidden = false; signin.hidden = true; workspace.hidden = false;
    await refresh();
  } catch {
    user = null; $('#profile').hidden = true; signin.hidden = false; workspace.hidden = true;
    try {
      const status = await api('/api/auth/status');
      if (!status.discord_configured) { $('#signin-message').textContent = 'O acesso Discord aguarda configuração.'; $('#discord-login').removeAttribute('href'); $('#discord-login').textContent = 'Login em configuração'; }
    } catch { /* mantém o CTA visível */ }
  }
}
$('#timer-button').addEventListener('click', async () => {
  const button = $('#timer-button'); button.disabled = true; $('#timer-message').textContent = '';
  try {
    if (activeTimer) await api('/api/time/stop', { method: 'POST', body: '{}' });
    else await api('/api/time/start', { method: 'POST', body: JSON.stringify({ project_name: $('#timer-project').value, module: $('#timer-module').value, description: $('#timer-description').value }) });
    await refresh();
  } catch (error) { $('#timer-message').textContent = error.message; }
  finally { button.disabled = false; }
});
function localInputDate(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function setManualDefaults() { const end = new Date(); const start = new Date(end.getTime() - 60 * 60000); $('#manual-start').value = localInputDate(start); $('#manual-end').value = localInputDate(end); }
setManualDefaults();
$('#manual-form').addEventListener('submit', async event => {
  event.preventDefault(); $('#manual-message').textContent = '';
  try {
    await api('/api/time/manual', { method: 'POST', body: JSON.stringify({ project_name: $('#manual-project').value, module: $('#manual-module').value, description: $('#manual-description').value, started_at: $('#manual-start').value, ended_at: $('#manual-end').value }) });
    $('#manual-message').textContent = 'Apontamento salvo.'; $('#manual-description').value = ''; await refresh();
  } catch (error) { $('#manual-message').textContent = error.message; }
});
datePicker.addEventListener('change', () => refresh());
$('#logout').addEventListener('click', async () => { try { await api('/api/auth/logout', { method: 'POST' }); } finally { location.reload(); } });
initialize();
