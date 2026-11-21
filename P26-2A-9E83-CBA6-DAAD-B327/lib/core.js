export const KEY = 'P26-2A-9E83-CBA6-DAAD-B327';
// Regra de 60h por eixo é uma hipótese explícita do enunciado ("ex: máximo de 60").
// Ajustar conforme decisão oficial da instituição antes do uso real.
export const LIMITS = Object.freeze({ ensino: 60, pesquisa: 60, extensao: 60 });
export const TOTAL_TARGET = 180;
export const CATEGORIES = Object.keys(LIMITS);
export const isValidDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10) === s;
export function validateActivity(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Envie um objeto JSON válido.';
  if (typeof raw.title !== 'string' || raw.title.trim().length < 3 || raw.title.trim().length > 120) return 'Título: 3 a 120 caracteres.';
  if (!CATEGORIES.includes(raw.category)) return 'Categoria inválida.';
  if (typeof raw.hours !== 'number' || !Number.isFinite(raw.hours) || raw.hours <= 0 || raw.hours > 1000 || Math.round(raw.hours * 2) !== raw.hours * 2) return 'Horas devem ser positivas, com incrementos de 0,5.';
  if (typeof raw.certificate_url !== 'string' || raw.certificate_url.length > 500) return 'Link do certificado é obrigatório (máximo 500 caracteres).';
  try { const u = new URL(raw.certificate_url); if (u.protocol !== 'https:' || !u.hostname.includes('.')) return 'Informe um link HTTPS válido.'; } catch { return 'Informe um link HTTPS válido.'; }
  if (!isValidDate(raw.activity_date)) return 'Data inválida (AAAA-MM-DD).';
  if (raw.activity_date > new Date().toISOString().slice(0,10)) return 'A data não pode estar no futuro.';
  if (raw.description !== undefined && (typeof raw.description !== 'string' || raw.description.length > 500)) return 'Descrição: máximo 500 caracteres.';
  return null;
}
export function totals(rows) {
  const result = Object.fromEntries(CATEGORIES.map(c => [c,{submitted:0,validated:0,limit:LIMITS[c]}]));
  for(const a of rows){if(result[a.category]){result[a.category].submitted += a.hours; result[a.category].validated += Math.min(a.validated_hours ?? a.hours, a.hours);}}
  for(const c of CATEGORIES){result[c].remaining = Math.max(0,result[c].limit-result[c].validated); result[c].percent=Math.min(100,Math.round(result[c].validated/result[c].limit*100));}
  return result;
}
