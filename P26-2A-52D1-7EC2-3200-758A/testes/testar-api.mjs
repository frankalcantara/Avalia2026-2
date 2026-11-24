#!/usr/bin/env node
/**
 * Bateria de testes do Agente 3 (Teste e Validação) — zero dependências (só Node.js 18+).
 *
 * Uso:
 *   node testes/testar-api.mjs https://projeto-p26-2a-52d1-7ec2-3200-758a.pages.dev
 *   node testes/testar-api.mjs http://127.0.0.1:8788            (wrangler pages dev local)
 *
 * Testes com login (opcional): defina SESSAO_A e SESSAO_B com o valor do cookie "sessao"
 * de duas contas diferentes. Sem elas, roda só os testes públicos e os de bloqueio.
 */

const BASE = (process.argv[2] || "http://127.0.0.1:8788").replace(/\/$/, "");
const CHAVE = "P26-2A-52D1-7EC2-3200-758A";
const SESSAO_A = process.env.SESSAO_A;
const SESSAO_B = process.env.SESSAO_B;

let aprovados = 0;
let reprovados = 0;

async function chamar(caminho, { metodo = "GET", corpo, sessao } = {}) {
  const headers = {};
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  if (sessao) headers.Cookie = `sessao=${sessao}`;
  const res = await fetch(BASE + caminho, {
    method: metodo, headers, redirect: "manual",
    body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
  let dados = null;
  const texto = await res.text();
  try { dados = JSON.parse(texto); } catch { dados = texto; }
  return { status: res.status, dados, headers: res.headers };
}

async function teste(nome, fn) {
  try {
    await fn();
    aprovados++;
    console.log(`  ✅ ${nome}`);
  } catch (e) {
    reprovados++;
    console.log(`  ❌ ${nome}\n     → ${e.message}`);
  }
}

function esperar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

console.log(`\n🧪 Testando ${BASE}\n`);

console.log("Página e diagnóstico");
await teste("página inicial responde 200 e mostra a chave no rodapé", async () => {
  const r = await chamar("/");
  esperar(r.status === 200, `status ${r.status}`);
  esperar(String(r.dados).includes("<footer") && String(r.dados).includes(CHAVE), "chave não encontrada no <footer>");
});
await teste("/api/status confirma D1 conectado", async () => {
  const r = await chamar("/api/status");
  esperar(r.status === 200 && r.dados.d1Conectado === true, JSON.stringify(r.dados));
});

console.log("\nGaleria (média e total agregados no servidor)");
let titulos = [];
await teste("GET /api/titulos devolve lista com media e total", async () => {
  const r = await chamar("/api/titulos?ordem=media");
  esperar(r.status === 200 && Array.isArray(r.dados.titulos) && r.dados.titulos.length > 0, "lista vazia");
  titulos = r.dados.titulos;
  esperar(titulos.every((t) => typeof t.media === "number" && typeof t.total === "number"), "campos media/total ausentes");
});
await teste("ordem=media está em ordem decrescente de média", async () => {
  const medias = titulos.map((t) => t.media);
  esperar(medias.every((m, i) => i === 0 || medias[i - 1] >= m), `fora de ordem: ${medias.join(",")}`);
});
await teste("ordem=popularidade está em ordem decrescente de total", async () => {
  const r = await chamar("/api/titulos?ordem=popularidade");
  const totais = r.dados.titulos.map((t) => t.total);
  esperar(totais.every((m, i) => i === 0 || totais[i - 1] >= m), `fora de ordem: ${totais.join(",")}`);
});
await teste("ordem=recentes está em ordem decrescente de ano", async () => {
  const r = await chamar("/api/titulos?ordem=recentes");
  const anos = r.dados.titulos.map((t) => t.ano_lancamento);
  esperar(anos.every((a, i) => i === 0 || anos[i - 1] >= a), `fora de ordem: ${anos.join(",")}`);
});
await teste("filtro tipo=serie devolve só séries", async () => {
  const r = await chamar("/api/titulos?tipo=serie");
  esperar(r.dados.titulos.length > 0 && r.dados.titulos.every((t) => t.tipo === "serie"), "veio algo que não é série");
});
await teste("busca com caracteres especiais não quebra o SQL", async () => {
  const r = await chamar("/api/titulos?busca=" + encodeURIComponent("%' OR 1=1 --"));
  esperar(r.status === 200 && r.dados.titulos.length === 0, `status ${r.status}, ${r.dados.titulos?.length} resultados`);
});
await teste("GET /api/titulos/abc responde 400; id inexistente responde 404", async () => {
  esperar((await chamar("/api/titulos/abc")).status === 400, "id inválido não deu 400");
  esperar((await chamar("/api/titulos/999999")).status === 404, "id inexistente não deu 404");
});

console.log("\nBloqueios sem login (o servidor não confia no navegador)");
await teste("avaliar sem login → 401", async () => {
  const r = await chamar(`/api/titulos/${titulos[0]?.id || 1}/avaliacao`, { metodo: "PUT", corpo: { nota: 5 } });
  esperar(r.status === 401, `status ${r.status}`);
});
await teste("avaliar com cookie de sessão falso → 401", async () => {
  const r = await chamar(`/api/titulos/1/avaliacao`, { metodo: "PUT", corpo: { nota: 5 }, sessao: "f".repeat(64) });
  esperar(r.status === 401, `status ${r.status}`);
});
await teste("cadastrar título sem login → 401", async () => {
  const r = await chamar("/api/titulos", { metodo: "POST", corpo: { nome: "Teste", tipo: "filme", ano_lancamento: 2020 } });
  esperar(r.status === 401, `status ${r.status}`);
});
await teste("remover avaliação sem login → 401", async () => {
  const r = await chamar("/api/titulos/1/avaliacao", { metodo: "DELETE" });
  esperar(r.status === 401, `status ${r.status}`);
});
await teste("login redireciona ao Discord com state anti-CSRF (ou 503 se não configurado)", async () => {
  const r = await chamar("/api/auth/discord");
  if (r.status === 503) return;
  const destino = r.headers.get("location") || "";
  esperar(r.status === 302 && destino.startsWith("https://discord.com/") && /[?&]state=[0-9a-f]{32}/.test(destino), `status ${r.status}`);
});
await teste("callback com state forjado é recusado", async () => {
  const r = await chamar("/api/auth/discord/callback?code=x&state=forjado");
  esperar(r.status === 302 && (r.headers.get("location") || "").includes("erro_login=state_invalido"), `status ${r.status}`);
});

if (SESSAO_A && SESSAO_B) {
  console.log("\nRegras de negócio com login (duas contas)");
  const id = titulos[titulos.length - 1].id;
  const caminho = `/api/titulos/${id}/avaliacao`;

  await teste("nota 0, 6, 3.5 e '5' (texto) → 400", async () => {
    for (const nota of [0, 6, 3.5, "5"]) {
      const r = await chamar(caminho, { metodo: "PUT", corpo: { nota }, sessao: SESSAO_A });
      esperar(r.status === 400, `nota ${JSON.stringify(nota)} deu ${r.status}`);
    }
  });
  await teste("resenha com mais de 500 caracteres → 400", async () => {
    const r = await chamar(caminho, { metodo: "PUT", corpo: { nota: 3, resenha: "x".repeat(501) }, sessao: SESSAO_A });
    esperar(r.status === 400, `status ${r.status}`);
  });
  await teste("primeira avaliação → 201; segunda da mesma pessoa vira edição → 200", async () => {
    await chamar(caminho, { metodo: "DELETE", sessao: SESSAO_A });
    const r1 = await chamar(caminho, { metodo: "PUT", corpo: { nota: 5, resenha: "teste" }, sessao: SESSAO_A });
    const r2 = await chamar(caminho, { metodo: "PUT", corpo: { nota: 3, resenha: "editada" }, sessao: SESSAO_A });
    esperar(r1.status === 201 && r2.status === 200 && r2.dados.editada === true, `${r1.status} / ${r2.status}`);
  });
  await teste("chave composta: continua existindo uma única nota da pessoa A", async () => {
    const r = await chamar(`/api/titulos/${id}`, { sessao: SESSAO_A });
    const minhas = r.dados.avaliacoes.filter((a) => a.user_id === r.dados.minha.user_id);
    esperar(minhas.length === 1 && minhas[0].nota === 3, `encontradas ${minhas.length}`);
  });
  await teste("user_id enviado no corpo é ignorado (não dá para avaliar no nome de outra pessoa)", async () => {
    const eu = await chamar("/api/me", { sessao: SESSAO_A });
    await chamar(caminho, { metodo: "PUT", corpo: { nota: 1, user_id: eu.dados.usuario.user_id }, sessao: SESSAO_B });
    const r = await chamar(`/api/titulos/${id}`, { sessao: SESSAO_A });
    esperar(r.dados.minha.nota === 3, "a nota da pessoa A foi alterada pela pessoa B!");
  });
  await teste("média aritmética e total corretos após as duas notas (3 e 1 → 2,0 / 2)", async () => {
    const r = await chamar(`/api/titulos/${id}`);
    esperar(r.dados.titulo.total >= 2, `total ${r.dados.titulo.total}`);
    const notas = r.dados.avaliacoes.map((a) => a.nota);
    const media = Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 100) / 100;
    esperar(r.dados.titulo.media === media, `servidor ${r.dados.titulo.media} ≠ calculado ${media}`);
  });
  await teste("limpeza: remover as duas avaliações de teste", async () => {
    esperar((await chamar(caminho, { metodo: "DELETE", sessao: SESSAO_A })).status === 200, "A");
    esperar((await chamar(caminho, { metodo: "DELETE", sessao: SESSAO_B })).status === 200, "B");
  });
} else {
  console.log("\n(ℹ️  Testes com login pulados: defina SESSAO_A e SESSAO_B para rodá-los.)");
}

console.log(`\nResultado: ${aprovados} aprovados, ${reprovados} reprovados\n`);
process.exit(reprovados ? 1 : 0);
