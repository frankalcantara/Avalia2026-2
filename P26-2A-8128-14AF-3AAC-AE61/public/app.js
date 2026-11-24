const $ = (selector, root = document) => root.querySelector(selector);
const state = { user: null, books: [], dashboard: { books: [], incoming: [], outgoing: [] }, view: 'catalog', direction: 'incoming', catalogVersion: 0 };
const labels = {
  category: { tecnico: 'Técnico', literario: 'Literário' },
  condition: { novo: 'Como novo', bom: 'Bom estado', marcas: 'Com marcas de uso' },
  mode: { emprestimo: 'Empréstimo', troca: 'Troca', ambos: 'Empréstimo ou troca' },
  status: { disponivel: 'Disponível', reservado: 'Reservado', emprestado: 'Emprestado', pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado', devolvido: 'Devolvido', concluido: 'Troca concluída' }
};
const modal = $('#modal');
let lastFocus;

function element(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, action, className = 'button') {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function loginLink() {
  const link = element('a', 'button button-primary', 'Entrar com Discord');
  link.href = '/api/auth/discord';
  return link;
}
function notice(text, error = false) {
  const node = $('#notice');
  node.textContent = text;
  node.className = error ? 'notice notice-error' : 'notice';
  node.hidden = !text;
}
function statusBadge(status) {
  const known = Object.hasOwn(labels.status, status) ? status : '';
  return element('span', `status status-${known}`, labels.status[status] || status);
}
function dateText(date) {
  if (!date) return 'Não definida';
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-BR');
}
function isoDay(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const day = new Date(`${date.year}-${date.month}-${date.day}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error('Não foi possível consultar o serviço. Tente atualizar a página.'); }
  if (!response.ok) {
    if (response.status === 401) { state.user = null; state.dashboard = { books: [], incoming: [], outgoing: [] }; renderProfile(); }
    throw new Error(data.error || 'Não foi possível concluir a ação. Tente novamente.');
  }
  return data;
}
function emptyState(title, copy, action) {
  const container = element('div', 'empty-state');
  const symbol = element('span', 'empty-symbol', '⌑');
  symbol.setAttribute('aria-hidden', 'true');
  container.append(symbol, element('h3', '', title), element('p', '', copy));
  if (action) container.append(action);
  return container;
}
function requireLogin() {
  if (state.user) return true;
  openDialog('Sua estante começa com você');
  $('#modal-body').append(element('p', 'dialog-copy', 'Entre com sua conta do Discord para compartilhar livros, enviar pedidos e combinar a entrega com os colegas.'), loginLink());
  return false;
}
function openDialog(title) {
  lastFocus = document.activeElement;
  $('#modal-title').textContent = title;
  $('#modal-body').replaceChildren();
  if (!modal.open) modal.showModal();
}
function closeDialog() { modal.close(); }
$('#close-modal').addEventListener('click', closeDialog);
modal.addEventListener('close', () => { if (lastFocus?.isConnected) lastFocus.focus(); });
modal.addEventListener('click', event => {
  if (event.target !== modal) return;
  const box = modal.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
});

function renderProfile() {
  const container = $('#profile');
  container.replaceChildren();
  if (!state.user) { container.append(loginLink()); return; }
  const { avatar, username, display_name, user_id } = state.user;
  if (avatar) {
    try {
      const url = new URL(avatar);
      if (url.protocol === 'https:' && url.hostname === 'cdn.discordapp.com') {
        const img = element('img', 'profile-avatar'); img.src = url.href; img.alt = ''; img.width = 38; img.height = 38;
        container.append(img);
      }
    } catch { /* A identidade textual continua disponível sem avatar. */ }
  }
  const copy = element('div', 'profile-copy');
  copy.append(element('strong', '', display_name || username), element('small', '', `@${username}`), element('small', 'profile-id', `ID ${user_id}`));
  const logout = button('Sair', async () => {
    logout.disabled = true;
    try {
      await api('/api/logout', { method: 'POST', body: '{}' });
      state.user = null; state.dashboard = { books: [], incoming: [], outgoing: [] };
      renderProfile(); renderDashboard(); await loadCatalog(); setView('catalog'); notice('Você saiu da sua conta.');
    } catch (error) { notice(error.message, true); logout.disabled = false; }
  }, 'button button-text');
  container.append(copy, logout);
}

function bookCard(book, own = false) {
  const card = element('article', 'book-card');
  const colorIndex = Array.from(String(book.id)).reduce((n, c) => n + c.charCodeAt(0), 0) % 5;
  const cover = element('div', `book-jacket jacket-${colorIndex}`);
  cover.setAttribute('aria-hidden', 'true');
  cover.append(element('span', 'book-category', labels.category[book.category]), element('div', 'jacket-title', book.title), element('span', 'jacket-author', book.author));
  const body = element('div', 'book-body');
  const top = element('div', 'book-topline');
  top.append(statusBadge(book.status), element('span', 'book-condition', labels.condition[book.condition]));
  body.append(top, element('h3', '', book.title), element('p', 'book-author', book.author), element('p', 'book-description', book.description || 'Um exemplar pronto para ganhar novos leitores.'), element('p', 'book-mode', labels.mode[book.mode]));
  const owner = element('p', 'book-owner');
  owner.append(element('strong', '', own ? 'Na sua estante' : book.owner_name || book.owner_username), document.createTextNode(own ? '' : ` · @${book.owner_username}`));
  body.append(owner);
  const actions = element('div', 'book-actions');
  actions.append(button('Ver detalhes', () => showBook(book), 'button button-small'));
  if (own || (state.user && book.owner_id === state.user.user_id)) {
    if (book.status === 'disponivel') actions.append(button('Editar', () => showBookForm(book), 'button button-small'));
  } else if (book.status === 'disponivel') {
    actions.append(button('Pedir livro', () => showRequestForm(book), 'button button-primary button-small'));
  }
  body.append(actions); card.append(cover, body);
  return card;
}
function showBook(book) {
  openDialog(book.title);
  const details = element('dl', 'detail-list');
  const fields = [['Autor', book.author], ['Categoria', labels.category[book.category]], ['Conservação', labels.condition[book.condition]], ['Modalidade', labels.mode[book.mode]], ['Situação', labels.status[book.status]], ['Proprietário', book.owner_name || book.owner_username], ['Discord', `@${book.owner_username}`]];
  for (const [title, value] of fields) details.append(element('dt', '', title), element('dd', '', value));
  const body = $('#modal-body'); body.append(details, element('p', 'detail-description', book.description || 'O proprietário não adicionou observações sobre este exemplar.'));
  const actions = element('div', 'form-actions');
  const own = state.user?.user_id === book.owner_id;
  if (own && book.status === 'disponivel') {
    actions.append(button('Remover livro', () => confirmAction('Remover este livro?', 'O exemplar sairá do catálogo. Os pedidos anteriores continuarão no histórico.', 'Remover livro', () => api(`/api/books/${encodeURIComponent(book.id)}`, { method: 'DELETE', body: '{}' }), 'Livro removido do catálogo.', true), 'button button-danger'), button('Editar livro', () => showBookForm(book), 'button button-primary'));
  } else if (!own && book.status === 'disponivel') actions.append(button('Pedir este livro', () => showRequestForm(book), 'button button-primary'));
  else body.append(element('p', 'dialog-copy', 'Este exemplar está em circulação. Aguarde ele ficar disponível novamente.'));
  body.append(actions);
}
async function loadCatalog() {
  const version = ++state.catalogVersion;
  const query = new URLSearchParams(new FormData($('#filters')));
  const grid = $('#catalog-grid'); grid.setAttribute('aria-busy', 'true');
  try {
    const data = await api(`/api/books?${query}`);
    if (version !== state.catalogVersion) return;
    state.books = data.books || []; renderCatalog();
  } catch (error) {
    if (version !== state.catalogVersion) return;
    $('#catalog-count').textContent = 'Catálogo temporariamente indisponível';
    grid.replaceChildren(emptyState('Não foi possível carregar os livros', error.message, button('Tentar novamente', loadCatalog, 'button button-primary')));
  } finally { if (version === state.catalogVersion) grid.removeAttribute('aria-busy'); }
}
function renderCatalog() {
  const total = state.books.length;
  $('#catalog-count').textContent = `${total} ${total === 1 ? 'livro encontrado' : 'livros encontrados'} na comunidade`;
  const grid = $('#catalog-grid'); grid.replaceChildren();
  if (!total) {
    const filtered = [...new FormData($('#filters')).values()].some(Boolean);
    grid.append(filtered
      ? emptyState('Ainda não encontramos esse livro', 'Experimente outro título, autor ou combinação de filtros.', button('Limpar filtros', () => { $('#filters').reset(); loadCatalog(); }))
      : emptyState('Toda boa estante começa com um livro', 'Compartilhe um exemplar do seu acervo e ajude a formar a biblioteca da nossa comunidade.', button('Compartilhar um livro', () => showBookForm(), 'button button-primary')));
  } else grid.append(...state.books.map(book => bookCard(book)));
}
async function loadDashboard() {
  if (!state.user) { renderDashboard(); return; }
  state.dashboard = await api('/api/dashboard');
  renderDashboard();
}
function renderDashboard() {
  const grid = $('#mine-grid'); grid.replaceChildren();
  const pending = state.user ? (state.dashboard.incoming || []).filter(item => item.status === 'pendente').length : 0;
  $('#pending-count').hidden = pending === 0; $('#pending-count').textContent = pending;
  if (!state.user) {
    grid.append(emptyState('Sua estante fica aqui', 'Entre com o Discord para cadastrar seus livros e acompanhar os exemplares compartilhados.', loginLink()));
  } else if (!(state.dashboard.books || []).length) {
    grid.append(emptyState('Qual livro você quer compartilhar?', 'Cadastre o título, conte como está o exemplar e escolha se aceita empréstimo, troca ou os dois.', button('Adicionar primeiro livro', () => showBookForm(), 'button button-primary')));
  } else grid.append(...state.dashboard.books.map(book => bookCard(book, true)));
  renderRequests();
}
function renderRequests() {
  const list = $('#requests-list'); list.replaceChildren();
  if (!state.user) { list.append(emptyState('Entre para acompanhar seus pedidos', 'Os pedidos recebidos e enviados ficam reunidos aqui, junto com o contato dos colegas.', loginLink())); return; }
  const requests = state.dashboard[state.direction] || [];
  if (!requests.length) {
    list.append(emptyState(state.direction === 'incoming' ? 'Nenhum pedido recebido por enquanto' : 'Seu próximo livro está no catálogo', state.direction === 'incoming' ? 'Quando alguém pedir um dos seus livros, você poderá aprovar ou recusar por aqui.' : 'Explore a estante da comunidade e envie um pedido de empréstimo ou troca.', button(state.direction === 'incoming' ? 'Ver meus livros' : 'Explorar catálogo', () => setView(state.direction === 'incoming' ? 'mine' : 'catalog'))));
    return;
  }
  list.append(...requests.map(requestCard));
}
function requestCard(request) {
  const incoming = state.direction === 'incoming';
  const card = element('article', 'request-card');
  const top = element('div', 'request-top');
  const heading = element('div');
  heading.append(element('h3', '', request.book_title), element('p', '', `${labels.mode[request.type]} solicitado em ${dateText(request.created_at)}`));
  top.append(heading, statusBadge(request.status)); card.append(top);
  const details = element('div', 'request-details');
  if (request.offered_book_title) details.append(element('p', '', `Livro oferecido: ${request.offered_book_title}`));
  if (request.due_date) {
    const overdue = request.status === 'aprovado' && request.due_date < isoDay();
    details.append(element('p', overdue ? 'overdue' : '', `${overdue ? 'Devolução em atraso: ' : 'Devolução prevista: '}${dateText(request.due_date)}`));
  }
  if (details.childNodes.length) card.append(details);
  const handle = incoming ? request.requester_username : request.owner_username;
  const name = incoming ? request.requester_name : request.owner_name;
  const contact = element('div', 'request-contact');
  contact.append(element('span', '', `${incoming ? 'Solicitante' : 'Proprietário'}: ${name || handle} · @${handle}`), button('Copiar contato', async () => {
    try { await navigator.clipboard.writeText(handle); notice(`Contato @${handle} copiado. Procure esse usuário no Discord para combinar a entrega.`); }
    catch { notice(`Copie o nome de usuário para contatar no Discord: @${handle}`); }
  }, 'button button-small'));
  card.append(contact);
  if (request.message) card.append(element('p', 'request-message', request.message));
  const actions = element('div', 'request-actions');
  if (request.status === 'pendente') {
    if (incoming) {
      actions.append(button('Aprovar pedido', () => approveForm(request), 'button button-primary button-small'), button('Recusar', () => requestAction(request, 'reject', 'Recusar este pedido?', 'O pedido será encerrado e os livros reservados ficarão disponíveis novamente.', 'Recusar pedido', 'Pedido recusado.'), 'button button-small'));
    } else actions.append(button('Cancelar pedido', () => requestAction(request, 'cancel', 'Cancelar este pedido?', 'O pedido será encerrado e os exemplares serão liberados no catálogo.', 'Cancelar pedido', 'Pedido cancelado.'), 'button button-small'));
  }
  if (request.status === 'aprovado' && incoming) {
    if (request.type === 'emprestimo') actions.append(button('Registrar devolução', () => requestAction(request, 'return', 'O livro já foi devolvido?', 'Confirme apenas após receber seu exemplar de volta. Ele ficará disponível para novos pedidos.', 'Confirmar devolução', 'Devolução registrada. O livro está disponível.'), 'button button-primary button-small'));
    else actions.append(button('Concluir troca', () => requestAction(request, 'complete_exchange', 'A troca presencial já aconteceu?', 'Ao confirmar, os dois exemplares mudarão de proprietário no catálogo. Faça isso somente depois da entrega dos livros.', 'Confirmar troca', 'Troca concluída. Os exemplares estão nas novas estantes.'), 'button button-primary button-small'));
  }
  if (request.status === 'aprovado') card.append(element('p', 'request-info', request.type === 'troca' ? 'Combine a entrega presencial pelo Discord. O proprietário do livro solicitado confirma a conclusão da troca.' : 'Combine a entrega e a devolução pelo Discord. O proprietário registra o retorno do livro.'));
  if (actions.childNodes.length) card.append(actions);
  return card;
}
function setView(view) {
  state.view = view;
  for (const node of document.querySelectorAll('[data-view]')) {
    const selected = node.dataset.view === view; node.classList.toggle('is-active', selected);
    if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
  }
  for (const name of ['catalog', 'mine', 'requests']) $(`#${name}-view`).hidden = name !== view;
}

function field(name, title, options = {}) {
  const label = element('label', 'field', title);
  let control;
  if (options.options) {
    control = element('select');
    for (const [value, text] of options.options) { const item = element('option', '', text); item.value = value; control.append(item); }
  } else {
    control = element(options.multiline ? 'textarea' : 'input');
    if (!options.multiline) control.type = options.type || 'text';
    if (options.maxLength) control.maxLength = options.maxLength;
    if (options.min) control.min = options.min;
    if (options.max) control.max = options.max;
  }
  control.name = name; control.required = options.required !== false;
  if (options.value !== undefined) control.value = options.value;
  label.append(control);
  if (options.help) label.append(element('span', 'field-help', options.help));
  return label;
}
function createForm(submitText, onSubmit) {
  const form = element('form', 'form-grid');
  const error = element('p', 'form-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const actions = element('div', 'form-actions');
  const submit = element('button', 'button button-primary', submitText); submit.type = 'submit';
  actions.append(button('Cancelar', closeDialog), submit);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    error.hidden = true;
    const values = Object.fromEntries(new FormData(form));
    const controls = [...form.querySelectorAll('input,select,textarea,button')];
    controls.forEach(control => { control.disabled = true; }); $('#close-modal').disabled = true;
    const busyCancel = event => event.preventDefault(); modal.addEventListener('cancel', busyCancel);
    submit.textContent = 'Salvando…';
    try { await onSubmit(values); }
    catch (failure) { error.textContent = failure.message; error.hidden = false; }
    finally { controls.forEach(control => { control.disabled = false; }); $('#close-modal').disabled = false; modal.removeEventListener('cancel', busyCancel); submit.textContent = submitText; }
  });
  return { form, finish: () => form.append(error, actions) };
}
async function afterMutation(text) {
  closeDialog();
  notice(text);
  const results = await Promise.allSettled([loadCatalog(), loadDashboard()]);
  if (results.some(result => result.status === 'rejected')) notice(`${text} Não foi possível atualizar o painel; use Atualizar.`, true);
}
function showBookForm(book) {
  if (!requireLogin()) return;
  openDialog(book ? 'Editar exemplar' : 'Compartilhar um livro');
  $('#modal-body').append(element('p', 'dialog-copy', 'Cadastre um exemplar físico do seu acervo. Seu nome e contato do Discord serão exibidos para que os colegas combinem a entrega.'));
  const { form, finish } = createForm(book ? 'Salvar alterações' : 'Adicionar ao catálogo', async values => {
    await api(book ? `/api/books/${encodeURIComponent(book.id)}` : '/api/books', { method: book ? 'PATCH' : 'POST', body: JSON.stringify(values) });
    await afterMutation(book ? 'As informações do livro foram atualizadas.' : 'Livro adicionado ao catálogo. Sua estante já está compartilhada.');
  });
  form.append(field('title', 'Título do livro', { maxLength: 200, value: book?.title || '' }), field('author', 'Autor ou autora', { maxLength: 200, value: book?.author || '' }));
  const row = element('div', 'form-row');
  row.append(field('category', 'Categoria', { options: Object.entries(labels.category), value: book?.category || 'tecnico' }), field('condition', 'Estado do exemplar', { options: Object.entries(labels.condition), value: book?.condition || 'bom' }));
  form.append(row, field('mode', 'Como deseja compartilhar?', { options: Object.entries(labels.mode), value: book?.mode || 'emprestimo' }), field('description', 'Observações sobre o exemplar', { multiline: true, maxLength: 1200, required: false, value: book?.description || '', help: 'Informe edição, anotações ou cuidados necessários. Até 1.200 caracteres.' }));
  finish(); $('#modal-body').append(form); $('input', form).focus();
}
async function showRequestForm(book) {
  if (!requireLogin()) return;
  openDialog('Pedir este livro');
  $('#modal-body').append(element('p', 'dialog-copy', `${book.title}, de ${book.author}. O exemplar será reservado enquanto o proprietário analisa seu pedido.`));
  const possible = book.mode === 'ambos' ? ['emprestimo', 'troca'] : [book.mode];
  const { form, finish } = createForm('Enviar pedido', async values => {
    const payload = { book_id: book.id, type: values.type, message: values.message };
    if (values.type === 'troca') payload.offered_book_id = values.offered_book_id;
    await api('/api/requests', { method: 'POST', body: JSON.stringify(payload) });
    await afterMutation('Pedido enviado. Acompanhe a resposta na área Pedidos.');
    state.direction = 'outgoing'; syncDirection(); setView('requests');
  });
  const type = field('type', 'Tipo de pedido', { options: possible.map(value => [value, labels.mode[value]]) });
  const swap = element('div', 'form-grid');
  form.append(type, swap, field('message', 'Mensagem para o colega', { multiline: true, required: false, maxLength: 800, help: 'Sugira um local da universidade ou horário para a entrega. Até 800 caracteres.' }));
  finish(); $('#modal-body').append(form);
  const updateSwap = () => {
    const isSwap = $('select', type).value === 'troca'; swap.hidden = !isSwap; swap.replaceChildren();
    if (!isSwap) return;
    const options = (state.dashboard.books || []).filter(item => item.status === 'disponivel' && ['troca', 'ambos'].includes(item.mode));
    if (!options.length) {
      swap.append(element('p', 'dialog-copy', 'Para propor uma troca, cadastre primeiro um livro seu na modalidade Troca ou Empréstimo ou troca. Ele também precisa estar disponível.'), button('Cadastrar meu livro', () => showBookForm()));
      const select = field('offered_book_id', 'Livro para oferecer', { options: [['', 'Nenhum exemplar disponível']] }); swap.append(select);
    } else swap.append(field('offered_book_id', 'Seu livro para oferecer', { options: [['', 'Selecione um exemplar'], ...options.map(item => [item.id, `${item.title} — ${item.author}`])], help: 'Os dois exemplares ficarão reservados até a resposta do proprietário.' }));
  };
  $('select', type).addEventListener('change', updateSwap);
  updateSwap();
  try { await loadDashboard(); if (modal.open && form.isConnected) updateSwap(); }
  catch (error) { if (form.isConnected) { const warning = element('p', 'form-error', error.message); warning.setAttribute('role', 'alert'); swap.append(warning); } }
}
function approveForm(request) {
  if (request.type === 'troca') { requestAction(request, 'approve', 'Aprovar esta troca?', `Você receberá “${request.offered_book_title}” em troca de “${request.book_title}”. Os livros permanecerão reservados até a confirmação da entrega presencial.`, 'Aprovar troca', 'Troca aprovada. Combine a entrega pelo Discord.'); return; }
  openDialog('Aprovar empréstimo');
  $('#modal-body').append(element('p', 'dialog-copy', `Defina a data de devolução de “${request.book_title}” e combine a entrega com @${request.requester_username} pelo Discord.`));
  const { form, finish } = createForm('Aprovar empréstimo', async values => {
    await api(`/api/requests/${encodeURIComponent(request.id)}`, { method: 'PATCH', body: JSON.stringify({ action: 'approve', due_date: values.due_date }) });
    await afterMutation('Empréstimo aprovado. A data prevista ficou registrada no pedido.');
  });
  form.append(field('due_date', 'Data prevista para devolução', { type: 'date', min: isoDay(1), max: isoDay(365), value: isoDay(14), help: 'Escolha uma data a partir de amanhã e nos próximos 365 dias, pelo horário de Brasília.' }));
  finish(); $('#modal-body').append(form);
}
function requestAction(request, action, title, description, submit, success) {
  confirmAction(title, description, submit, () => api(`/api/requests/${encodeURIComponent(request.id)}`, { method: 'PATCH', body: JSON.stringify({ action }) }), success);
}
function confirmAction(title, description, submit, execute, success, danger = false) {
  openDialog(title); $('#modal-body').append(element('p', 'dialog-copy', description));
  const { form, finish } = createForm(submit, async () => { await execute(); await afterMutation(success); });
  finish(); if (danger) $('button[type="submit"]', form).className = 'button button-danger'; $('#modal-body').append(form);
}
function syncDirection() {
  for (const node of document.querySelectorAll('[data-direction]')) { const active = node.dataset.direction === state.direction; node.classList.toggle('is-active', active); node.setAttribute('aria-pressed', String(active)); }
  renderRequests();
}
for (const node of document.querySelectorAll('[data-view]')) node.addEventListener('click', () => setView(node.dataset.view));
for (const node of document.querySelectorAll('[data-direction]')) node.addEventListener('click', () => { state.direction = node.dataset.direction; syncDirection(); });
$('#hero-add').addEventListener('click', () => showBookForm());
$('#add-book').addEventListener('click', () => showBookForm());
$('#filters').addEventListener('submit', event => { event.preventDefault(); loadCatalog(); });
$('#filters').addEventListener('change', event => { if (event.target.tagName === 'SELECT') loadCatalog(); });
$('input[type="search"]').addEventListener('search', loadCatalog);
$('#refresh').addEventListener('click', async () => {
  const control = $('#refresh'); control.disabled = true;
  try {
    const identity = await api('/api/me'); state.user = identity.user;
    if (!state.user) state.dashboard = { books: [], incoming: [], outgoing: [] };
    renderProfile(); await Promise.all([loadCatalog(), loadDashboard()]);
  } catch (error) { notice(error.message, true); }
  finally { control.disabled = false; }
});

async function start() {
  $('#catalog-grid').append(element('p', 'loading', 'Consultando a estante da comunidade…'));
  const params = new URLSearchParams(location.search);
  if (params.has('auth_error')) notice('Não foi possível entrar com o Discord. Tente novamente; se continuar, verifique a configuração do aplicativo.', true);
  else if (params.get('login') === 'success') notice('Você entrou com o Discord. Bem-vindo à estante da comunidade!');
  if (params.has('auth_error') || params.has('login')) history.replaceState(null, '', location.pathname);
  const catalog = loadCatalog();
  try { const identity = await api('/api/me'); state.user = identity.user; renderProfile(); await loadDashboard(); renderCatalog(); }
  catch (error) { notice(error.message, true); renderDashboard(); }
  await catalog;
}
start();
