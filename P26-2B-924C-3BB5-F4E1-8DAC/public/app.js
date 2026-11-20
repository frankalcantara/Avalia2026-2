const get = (id) => document.getElementById(id);
const nodes = {
  main: get('main'), workspace: get('workspace'), login: get('login'), logout: get('logout'),
  account: get('account-name'), status: get('status'), editor: get('editor'),
  navigation: get('section-nav'), preview: get('preview-area'), resume: get('resume'),
  welcome: get('welcome'), print: get('print'), save: get('save'), shareBox: get('share-box'),
  shareUrl: get('share-url'), openPublic: get('open-public'), copyPublic: get('copy-public'),
  customColors: get('custom-colors'), colorFields: get('color-fields'),
};
const profilePanel = nodes.editor.querySelector('[data-panel="profile"]');
const profileFields = [...profilePanel.querySelectorAll('input, textarea')];
const palette = { accent: '#155a52', background: '#ffffff', text: '#19312e' };
const themes = ['classic', 'modern', 'minimal'];
const sections = {
  education: {
    item: 'Formação', limit: 12, fields: [
      ['course', 'Curso', 'text', 120, true],
      ['institution', 'Instituição', 'text', 120, true],
      ['start', 'Início', 'month'],
      ['end', 'Conclusão', 'month'],
      ['description', 'Descrição', 'textarea', 1000],
    ],
  },
  projects: {
    item: 'Projeto', limit: 16, fields: [
      ['name', 'Nome do projeto', 'text', 120, true],
      ['description', 'Descrição', 'textarea', 1200],
      ['url', 'Link do projeto', 'url', 500],
    ],
  },
  skills: {
    item: 'Habilidade', limit: 30, fields: [['skill', 'Habilidade', 'text', 60, true]],
  },
  links: {
    item: 'Repositório', limit: 12, fields: [
      ['label', 'Nome do repositório', 'text', 80, true],
      ['url', 'URL do repositório', 'url', 500, true],
    ],
  },
};
const sample = {
  profile: {
    name: 'Marina Almeida', headline: 'Estudante de Engenharia de Software',
    email: '', location: 'Curitiba, PR',
    summary: 'Estudo desenvolvimento web e acessibilidade. Gosto de transformar problemas do dia a dia em ferramentas simples.',
  },
  education: [{ course: 'Engenharia de Software', institution: 'Graduação', start: '2024-02', end: '', description: '' }],
  projects: [{ name: 'Mapa da biblioteca', description: 'Catálogo com busca por título e localização de livros no campus.', url: '' }],
  skills: ['JavaScript', 'HTML e CSS', 'SQLite'],
  links: [], theme: 'modern', colors: null, published: false,
};
let user = null;
let savedResume = null;

function element(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content) result.textContent = content;
  return result;
}

