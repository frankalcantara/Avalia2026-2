// Agente de teste: valida o site JÁ PUBLICADO. Uso: node tests/smoke.mjs https://SEU-PROJETO.pages.dev
const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) { console.error('Uso: node tests/smoke.mjs <URL do site>'); process.exit(2); }
const CHAVE = 'P26-2C-4106-412D-4629-3463';
let falhas = 0;
const checar = (nome, ok, detalhe = '') => { console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${ok ? '' : ' -> ' + detalhe}`); if (!ok) falhas++; };

const home = await fetch(`${base}/`);
const html = await home.text();
checar('HTTPS e página inicial 200', base.startsWith('https://') && home.status === 200, `status ${home.status}`);
checar('Rodapé contém a chave do projeto', html.includes(CHAVE));
checar('Sem scripts externos na página (só JavaScript próprio)', !/<script[^>]+src=["']https?:/i.test(html));

for (const [caminho, metodo] of [['/api/me', 'GET'], ['/api/avisos', 'GET'], ['/api/disciplinas', 'GET']]) {
  const r = await fetch(base + caminho, { method: metodo });
  checar(`${metodo} ${caminho} exige login (401)`, r.status === 401, `status ${r.status}`);
}
const post = await fetch(`${base}/api/avisos`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: '{}' });
checar('POST /api/avisos sem sessão é negado (401)', post.status === 401, `status ${post.status}`);
const cross = await fetch(`${base}/api/avisos`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
checar('POST com Origin de outro site é negado (403)', cross.status === 403, `status ${cross.status}`);

const login = await fetch(`${base}/api/auth/discord`, { redirect: 'manual' });
const loc = login.headers.get('location') || '';
checar('Login redireciona ao Discord com PKCE e redirect_uri correto',
  login.status === 302 && loc.startsWith('https://discord.com/oauth2/authorize') &&
  loc.includes('code_challenge_method=S256') && loc.includes(encodeURIComponent(`${base}/api/auth/discord/callback`)), `${login.status} ${loc}`);

const js = await fetch(`${base}/app.js`);
checar('app.js servido', js.status === 200);
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTodas as verificações passaram.');
process.exit(falhas ? 1 : 0);
