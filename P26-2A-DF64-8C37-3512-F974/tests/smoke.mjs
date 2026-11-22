// Teste de fumaça contra o deploy publicado.
// Uso: node tests/smoke.mjs https://p26-2a-df64-8c37-3512-f974.pages.dev
const KEY = 'P26-2A-DF64-8C37-3512-F974';
const base = (process.argv[2] || process.env.BASE_URL || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Uso: node tests/smoke.mjs <URL do deploy>');
  process.exit(1);
}

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`[OK]    ${name}`);
  } catch (err) {
    failures++;
    console.log(`[FALHA] ${name}: ${err.message}`);
  }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

await check('página inicial responde 200 com a chave no <footer>', async () => {
  const res = await fetch(`${base}/`);
  expect(res.ok, `status ${res.status}`);
  const html = await res.text();
  const footer = html.match(/<footer[\s\S]*?<\/footer>/i);
  expect(footer && footer[0].includes(KEY), 'chave não encontrada no rodapé');
  expect(!/react|vue|angular|svelte/i.test(html.replace(/<footer[\s\S]*?<\/footer>/i, '')), 'possível framework de UI no HTML');
});

await check('assets estáticos (app.js, styles.css)', async () => {
  for (const p of ['/app.js', '/styles.css']) {
    const res = await fetch(base + p);
    expect(res.ok, `${p} status ${res.status}`);
  }
});

await check('/api/status: D1 migrado e OAuth configurado', async () => {
  const res = await fetch(`${base}/api/status`);
  const data = await res.json();
  expect(res.ok && data.ok, `status ${res.status}`);
  expect(data.d1 === 'ok', `d1 = ${data.d1}`);
  expect(data.discord_oauth === true, 'DISCORD_CLIENT_ID/SECRET ausentes');
});

await check('/api/auth/discord redireciona para o Discord com state', async () => {
  const res = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
  expect(res.status === 302, `status ${res.status}`);
  const loc = new URL(res.headers.get('location'));
  expect(loc.hostname === 'discord.com', `destino ${loc.hostname}`);
  expect(loc.searchParams.get('scope') === 'identify', 'scope');
  expect(loc.searchParams.get('state'), 'state ausente');
  expect(/oauth_state=.*HttpOnly/i.test(res.headers.get('set-cookie') || ''), 'cookie de state');
});

await check('callback rejeita state inválido', async () => {
  const res = await fetch(`${base}/api/auth/discord/callback?code=x&state=y`, { redirect: 'manual' });
  expect(res.status === 302, `status ${res.status}`);
  expect((res.headers.get('location') || '').includes('login=estado_invalido'), res.headers.get('location'));
});

for (const [method, path] of [['GET', '/api/me'], ['GET', '/api/decks'], ['GET', '/api/study'], ['POST', '/api/review'], ['POST', '/api/decks'], ['DELETE', '/api/cards/1']]) {
  await check(`${method} ${path} sem login -> 401`, async () => {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', origin: base },
      body: method === 'GET' ? undefined : JSON.stringify({ card_id: 1, rating: 'easy' }),
    });
    expect(res.status === 401, `status ${res.status}`);
  });
}

await check('sessão forjada é rejeitada', async () => {
  const res = await fetch(`${base}/api/me`, { headers: { cookie: '__Host-sid=forjado123' } });
  expect(res.status === 401, `status ${res.status}`);
});

await check('POST de outra origem é bloqueado (CSRF)', async () => {
  const res = await fetch(`${base}/api/decks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: '{"name":"x"}',
  });
  expect(res.status === 403, `status ${res.status}`);
});

console.log(failures ? `\n${failures} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(failures ? 1 : 0);