function safeLink(value) {
  if (!/^https?:\/\//i.test(value) || value.length > 500) return '';
  try {
    const url = new URL(value);
    if (!url.username && !url.password && url.href.length <= 500) return url.href;
  } catch { /* A edição pode estar incompleta. */ }
  return '';
}

function externalLink(value, label) {
  const href = safeLink(value);
  if (!href) return null;
  const link = element('a', '', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function itemDetails(container, title, metadata, description, link) {
  const row = element('li', 'resume-entry');
  if (title) row.append(element('h4', '', title));
  if (metadata) row.append(element('p', 'resume-meta', metadata));
  if (description) row.append(element('p', 'resume-description', description));
  if (link) row.append(link);
  container.append(row);
}

function resumeSection(parent, title, items, render) {
  if (!items.length) return;
  const section = element('section', 'resume-section');
  const list = element('ul', 'resume-list');
  for (const item of items) render(list, item);
  section.append(element('h3', '', title), list);
  parent.append(section);
}

function formatMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return '';
  return month.slice(5) + '/' + month.slice(0, 4);
}

function renderResume(resume) {
  const sheet = nodes.resume;
  const { profile, education, projects, links, skills, theme, colors } = resume;
  sheet.className = 'resume theme-' + (themes.includes(theme) ? theme : 'classic');
  for (const color of Object.keys(palette)) {
    const value = colors?.[color];
    if (/^#[0-9a-f]{6}$/i.test(value)) sheet.style.setProperty('--resume-' + color, value);
    else sheet.style.removeProperty('--resume-' + color);
  }
  const heading = element('header', 'resume-heading');
  heading.append(element('h2', '', profile.name || 'Seu nome'));
  if (profile.headline) heading.append(element('p', 'resume-headline', profile.headline));
  const contact = element('p', 'resume-contact', [profile.location, profile.email].filter(Boolean).join(' · '));
  if (contact.textContent) heading.append(contact);

  const primary = element('div', 'resume-primary');
  const secondary = element('div', 'resume-secondary');
  if (profile.summary) {
    const summary = element('section', 'resume-section');
    summary.append(element('h3', '', 'Sobre mim'), element('p', 'resume-description', profile.summary));
    primary.append(summary);
  }
  resumeSection(primary, 'Formação', education.filter((row) => Object.values(row).some(Boolean)), (list, row) => {
    const period = [formatMonth(row.start), formatMonth(row.end)].filter(Boolean).join(' – ');
    itemDetails(list, row.course, [row.institution, period].filter(Boolean).join(' · '), row.description);
  });
  resumeSection(primary, 'Projetos', projects.filter((row) => Object.values(row).some(Boolean)), (list, row) => {
    itemDetails(list, row.name, '', row.description, externalLink(row.url, 'Ver projeto'));
  });
  resumeSection(secondary, 'Habilidades', skills.filter(Boolean), (list, skill) => {
    list.classList.add('skill-tags');
    list.append(element('li', '', skill));
  });
  const validLinks = links.map((row) => externalLink(row.url, row.label || row.url)).filter(Boolean);
  resumeSection(secondary, 'Repositórios', validLinks, (list, link) => {
    const item = element('li');
    item.append(link);
    list.append(item);
  });
  const body = element('div', 'resume-body');
  body.append(primary, secondary);
  sheet.replaceChildren(heading, body);
}

function notice(message, error = false) {
  nodes.status.hidden = !message;
  nodes.status.textContent = message;
  nodes.status.classList.toggle('notice-error', error);
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(path, { cache: 'no-store', ...options });
  } catch {
    throw new Error('Falha de conexão. Tente novamente.');
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = response.status === 401 ? 'Sua sessão expirou. Entre novamente com Discord.' :
      data?.error || 'Não foi possível consultar o servidor.';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function addRow(section, values = {}, focus = false) {
  const config = sections[section];
  const list = get(section + '-list');
  if (list.children.length >= config.limit) return;
  const row = element('fieldset', 'entry');
  row.append(element('legend', '', config.item));
  const fields = element('div', 'field-grid');
  for (const [key, label, type, limit, required] of config.fields) {
    const field = element('label', type === 'textarea' ? 'full-width' : '', label);
    const input = element(type === 'textarea' ? 'textarea' : 'input');
    if (type === 'textarea') input.rows = 3;
    else input.type = type;
    if (limit) input.maxLength = limit;
    input.required = Boolean(required);
    input.name = key;
    input.value = values[key] || '';
    field.append(input);
    fields.append(field);
  }
  const remove = element('button', 'remove-entry', 'Remover');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remover ' + config.item.toLowerCase());
  remove.addEventListener('click', () => {
    row.remove();
    update();
    get(section + '-list').parentElement.querySelector('.add-entry').focus();
  });
  row.append(fields, remove);
  list.append(row);
  if (focus) fields.querySelector('input, textarea').focus();
}

function readEditor() {
  const profile = Object.fromEntries(profileFields.map((field) => [field.name, field.value.trim()]));
  const rows = (section) => Array.from(get(section + '-list').children, (row) =>
    Object.fromEntries(Array.from(row.querySelectorAll('input, textarea'), (field) => [field.name, field.value.trim()])));
  return {
    profile,
    education: rows('education'),
    projects: rows('projects'),
    skills: rows('skills').map((row) => row.skill),
    links: rows('links'),
    theme: nodes.editor.elements.theme.value,
    colors: nodes.customColors.checked ? Object.fromEntries(
      Object.keys(palette).map((color) => [color, nodes.editor.elements[color].value])) : null,
    published: nodes.editor.elements.published.checked,
  };
}

function setEditor(resume) {
  for (const field of profileFields) field.value = resume?.profile[field.name] || '';
  for (const section of Object.keys(sections)) {
    get(section + '-list').replaceChildren();
    for (const item of resume?.[section] || []) addRow(section, section === 'skills' ? { skill: item } : item);
  }
  nodes.editor.elements.theme.value = resume?.theme || 'classic';
  nodes.customColors.checked = Boolean(resume?.colors);
  for (const color of Object.keys(palette)) nodes.editor.elements[color].value = resume?.colors?.[color] || palette[color];
  nodes.editor.elements.published.checked = Boolean(resume?.published);
}

function selectSection(selected) {
  for (const panel of nodes.editor.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== selected;
  for (const button of nodes.navigation.querySelectorAll('[data-section]')) {
    if (button.dataset.section === selected) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
}

function update() {
  const resume = readEditor();
  nodes.colorFields.hidden = !nodes.customColors.checked;
  nodes.print.disabled = !resume.profile.name;
  for (const [section, config] of Object.entries(sections)) {
    const count = get(section + '-list').children.length;
    nodes.editor.querySelector('[data-add="' + section + '"]').disabled = count >= config.limit;
  }
  renderResume(resume);
  const isPublic = Boolean(savedResume?.published);
  nodes.shareBox.hidden = !isPublic;
  if (isPublic) {
    const url = new URL('/', location.origin);
    url.searchParams.set('user', user.id);
    nodes.shareUrl.value = url.href;
    nodes.openPublic.href = url.href;
  }
}

function validateEditor(resume) {
  profileFields[0].required = resume.published;
  for (const field of nodes.editor.querySelectorAll('input, textarea')) {
    field.setCustomValidity('');
    if (field.required && !field.value.trim()) field.setCustomValidity('Preencha este campo.');
    if (field.type === 'url' && field.value && !safeLink(field.value)) {
      field.setCustomValidity('Informe um endereço HTTP ou HTTPS válido, sem credenciais, de até 500 caracteres.');
    }
    if (field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
      field.setCustomValidity('Informe um e-mail válido.');
    }
    if (field.type === 'month' && field.value && !/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(field.value)) {
      field.setCustomValidity('Informe um mês válido e um ano com quatro dígitos.');
    }
    if (field.name === 'end' && field.value) {
      const start = field.closest('.entry').querySelector('[name="start"]').value;
      if (start && field.value < start) field.setCustomValidity('A conclusão deve ser posterior ou igual ao início.');
    }
    if (!field.validity.valid) {
      selectSection(field.closest('[data-panel]').dataset.panel);
      field.reportValidity();
      return false;
    }
  }
  return true;
}

nodes.navigation.addEventListener('click', (event) => {
  const button = event.target.closest('[data-section]');
  if (button) selectSection(button.dataset.section);
});
nodes.editor.addEventListener('input', (event) => {
  event.target.setCustomValidity?.('');
  if (!nodes.save.disabled) notice('');
  update();
});
nodes.editor.addEventListener('click', (event) => {
  const button = event.target.closest('[data-add]');
  if (button) {
    addRow(button.dataset.add, {}, true);
    update();
  }
});
nodes.editor.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (nodes.save.disabled) return;
  const draft = readEditor();
  if (!validateEditor(draft)) return;
  nodes.save.disabled = true;
  notice('Salvando currículo…');
  try {
    const submitted = JSON.stringify(draft);
    const data = await request('/api/resume', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: submitted,
    });
    savedResume = data.resume;
    if (JSON.stringify(readEditor()) === submitted) {
      setEditor(savedResume);
      notice(draft.published ? 'Currículo salvo e público.' : 'Currículo salvo.');
    } else {
      notice('Currículo salvo. Há alterações mais recentes para salvar.');
    }
    update();
  } catch (error) {
    if (error.status === 401) {
      nodes.login.hidden = false;
      nodes.login.target = '_blank';
      nodes.login.rel = 'noopener';
    }
    notice(error.message, true);
  } finally {
    nodes.save.disabled = false;
  }
});
nodes.copyPublic.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(nodes.shareUrl.value);
    notice('Link copiado.');
  } catch {
    nodes.shareUrl.select();
    notice('Link selecionado. Use a opção de copiar do seu dispositivo.');
  }
});
nodes.print.addEventListener('click', () => window.print());
nodes.logout.addEventListener('click', async () => {
  nodes.logout.disabled = true;
  try {
    await request('/api/auth/logout', { method: 'POST' });
    location.assign('/');
  } catch (error) {
    notice(error.message, true);
    nodes.logout.disabled = false;
  }
});

