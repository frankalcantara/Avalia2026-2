(() => {
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => n.append(k));
    return n;
  };
  async function api(path, opts = {}) {
    const r = await fetch('/api' + path, { credentials: 'same-origin', ...opts,
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || 'Erro ' + r.status); e.status = r.status; throw e; }
    return data;
  }
  const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body) });
  const showErr = (e) => app.prepend(el('div', { className: 'err', role: 'alert', textContent: e.message }));

  function login() {
    $('#user').hidden = true;
    app.replaceChildren(el('div', { className: 'login' },
      el('p', { textContent: 'Estude pouco a cada dia e lembre por mais tempo.' }),
      el('a', { href: '/api/auth/discord' }, el('button', { className: 'primary', textContent: 'Entrar com Discord' }))));
  }

  async function decks() {
    const list = await api('/decks');
    const input = el('input', { placeholder: 'Nome do novo baralho', maxLength: 80, 'aria-label': 'Nome do novo baralho' });
    const add = el('button', { className: 'primary', textContent: 'Criar baralho' });
    add.onclick = async () => { try { await post('/decks', { name: input.value }); decks(); } catch (e) { showErr(e); } };
    const ul = el('ul', { className: 'list' }, list.map((d) => {
      const study = el('button', { className: 'primary', textContent: d.due ? `Estudar (${d.due})` : 'Estudar', disabled: !d.due });
      study.onclick = () => study_(d);
      const open = el('button', { textContent: 'Cartões' });
      open.onclick = () => cards(d);
      return el('li', { className: 'item' },
        el('div', {}, el('b', { textContent: d.name }), el('div', { className: 'meta', textContent: `${d.total} cartões · ${d.due} para hoje` })),
        el('div', { className: 'row' }, open, study));
    }));
    app.replaceChildren(el('h2', { textContent: 'Seus baralhos' }), el('div', { className: 'row' }, input, add),
      list.length ? ul : el('p', { className: 'empty', textContent: 'Nenhum baralho ainda. Crie o primeiro acima.' }));
  }

  async function cards(deck) {
    const list = await api('/cards?deck_id=' + deck.id);
    const f = el('textarea', { rows: 2, placeholder: 'Frente (pergunta)', 'aria-label': 'Frente' });
    const b = el('textarea', { rows: 2, placeholder: 'Verso (resposta)', 'aria-label': 'Verso' });
    const add = el('button', { className: 'primary', textContent: 'Adicionar cartão' });
    add.onclick = async () => { try { await post('/cards', { deck_id: deck.id, front: f.value, back: b.value }); cards(deck); } catch (e) { showErr(e); } };
    const back = el('button', { className: 'ghost', textContent: '← Baralhos' }); back.onclick = decks;
    const del = el('button', { className: 'ghost', textContent: 'Excluir baralho' });
    del.onclick = async () => { if (confirm('Excluir este baralho e seus cartões?')) { await api('/decks?id=' + deck.id, { method: 'DELETE' }); decks(); } };
    const ul = el('ul', { className: 'list' }, list.map((c) => {
      const x = el('button', { className: 'ghost', textContent: 'Remover' });
      x.onclick = async () => { await api('/cards?id=' + c.id, { method: 'DELETE' }); cards(deck); };
      return el('li', { className: 'item' }, el('div', {}, el('b', { textContent: c.front }), el('div', { className: 'meta', textContent: c.back })), x);
    }));
    app.replaceChildren(el('div', { className: 'row' }, back, del), el('h2', { textContent: deck.name }), f, el('div', { style: 'height:.5rem' }), b,
      el('div', { style: 'margin-top:.6rem' }, add),
      list.length ? ul : el('p', { className: 'empty', textContent: 'Sem cartões. Escreva a pergunta e a resposta acima.' }));
  }

  async function study_(deck) {
    const queue = await api('/study/queue?deck_id=' + deck.id);
    let i = 0;
    const done = () => app.replaceChildren(el('h2', { textContent: 'Fila de hoje concluída' }),
      el('p', { className: 'empty', textContent: 'Os próximos cartões voltam conforme o intervalo calculado.' }),
      Object.assign(el('button', { className: 'primary', textContent: 'Voltar aos baralhos' }), { onclick: decks }));
    if (!queue.length) return done();

    function show() {
      const c = queue[i];
      const flip = el('div', { className: 'flip', tabIndex: 0, role: 'button', 'aria-label': 'Virar cartão' },
        el('div', { className: 'face front', textContent: c.front }), el('div', { className: 'face back', textContent: c.back }));
      const rate = el('div', { className: 'rate', hidden: true });
      const hint = el('p', { className: 'hint', textContent: 'Toque no cartão para ver a resposta' });
      const reveal = () => { flip.classList.add('is-flipped'); rate.hidden = false; hint.hidden = true; };
      flip.onclick = reveal;
      flip.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); } };
      [['dificil', 'Difícil', 'hard'], ['bom', 'Bom', 'good'], ['facil', 'Fácil', 'easy']].forEach(([v, label, cls]) => {
        const btn = el('button', { className: cls, textContent: label });
        btn.onclick = async () => {
          rate.querySelectorAll('button').forEach((x) => (x.disabled = true));
          try { await post('/study/review', { card_id: c.id, rating: v }); i++; i < queue.length ? show() : done(); }
          catch (e) { showErr(e); rate.querySelectorAll('button').forEach((x) => (x.disabled = false)); }
        };
        rate.append(btn);
      });
      const back = el('button', { className: 'ghost', textContent: '← Sair' }); back.onclick = decks;
      app.replaceChildren(back, el('h2', { textContent: deck.name }),
        el('div', { className: 'meta', textContent: `Cartão ${i + 1} de ${queue.length}` }),
        el('div', { className: 'bar' }, el('i', { style: `width:${(i / queue.length) * 100}%` })),
        el('div', { className: 'stage' }, flip), hint, rate);
      flip.focus();
    }
    show();
  }

  $('#logout').onclick = async () => { await post('/auth/logout', {}); login(); };
  (async () => {
    try {
      const me = await api('/me');
      $('#uname').textContent = me.name;
      if (me.avatar) $('#avatar').src = me.avatar; else $('#avatar').hidden = true;
      $('#user').hidden = false;
      await decks();
    } catch (e) { e.status === 401 ? login() : (login(), showErr(e)); }
  })();
})();
