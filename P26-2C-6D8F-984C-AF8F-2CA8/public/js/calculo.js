/**
 * Núcleo de cálculo de média — módulo ES puro, compartilhado entre o navegador
 * (public/app.js) e as Cloudflare Pages Functions (functions/api/*).
 *
 * Média ponderada: media = Σ(peso·nota) / Σ(peso)
 * Nota mínima uniforme nas avaliações restantes para atingir uma meta M:
 *   x = (M·Σpeso − Σ(peso·nota lançada)) / Σ(peso restante)
 */

export const TIPOS = ["prova", "trabalho", "lista"];

const arred = (n) => Math.round(n * 100) / 100;

/** Situação de uma meta: "garantida" (x ≤ 0), "possivel" (0 < x ≤ notaMax) ou "impossivel". */
function metaNecessaria(meta, somaPesos, somaFeita, pesoRestante, notaMax) {
  const faltaPontos = meta * somaPesos - somaFeita;
  if (pesoRestante === 0) {
    return { necessaria: null, situacao: faltaPontos <= 1e-9 ? "garantida" : "impossivel" };
  }
  const x = faltaPontos / pesoRestante;
  if (x <= 1e-9) return { necessaria: 0, situacao: "garantida" };
  if (x > notaMax + 1e-9) return { necessaria: arred(x), situacao: "impossivel" };
  return { necessaria: arred(x), situacao: "possivel" };
}

/**
 * @param {object} d disciplina { mediaAprovacao, mediaExame, mediaFinal, notaMax, avaliacoes:[{peso, nota|null}] }
 */
export function calcular(d) {
  const avs = d.avaliacoes || [];
  const notaMax = Number(d.notaMax ?? 10);
  let somaPesos = 0, somaFeita = 0, pesoFeito = 0;
  for (const a of avs) {
    const peso = Number(a.peso);
    somaPesos += peso;
    if (a.nota !== null && a.nota !== undefined && a.nota !== "") {
      somaFeita += peso * Number(a.nota);
      pesoFeito += peso;
    }
  }
  const pesoRestante = somaPesos - pesoFeito;

  // Média parcial: só sobre o que já foi lançado. Média garantida: restantes valendo 0.
  const mediaParcial = pesoFeito > 0 ? arred(somaFeita / pesoFeito) : null;
  const mediaGarantida = somaPesos > 0 ? arred(somaFeita / somaPesos) : 0;
  const mediaMaxima = somaPesos > 0 ? arred((somaFeita + pesoRestante * notaMax) / somaPesos) : 0;
  const concluida = somaPesos > 0 && pesoRestante === 0;

  const aprovacao = metaNecessaria(d.mediaAprovacao, somaPesos, somaFeita, pesoRestante, notaMax);
  const exame = metaNecessaria(d.mediaExame, somaPesos, somaFeita, pesoRestante, notaMax);

  // Situação final (só quando todas as avaliações têm nota).
  let situacao = "em_andamento";
  let notaNoExame = null;
  if (concluida) {
    const m = somaFeita / somaPesos; // compara o valor exato; arredondamento é só para exibir
    if (m >= d.mediaAprovacao - 1e-9) situacao = "aprovado";
    else if (m >= d.mediaExame - 1e-9) {
      situacao = "exame";
      // Média final = (média + exame) / 2 ≥ mediaFinal  ⇒  exame ≥ 2·mediaFinal − média
      notaNoExame = arred(Math.max(0, 2 * d.mediaFinal - m));
    } else situacao = "reprovado";
  } else if (somaPesos === 0) situacao = "em_andamento";
  else if (aprovacao.situacao === "garantida") situacao = "aprovado";
  else if (exame.situacao === "impossivel") situacao = "reprovado";

  return {
    mediaParcial, mediaGarantida, mediaMaxima,
    pesoTotal: arred(somaPesos), pesoLancado: arred(pesoFeito),
    aprovacao, exame, situacao, notaNoExame,
  };
}

/**
 * Valida e normaliza uma disciplina vinda do cliente. Retorna { ok, erro?, valor? }.
 * Usada no servidor (regra de negócio) e no cliente (feedback imediato).
 */
export function validarDisciplina(e) {
  const erro = (msg) => ({ ok: false, erro: msg });
  if (!e || typeof e !== "object") return erro("Corpo inválido.");
  const nome = String(e.nome ?? "").trim();
  if (nome.length < 1 || nome.length > 80) return erro("Nome da disciplina deve ter entre 1 e 80 caracteres.");
  // Só aceita number ou string numérica; true, [], "  " viram NaN e são rejeitados.
  const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const notaMax = num(e.notaMax ?? 10);
  if (!Number.isFinite(notaMax) || notaMax <= 0 || notaMax > 1000) return erro("Nota máxima inválida.");
  const mediaAprovacao = num(e.mediaAprovacao ?? 7);
  const mediaExame = num(e.mediaExame ?? 4);
  const mediaFinal = num(e.mediaFinal ?? 5);
  for (const [k, v] of [["Média de aprovação", mediaAprovacao], ["Média mínima para exame", mediaExame], ["Média final pós-exame", mediaFinal]]) {
    if (!Number.isFinite(v) || v < 0 || v > notaMax) return erro(`${k} deve estar entre 0 e ${notaMax}.`);
  }
  if (mediaExame > mediaAprovacao) return erro("Média mínima para exame não pode ser maior que a média de aprovação.");
  if (!Array.isArray(e.avaliacoes) || e.avaliacoes.length < 1 || e.avaliacoes.length > 30) {
    return erro("Cadastre de 1 a 30 avaliações.");
  }
  const avaliacoes = [];
  for (const [i, a] of e.avaliacoes.entries()) {
    const an = String(a?.nome ?? "").trim();
    if (an.length < 1 || an.length > 60) return erro(`Avaliação ${i + 1}: nome deve ter entre 1 e 60 caracteres.`);
    const tipo = String(a.tipo ?? "");
    if (!TIPOS.includes(tipo)) return erro(`Avaliação ${i + 1}: tipo deve ser prova, trabalho ou lista.`);
    const peso = num(a.peso);
    if (!Number.isFinite(peso) || peso <= 0 || peso > 1000) return erro(`Avaliação ${i + 1}: peso deve ser maior que 0.`);
    let nota = a.nota;
    if (nota === undefined || (typeof nota === "string" && nota.trim() === "")) nota = null;
    if (nota !== null) {
      nota = num(nota);
      if (!Number.isFinite(nota) || nota < 0 || nota > notaMax) return erro(`Avaliação ${i + 1}: nota deve estar entre 0 e ${notaMax}.`);
    }
    avaliacoes.push({ nome: an, tipo, peso, nota });
  }
  return { ok: true, valor: { nome, notaMax, mediaAprovacao, mediaExame, mediaFinal, avaliacoes } };
}