function showWelcome() {
  nodes.workspace.classList.add('guest-workspace');
  nodes.welcome.hidden = false;
  nodes.login.hidden = false;
  nodes.preview.hidden = false;
  get('preview-status').textContent = 'Exemplo';
  renderResume(sample);
}

async function initialize() {
  const params = new URLSearchParams(location.search);
  if (params.has('user')) {
    nodes.main.classList.add('public-page');
    get('page-title').textContent = 'Currículo público';
    get('page-description').textContent = 'Portfólio acadêmico';
    try {
      const { resume } = await request('/api/public-resume?user=' + encodeURIComponent(params.get('user')));
      renderResume(resume);
      document.title = resume.profile.name + ' | Trajetória';
      nodes.preview.hidden = false;
      nodes.print.disabled = false;
    } catch (error) {
      notice(error.status === 404 ? 'Este currículo está indisponível.' : error.message, true);
    }
    return;
  }
  try {
    ({ user } = await request('/api/session'));
    if (!user) {
      showWelcome();
      if (params.has('auth_error')) notice('O login com Discord não foi concluído. Tente novamente.', true);
      return;
    }
    nodes.account.textContent = user.username;
    nodes.account.hidden = false;
    if (typeof user.avatar === 'string' && user.avatar.startsWith('https://cdn.discordapp.com/')) {
      const avatar = get('account-avatar');
      avatar.addEventListener('error', () => { avatar.hidden = true; }, { once: true });
      avatar.src = user.avatar;
      avatar.hidden = false;
    }
    nodes.logout.hidden = false;
    ({ resume: savedResume } = await request('/api/resume'));
    setEditor(savedResume);
    nodes.editor.hidden = false;
    nodes.navigation.hidden = false;
    nodes.preview.hidden = false;
    nodes.save.hidden = false;
    get('jump-preview').hidden = false;
    update();
  } catch (error) {
    if (!user) showWelcome();
    notice(error.message, true);
  }
}

initialize();
