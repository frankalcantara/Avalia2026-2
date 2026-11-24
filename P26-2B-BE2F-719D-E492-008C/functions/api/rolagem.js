import { usuarioLogado } from '../_lib/sessao.js';

const DADOS = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };
const ATRIBUTOS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

// Sorteio uniforme (rejeita valores que causariam viés de módulo)
function sortear(lados) {
  const limite = Math.floor(0x100000000 / lados) * lados;
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= limite);
  return (buf[0] % lados) + 1;
}

export async function onRequestPost({ request, env }) {
  const u = await usuarioLogado(request, env);
  if (!u) return Response.json({ erro: 'não autenticado' }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const lados = DADOS[b.dado];
  if (!lados) return Response.json({ erro: 'dado inválido' }, { status: 400 });

  let modificador = 0, personagem = null, atributo = null, fichaId = null;

  if (b.ficha_id != null) {
    if (!ATRIBUTOS.includes(b.atributo)) {
      return Response.json({ erro: 'atributo inválido' }, { status: 400 });
    }
    const ficha = await env.DB.prepare('SELECT * FROM fichas WHERE id = ? AND discord_id = ?')
      .bind(Number(b.ficha_id), u.id).first();
    if (!ficha) return Response.json({ erro: 'ficha não encontrada' }, { status: 404 });
    modificador = Math.floor((ficha[b.atributo] - 10) / 2);
    personagem = ficha.nome;
    atributo = b.atributo;
    fichaId = ficha.id;
  }

  const resultado = sortear(lados);
  const total = resultado + modificador;

  await env.DB.prepare(
    `INSERT INTO rolagens (discord_id, username, ficha_id, personagem, atributo, dado, resultado, modificador, total)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(u.id, u.nome, fichaId, personagem, atributo, b.dado, resultado, modificador, total).run();

  return Response.json({ dado: b.dado, resultado, modificador, total });
}