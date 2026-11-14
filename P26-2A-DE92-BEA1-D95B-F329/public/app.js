(() => {
  'use strict';

  const SECTIONS = ['profile', 'education', 'experience', 'projects', 'skills', 'links'];
  const THEMES = ['modern', 'classic', 'minimal'];
  const PROFILE_FIELDS = ['full_name', 'headline', 'email', 'phone', 'location', 'website', 'summary'];
  const MAX_ITEMS = { education: 20, experience: 20, projects: 20, skills: 50, links: 15 };
  const FIELD_DEFS = {
    education: [
      ['institution', 'Instituição', 'Ex.: Universidade ou escola', 200],
      ['course', 'Curso ou certificação', 'Ex.: Engenharia de Software', 200],
      ['start', 'Início', 'Ex.: 2025', 30], ['end', 'Conclusão', 'Ex.: 2028 ou Em andamento', 30],
      ['description', 'Detalhes', 'Aprendizados, atividades e conquistas.', 4000, 'textarea']
    ],
    experience: [
      ['company', 'Empresa ou organização', 'Onde você participou?', 200],
      ['role', 'Cargo ou atividade', 'Ex.: Estagiário de desenvolvimento', 200],
      ['start', 'Início', 'Ex.: Mar. 2025', 30], ['end', 'Término', 'Ex.: Atual', 30],
      ['description', 'O que você fez?', 'Descreva sua contribuição e os resultados.', 4000, 'textarea']
    ],
    projects: [
      ['name', 'Nome do projeto', 'Dê um nome à sua ideia.', 200],
      ['description', 'Sobre o projeto', 'Qual problema ele resolve? Qual foi seu papel?', 4000, 'textarea'],
      ['technologies', 'Tecnologias utilizadas', 'Ex.: HTML, CSS, JavaScript', 200],
      ['url', 'Link do projeto', 'https://meuprojeto.com', 500, 'url'],
      ['repository', 'Repositório', 'https://github.com/usuario/projeto', 500, 'url']
    ],
    skills: [
      ['name', 'Habilidade', 'Ex.: JavaScript ou Comunicação', 100],
      ['level', 'Nível ou contexto', 'Ex.: Intermediário', 60]
    ],
    links: [
      ['label', 'Nome do link', 'Ex.: GitHub ou LinkedIn', 100],
      ['url', 'Endereço', 'https://github.com/seuusuario', 500, 'url']
    ]
  };
  const SECTION_LABELS = { education: 'Formação', experience: 'Experiência', projects: 'Projeto', skills: 'Habilidade', links: 'Link' };
  const $ = (id) => document.getElementById(id);
  const state = { curriculum: emptyCurriculum(), user: null, csrf: '', section: 'profile', dirty: false, saving: false, sessionReady: false, loadFailed: false, persistedPublic: false, demo: false, publicMode: false };
  let toastTimer;

  function emptyCurriculum() {
    return { profile: Object.fromEntries(PROFILE_FIELDS.map((key) => [key, ''])), education: [], experience: [], projects: [], skills: [], links: [], theme: 'modern', is_public: false };
  }

  function normalizeCurriculum(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = emptyCurriculum();
    PROFILE_FIELDS.forEach((key) => { result.profile[key] = typeof source.profile?.[key] === 'string' ? source.profile[key] : ''; });
    Object.entries(FIELD_DEFS).forEach(([section, defs]) => {
      result[section] = Array.isArray(source[section]) ? source[section].slice(0, MAX_ITEMS[section]).filter((entry) => entry && typeof entry === 'object').map((entry) => Object.fromEntries(defs.map(([key]) => [key, typeof entry[key] === 'string' ? entry[key] : '']))) : [];
    });
    result.theme = THEMES.includes(source.theme) ? source.theme : 'modern';
    result.is_public = source.is_public === true;
    if (typeof source.user_id === 'string') result.user_id = source.user_id;
    if (typeof source.updated_at === 'string') result.updated_at = source.updated_at;
    return result;
  }

  function payloadFor(curriculum) {
    const { user_id, updated_at, ...payload } = curriculum;
    return payload;
  }

  function hasContent(curriculum = state.curriculum) {
    return PROFILE_FIELDS.some((key) => curriculum.profile[key].trim()) || Object.keys(FIELD_DEFS).some((section) => curriculum[section].some((entry) => Object.values(entry).some((value) => value.trim())));
  }

  function create(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  }

  function safeUrl(value) {
    if (!value || typeof value !== 'string') return null;
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
  }

  function websiteLabel(value) {
    try { return new URL(value).hostname.replace(/^www\./, '') + new URL(value).pathname.replace(/\/$/, ''); } catch { return value; }
  }

  function externalLink(value, label, className = 'resume-link') {
    const href = safeUrl(value);
    if (!href) return null;
    const link = create('a', className, label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function notify(message, isError = false) {
    const notice = $('notice');
    notice.textContent = message;
    notice.classList.toggle('error', isError);
    notice.hidden = !message;
  }

  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { $('toast').hidden = true; }, 4500);
  }

  async function api(path, options = {}) {
    let response;
    try { response = await fetch(path, { credentials: 'same-origin', ...options, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
    catch { throw new Error('Não foi possível conectar ao serviço. Confira sua conexão e tente novamente.'); }
    let data;
    try { data = await response.json(); } catch { throw Object.assign(new Error('O serviço não retornou uma resposta válida. Tente novamente.'), { status: response.status }); }
    if (!response.ok) throw Object.assign(new Error(data.message || 'Não foi possível concluir. Tente novamente.'), { status: response.status, code: data.error });
    return data;
  }

  function markDirty() {
    state.dirty = true;
    updateStatus();
  }

  function updateStatus() {
    const save = $('saveButton');
    save.disabled = state.saving || !state.sessionReady || state.loadFailed;
    save.lastChild.textContent = state.saving ? 'Salvando…' : 'Salvar currículo';
    const saveState = $('saveState');
    saveState.classList.toggle('saved', !!state.user && !state.dirty && !!state.curriculum.updated_at);
    saveState.classList.toggle('unsaved', state.dirty);
    let message = 'Seu rascunho está só nesta página';
    if (state.saving) message = 'Salvando suas informações…';
    else if (state.user && state.dirty) message = 'Você tem alterações para salvar';
    else if (state.user && state.curriculum.updated_at) {
      const date = new Date(state.curriculum.updated_at);
      message = Number.isNaN(date.getTime()) ? 'Todas as alterações foram salvas' : `Salvo às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (state.user) message = 'Pronto para criar seu primeiro currículo';
    else if (state.dirty) message = 'Entre com Discord para salvar seu rascunho';
    $('saveStateText').textContent = message;
    $('shareButton').disabled = !state.user || !state.curriculum.is_public || !state.persistedPublic || state.dirty || state.saving;
    $('publishHint').textContent = state.curriculum.is_public ? (state.dirty ? 'Salve para aplicar a publicação.' : 'Seu currículo está disponível pelo link.') : (state.persistedPublic ? 'Salve para retirar o currículo do ar.' : 'Você decide quando compartilhar.');
    $('isPublic').checked = state.curriculum.is_public;
    $('printButton').disabled = !hasContent();
    $('exampleNotice').hidden = !state.demo;
    $('summaryCount').textContent = `${state.curriculum.profile.summary.length.toLocaleString('pt-BR')} / 4.000`;
    const complete = [Boolean(state.curriculum.profile.full_name.trim()), ...Object.keys(FIELD_DEFS).map((section) => state.curriculum[section].some((entry) => Object.values(entry).some((value) => value.trim())))].filter(Boolean).length;
    $('completionBadge').textContent = `${complete} / 6`;
    $('completionTrack').setAttribute('aria-valuenow', String(complete));
    $('completionFill').style.width = `${complete / 6 * 100}%`;
    document.querySelectorAll('[data-theme]').forEach((button) => {
      const active = button.dataset.theme === state.curriculum.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function selectSection(section, focusTab = false) {
    if (!SECTIONS.includes(section)) return;
    state.section = section;
    SECTIONS.forEach((key) => {
      const active = key === section;
      $(`panel-${key}`).hidden = !active;
      $(`tab-${key}`).classList.toggle('active', active);
      $(`tab-${key}`).setAttribute('aria-selected', String(active));
      $(`tab-${key}`).tabIndex = active ? 0 : -1;
    });
    const index = SECTIONS.indexOf(section);
    $('sectionPosition').textContent = `Seção ${index + 1} de 6`;
    $('nextSection').firstChild.textContent = index === SECTIONS.length - 1 ? 'Voltar ao perfil ' : 'Próxima seção ';
    if (focusTab) $(`tab-${section}`).focus();
  }

  function renderField(section, index, definition, entry) {
    const [key, label, placeholder, maxLength, type = 'text'] = definition;
    const container = create('div', 'field');
    const id = `${section}-${index}-${key}`;
    const title = create('label', '', label);
    title.htmlFor = id;
    const input = create(type === 'textarea' ? 'textarea' : 'input');
    input.id = id;
    input.name = id;
    if (type !== 'textarea') input.type = type;
    else input.rows = 4;
    input.placeholder = placeholder;
    input.maxLength = maxLength;
    input.value = entry[key] || '';
    input.dataset.section = section;
    input.dataset.index = String(index);
    input.dataset.key = key;
    input.autocomplete = 'off';
    container.append(title, input);
    return container;
  }

  function renderList(section) {
    const list = $(`${section}List`);
    list.replaceChildren();
    state.curriculum[section].forEach((entry, index) => {
      const card = create('div', 'list-entry');
      const header = create('div', 'entry-heading');
      const title = create('strong', '', `${SECTION_LABELS[section]} ${String(index + 1).padStart(2, '0')}`);
      const remove = create('button', 'remove-button', 'Remover ×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remover ${SECTION_LABELS[section].toLowerCase()} ${index + 1}`);
      remove.addEventListener('click', () => {
        state.curriculum[section].splice(index, 1);
        renderList(section);
        renderResume();
        markDirty();
        const remaining = list.querySelector('input,textarea');
        (remaining || document.querySelector(`[data-add="${section}"]`)).focus();
      });
      header.append(title, remove);
      card.append(header);
      const defs = FIELD_DEFS[section];
      for (let i = 0; i < defs.length; i += 1) {
        if (defs[i][0] === 'start' && defs[i + 1]?.[0] === 'end') {
          const row = create('div', 'field-row');
          row.append(renderField(section, index, defs[i], entry), renderField(section, index, defs[i + 1], entry));
          card.append(row); i += 1;
        } else card.append(renderField(section, index, defs[i], entry));
      }
      list.append(card);
    });
    document.querySelector(`[data-add="${section}"]`).disabled = state.curriculum[section].length >= MAX_ITEMS[section];
  }

  function renderForm() {
    PROFILE_FIELDS.forEach((key) => { $(key).value = state.curriculum.profile[key]; });
    Object.keys(FIELD_DEFS).forEach(renderList);
    updateStatus();
  }

  function sectionBlock(title) {
    const section = create('section', 'resume-section');
    section.append(create('h2', '', title));
    return section;
  }

  function meaningful(entry) { return Object.values(entry).some((value) => typeof value === 'string' && value.trim()); }

  function renderResume() {
    const curriculum = state.curriculum;
    const profile = curriculum.profile;
    const header = $('resumeHeader');
    const main = $('resumeMain');
    const side = $('resumeSide');
    header.replaceChildren(); main.replaceChildren(); side.replaceChildren();
    $('resume').className = `resume resume-${curriculum.theme}`;
    const initials = profile.full_name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'T';
    header.append(create('div', 'resume-monogram', initials));
    const name = create('h1', profile.full_name.trim() ? '' : 'placeholder-name', profile.full_name.trim() || 'Seu nome começa aqui.');
    const headline = create('p', `resume-headline${profile.headline.trim() ? '' : ' placeholder-headline'}`, profile.headline.trim() || 'Sua próxima oportunidade começa com a sua história.');
    header.append(name, headline);

    if (profile.summary.trim()) { const block = sectionBlock('Sobre mim'); block.append(create('p', '', profile.summary)); main.append(block); }
    const experience = curriculum.experience.filter(meaningful);
    if (experience.length) {
      const block = sectionBlock('Experiência');
      experience.forEach((entry) => block.append(resumeEntry(entry.role || 'Experiência', entry.company, dateRange(entry), entry.description)));
      main.append(block);
    }
    const projects = curriculum.projects.filter(meaningful);
    if (projects.length) {
      const block = sectionBlock('Projetos');
      projects.forEach((entry) => {
        const item = resumeEntry(entry.name || 'Projeto', entry.technologies, '', entry.description);
        const links = create('div', 'resume-links');
        const project = externalLink(entry.url, 'Ver projeto ↗');
        const repository = externalLink(entry.repository, 'Repositório ↗');
        if (project) links.append(project);
        if (repository) links.append(repository);
        if (links.childNodes.length) item.append(links);
        block.append(item);
      });
      main.append(block);
    }
    const education = curriculum.education.filter(meaningful);
    if (education.length) {
      const block = sectionBlock('Formação');
      education.forEach((entry) => block.append(resumeEntry(entry.course || 'Formação', entry.institution, dateRange(entry), entry.description)));
      main.append(block);
    }

    const contacts = [
      [profile.email, '✉', profile.email ? `mailto:${profile.email.replace(/[\r\n]/g, '')}` : null],
      [profile.phone, '◦', null], [profile.location, '⌖', null], [profile.website, '↗', safeUrl(profile.website)]
    ].filter(([value]) => value.trim());
    if (contacts.length) {
      const block = sectionBlock('Contato'); const list = create('ul', 'contact-list');
      contacts.forEach(([value, symbol, href]) => {
        const item = create('li'); item.append(create('span', 'contact-symbol', symbol));
        if (href) { const link = create('a', '', symbol === '↗' ? websiteLabel(value) : value); link.href = href; if (symbol === '↗') { link.target = '_blank'; link.rel = 'noopener noreferrer'; } item.append(link); }
        else item.append(create('span', '', value));
        list.append(item);
      });
      block.append(list); side.append(block);
    }
    const skills = curriculum.skills.filter(meaningful);
    if (skills.length) {
      const block = sectionBlock('Habilidades'); const tags = create('div', 'skill-tags');
      skills.forEach((entry) => { const tag = create('span', 'skill-tag', entry.name || 'Habilidade'); if (entry.level) tag.append(create('small', '', ` · ${entry.level}`)); tags.append(tag); });
      block.append(tags); side.append(block);
    }
    const links = curriculum.links.filter((entry) => meaningful(entry) && safeUrl(entry.url));
    if (links.length) {
      const block = sectionBlock('Na rede'); const list = create('ul', 'contact-list');
      links.forEach((entry) => { const item = create('li'); item.append(create('span', 'contact-symbol', '↗')); item.append(externalLink(entry.url, entry.label || websiteLabel(entry.url), '')); list.append(item); });
      block.append(list); side.append(block);
    }
    if (!hasContent() && !state.publicMode) {
      const intro = sectionBlock('Sua trajetória');
      const empty = create('div', 'resume-empty');
      empty.append(create('p', '', 'Cada experiência conta. Preencha seu perfil e veja seu currículo ganhar vida aqui.'));
      const lines = create('div', 'ghost-lines');
      for (let i = 0; i < 3; i += 1) lines.append(create('span'));
      empty.append(lines); intro.append(empty); main.append(intro);
      const tip = sectionBlock('Seu repertório'); tip.append(create('p', '', 'Formação, projetos, habilidades e links: tudo no seu lugar.')); side.append(tip);
    }
    if (!main.childNodes.length && hasContent()) { const summary = sectionBlock('Apresentação'); summary.append(create('p', '', profile.headline || 'Conheça minha formação, minhas habilidades e meus projetos.')); main.append(summary); }
    side.hidden = !side.childNodes.length;
    $('resume').classList.toggle('resume-no-side', side.hidden);
    updateStatus();
  }

  function resumeEntry(title, subtitle, dates, description) {
    const entry = create('div', 'resume-entry');
    entry.append(create('h3', '', title));
    if (subtitle) entry.append(create('p', 'entry-subtitle', subtitle));
    if (dates) entry.append(create('p', 'entry-date', dates));
    if (description) entry.append(create('p', '', description));
    return entry;
  }

  function dateRange(entry) { return [entry.start, entry.end].filter((value) => value?.trim()).join(' — '); }

  function validationError() {
    const name = state.curriculum.profile.full_name.trim();
    if (name.length < 2) return { message: 'Preencha seu nome completo com pelo menos 2 caracteres.', section: 'profile', id: 'full_name' };
    if (state.curriculum.profile.email && !$('email').validity.valid) return { message: 'Confira o endereço de e-mail informado.', section: 'profile', id: 'email' };
    if (state.curriculum.profile.website && !safeUrl(state.curriculum.profile.website)) return { message: 'O site deve ser um endereço completo começando com https:// ou http://.', section: 'profile', id: 'website' };
    for (const section of ['projects', 'links']) {
      for (let index = 0; index < state.curriculum[section].length; index += 1) {
        for (const key of section === 'projects' ? ['url', 'repository'] : ['url']) {
          const value = state.curriculum[section][index][key];
          if (value && !safeUrl(value)) return { message: 'Confira os links: use um endereço completo começando com https:// ou http://.', section, id: `${section}-${index}-${key}` };
        }
      }
    }
    return null;
  }

  async function saveCurriculum() {
    if (state.saving) return;
    if (!state.user) { notify('Para guardar seu currículo e acessá-lo depois, entre com sua conta do Discord. Seu rascunho será preservado durante o login.'); $('loginButton').focus(); return; }
    const invalid = validationError();
    if (invalid) { selectSection(invalid.section); $(invalid.id).focus(); notify(invalid.message, true); return; }
    const payload = payloadFor(state.curriculum);
    const signature = JSON.stringify(payload);
    state.saving = true; updateStatus(); notify('');
    try {
      const data = await api('/api/curriculum', { method: 'PUT', headers: { 'X-CSRF-Token': state.csrf }, body: signature });
      const saved = normalizeCurriculum(data.curriculum);
      state.persistedPublic = saved.is_public;
      if (JSON.stringify(payloadFor(state.curriculum)) === signature) {
        state.curriculum = saved; state.dirty = false; renderForm(); renderResume();
        toast(saved.is_public ? 'Currículo salvo e publicado. Seu link já pode ser compartilhado.' : 'Currículo salvo. Só você tem acesso ao rascunho.');
      } else {
        state.curriculum.user_id = saved.user_id; state.curriculum.updated_at = saved.updated_at;
        toast('Versão salva. Há novas alterações no editor para salvar.');
      }
      state.demo = false; removeLoginDraft();
    } catch (error) {
      if (error.status === 401) { state.user = null; state.csrf = ''; renderAccount(); }
      notify(error.message, true);
    } finally { state.saving = false; updateStatus(); }
  }

  function renderAccount() {
    $('sessionLoading').hidden = true;
    $('loginButton').hidden = !!state.user;
    $('userMenu').hidden = !state.user;
    if (state.user) {
      $('username').textContent = state.user.username;
      $('userId').textContent = `Discord · ${state.user.user_id}`;
      const avatar = safeUrl(state.user.avatar_url);
      $('userAvatar').hidden = !avatar;
      if (avatar) $('userAvatar').src = avatar;
      else $('userAvatar').removeAttribute('src');
    }
  }

  function keepLoginDraft() {
    if (state.publicMode || (!state.dirty && !hasContent())) return;
    try { sessionStorage.setItem('trajetoria-login-draft', JSON.stringify({ curriculum: payloadFor(state.curriculum), at: Date.now() })); } catch { /* Browser storage may be unavailable. */ }
  }
  function removeLoginDraft() { try { sessionStorage.removeItem('trajetoria-login-draft'); } catch { /* Optional local draft. */ } }
  function getLoginDraft() {
    try { const draft = JSON.parse(sessionStorage.getItem('trajetoria-login-draft') || 'null'); return draft && Date.now() - draft.at < 60 * 60 * 1000 ? normalizeCurriculum(draft.curriculum) : null; } catch { return null; }
  }

  async function initializeSession() {
    try {
      const data = await api('/api/session');
      state.user = data.user || null; state.csrf = typeof data.csrf_token === 'string' ? data.csrf_token : '';
      if (state.user) {
        state.loadFailed = true;
        const own = await api('/api/curriculum');
        state.loadFailed = false;
        state.curriculum = normalizeCurriculum(own.curriculum);
        state.persistedPublic = state.curriculum.is_public;
        const draft = getLoginDraft();
        if (draft && !hasContent()) {
          state.curriculum = draft; state.curriculum.is_public = false; state.dirty = true;
          notify('Você entrou com Discord. Seu rascunho foi recuperado; confira as informações e clique em Salvar currículo.');
        } else if (draft) {
          notify('Seu currículo salvo foi carregado. Há também um rascunho da tentativa de login.');
          const recover = create('button', 'text-button', ' Recuperar rascunho'); recover.type = 'button';
          recover.addEventListener('click', () => {
            if (hasContent() && !window.confirm('Substituir o conteúdo do editor pelo rascunho anterior? O currículo salvo só será alterado ao salvar novamente.')) return;
            state.curriculum = draft; state.curriculum.is_public = false; state.dirty = true;
            renderForm(); renderResume(); removeLoginDraft(); notify('Rascunho recuperado. Confira e salve para atualizar seu currículo.');
          });
          $('notice').append(recover);
        }
        renderForm(); renderResume();
      } else {
        const draft = getLoginDraft();
        if (draft) { state.curriculum = draft; state.dirty = true; renderForm(); renderResume(); }
      }
    } catch (error) {
      notify(state.loadFailed ? 'Não foi possível carregar seu currículo salvo. Atualize a página antes de salvar, para preservar suas informações. Você ainda pode usar a prévia e exportar.' : 'Não foi possível conectar ao serviço agora. Você pode montar e exportar seu currículo nesta página; tente novamente para entrar e salvar.', true);
    } finally {
      state.sessionReady = true; renderAccount(); updateStatus();
    }
    const params = new URLSearchParams(location.search);
    if (params.has('error') || params.has('auth_error')) {
      notify('O login com Discord não foi concluído. Tente novamente e autorize o acesso ao seu perfil.', true);
      history.replaceState(null, '', location.pathname);
    }
  }

  async function loadPublic(userId) {
    state.publicMode = true;
    document.body.classList.add('public-mode');
    ['editorIntro', 'editor', 'previewNote', 'previewToolbar', 'themeBar'].forEach((id) => { const element = $(id) || (id === 'previewToolbar' ? document.querySelector('.preview-toolbar') : null); if (element) element.hidden = true; });
    $('publicHeading').hidden = false;
    $('loginButton').hidden = false;
    $('sessionLoading').hidden = true;
    $('publicTitle').textContent = 'Carregando currículo…';
    $('publicPrintButton').disabled = true;
    $('paperStage').setAttribute('aria-busy', 'true');
    try {
      const data = await api(`/api/curriculum?user=${encodeURIComponent(userId)}`);
      state.curriculum = normalizeCurriculum(data.curriculum);
      renderResume();
      $('publicTitle').textContent = state.curriculum.profile.full_name || 'Currículo publicado';
      document.title = `${state.curriculum.profile.full_name || 'Currículo'} — Trajetória`;
      $('publicPrintButton').disabled = false;
    } catch (error) {
      $('workspace').hidden = true; $('publicHeading').hidden = true; $('errorPage').hidden = false;
      if (error.status !== 404) $('publicErrorText').textContent = 'Não conseguimos carregar o currículo agora. Tente atualizar a página em alguns instantes.';
    } finally { $('paperStage').setAttribute('aria-busy', 'false'); }
  }

  function fillExample() {
    if (hasContent() && !window.confirm('Substituir o conteúdo do editor por um exemplo fictício? Seu currículo já salvo continuará guardado.')) return;
    state.curriculum = normalizeCurriculum({
      profile: { full_name: 'Sofia Almeida', headline: 'Estudante de Software & Criadora de Soluções', email: 'sofia@exemplo.com', phone: '', location: 'Curitiba, Paraná', website: 'https://example.com', summary: 'Transformo curiosidade em projetos. Estudante de Engenharia de Software, com interesse em desenvolvimento web, interfaces acessíveis e soluções que tornam o cotidiano mais simples. Busco aprender em equipe e construir experiências com propósito.' },
      education: [{ institution: 'Universidade Exemplo', course: 'Engenharia de Software', start: '2025', end: '2028 · Em andamento', description: 'Desenvolvimento web, algoritmos e arquitetura de software.' }],
      experience: [{ company: 'Comunidade de Tecnologia', role: 'Voluntária em oficinas de programação', start: '2025', end: 'Atual', description: 'Apoio a estudantes nos primeiros passos com lógica de programação e desenvolvimento de páginas web.' }],
      projects: [{ name: 'Campus em Movimento', description: 'Protótipo acadêmico para conectar estudantes a eventos da universidade. Responsável pela interface e pela organização das informações.', technologies: 'HTML · CSS · JavaScript', url: 'https://example.com', repository: 'https://github.com' }, { name: 'Minha Biblioteca', description: 'Aplicação de estudo para organizar leituras e acompanhar metas pessoais.', technologies: 'JavaScript · SQLite', url: '', repository: 'https://github.com' }],
      skills: [{ name: 'HTML & CSS', level: 'Intermediário' }, { name: 'JavaScript', level: 'Intermediário' }, { name: 'Git & GitHub', level: '' }, { name: 'Trabalho em equipe', level: '' }],
      links: [{ label: 'GitHub', url: 'https://github.com' }, { label: 'LinkedIn', url: 'https://linkedin.com' }],
      theme: 'modern', is_public: false
    });
    state.demo = true; state.dirty = true; selectSection('profile'); renderForm(); renderResume(); notify('');
  }

  async function copyShareLink() {
    if ($('shareButton').disabled || !state.user?.user_id) return;
    const url = new URL('/', location.origin); url.searchParams.set('user', state.user.user_id);
    try { await navigator.clipboard.writeText(url.href); toast('Link copiado. Sua trajetória está pronta para ser compartilhada.'); }
    catch {
      notify('Seu currículo público está neste endereço: ');
      const link = externalLink(url.href, url.href, '');
      $('notice').append(link);
      toast('Seu navegador não permitiu a cópia automática. O link está acima.');
    }
  }

  async function logout() {
    if (state.dirty && !window.confirm('Você tem alterações não salvas. Deseja sair e descartá-las?')) return;
    $('logoutButton').disabled = true;
    try {
      await api('/api/logout', { method: 'POST', headers: { 'X-CSRF-Token': state.csrf } });
      state.user = null; state.csrf = ''; state.curriculum = emptyCurriculum(); state.dirty = false; state.persistedPublic = false; state.demo = false;
      removeLoginDraft(); renderAccount(); renderForm(); renderResume(); notify('Sessão encerrada. Seu currículo salvo continua guardado na sua conta.');
    } catch (error) { notify(error.message, true); }
    finally { $('logoutButton').disabled = false; }
  }

  function printCurriculum() {
    if (!hasContent()) { notify('Preencha seu currículo ou explore o exemplo antes de exportar.'); return; }
    const previousTitle = document.title;
    document.title = `Currículo - ${state.curriculum.profile.full_name.trim() || 'Trajetória'}`;
    window.print();
    document.title = previousTitle;
  }

  $('curriculumForm').addEventListener('submit', (event) => { event.preventDefault(); saveCurriculum(); });
  $('curriculumForm').addEventListener('input', (event) => {
    const input = event.target;
    if (input.dataset.profile) state.curriculum.profile[input.dataset.profile] = input.value;
    else if (input.dataset.section) state.curriculum[input.dataset.section][Number(input.dataset.index)][input.dataset.key] = input.value;
    else return;
    input.classList.remove('invalid'); state.dirty = true; renderResume();
  });
  document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
    const section = button.dataset.add;
    if (state.curriculum[section].length >= MAX_ITEMS[section]) return;
    state.curriculum[section].push(Object.fromEntries(FIELD_DEFS[section].map(([key]) => [key, ''])));
    renderList(section); markDirty();
    $(`${section}List`).lastElementChild.querySelector('input,textarea').focus();
  }));
  document.querySelectorAll('[data-section]').forEach((button) => {
    if (button.classList.contains('section-tab')) button.addEventListener('click', () => selectSection(button.dataset.section));
  });
  $('sectionNav').addEventListener('keydown', (event) => {
    const index = SECTIONS.indexOf(state.section);
    let target;
    if (event.key === 'ArrowRight') target = (index + 1) % SECTIONS.length;
    if (event.key === 'ArrowLeft') target = (index + SECTIONS.length - 1) % SECTIONS.length;
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = SECTIONS.length - 1;
    if (target !== undefined) { event.preventDefault(); selectSection(SECTIONS[target], true); }
  });
  $('nextSection').addEventListener('click', () => selectSection(SECTIONS[(SECTIONS.indexOf(state.section) + 1) % SECTIONS.length], true));
  document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => { state.curriculum.theme = button.dataset.theme; state.dirty = true; renderResume(); }));
  $('isPublic').addEventListener('change', (event) => { state.curriculum.is_public = event.target.checked; markDirty(); });
  $('saveButton').addEventListener('click', saveCurriculum);
  $('exampleButton').addEventListener('click', fillExample);
  $('clearExampleButton').addEventListener('click', () => { if (!window.confirm('Limpar os dados deste exemplo e começar um currículo vazio?')) return; state.curriculum = emptyCurriculum(); state.demo = false; state.dirty = true; selectSection('profile'); renderForm(); renderResume(); $('full_name').focus(); });
  $('shareButton').addEventListener('click', copyShareLink);
  $('logoutButton').addEventListener('click', logout);
  $('printButton').addEventListener('click', printCurriculum);
  $('publicPrintButton').addEventListener('click', printCurriculum);
  $('loginButton').addEventListener('click', keepLoginDraft);
  window.addEventListener('beforeunload', (event) => { if (state.dirty && !state.publicMode) { event.preventDefault(); event.returnValue = ''; } });
  $('loginButton').addEventListener('click', () => { state.dirty = false; });
  const publicId = new URLSearchParams(location.search).get('user');
  renderForm(); renderResume();
  if (publicId !== null) loadPublic(publicId);
  else initializeSession();
})();
