// ABNT NBR 6023:2025, §§ 6.6–6.7, 7.1.1, 7.7.5, 7.20 e 8.1.4.
// https://bkpsitecpsnew.blob.core.windows.net/uploadsitecps/sites/149/2025/05/Referencias-NBR-6023-2025.pdf
// IEEE Reference Guide, seções Books, Periodicals e Websites.
// https://journals.ieeeauthorcenter.ieee.org/wp-content/uploads/sites/7/IEEE_Reference_Guide.pdf

const limits = {
  author: 600, title: 500, year: 4, publisher: 200, journal: 200, site: 200,
  url: 2048, edition: 3, location: 200, volume: 30, issue: 30, pages: 40,
  doi: 200, accessDate: 10,
};
const requiredVehicle = { book: 'publisher', article: 'journal', website: 'site' };
const supplemental = {
  book: ['edition', 'location'],
  article: ['volume', 'issue', 'pages', 'location', 'doi'],
  website: ['url', 'accessDate'],
};
const portugueseMonths = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const englishMonths = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function validUrl(value) {
  if (!/^https?:\/\/[^\s]+$/iu.test(value)) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validDate(value) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(+date) && date.toISOString().startsWith(value);
}

export function validateReference(input) {
  const errors = {};
  const { style, sourceType, fields } = isRecord(input) ? input : {};
  if (style !== 'abnt' && style !== 'ieee') errors.style = 'Escolha ABNT ou IEEE.';
  if (typeof sourceType !== 'string' || !Object.hasOwn(requiredVehicle, sourceType)) errors.sourceType = 'Escolha um tipo de fonte válido.';
  if (!isRecord(fields)) errors.fields = 'Informe os campos da referência.';
  if (errors.sourceType || errors.fields) return { ok: false, errors };

  const vehicle = requiredVehicle[sourceType];
  const required = new Set(['title', 'year', vehicle]);
  if (sourceType === 'website') {
    required.add('url');
    required.add('accessDate');
  }
  const clean = {};
  for (const name of ['author', 'title', 'year', vehicle, ...supplemental[sourceType]]) {
    const entry = Object.hasOwn(fields, name) ? fields[name] : '';
    if (typeof entry !== 'string' || entry.length > limits[name] || /[\u0000-\u001f\u007f]/u.test(entry)) {
      errors[name] = 'Informe um texto válido de até ' + limits[name] + ' caracteres.';
      continue;
    }
    clean[name] = entry.trim().normalize('NFC');
    if (required.has(name) && !clean[name]) errors[name] = 'Preencha este campo.';
  }
  if (clean.year && (!/^\d{4}$/u.test(clean.year) || clean.year === '0000')) errors.year = 'Informe um ano entre 0001 e 9999.';
  if (clean.url && !validUrl(clean.url)) errors.url = 'Informe um endereço HTTP ou HTTPS válido.';
  if (clean.accessDate && !validDate(clean.accessDate)) errors.accessDate = 'Informe uma data de acesso válida.';
  if (clean.edition && !/^[1-9]\d{0,2}$/u.test(clean.edition)) errors.edition = 'Informe o número da edição.';
  if (clean.doi && !/^10\.\d{4,9}\/[^\s]+$/u.test(clean.doi)) errors.doi = 'Informe o DOI sem o prefixo de URL.';
  if (clean.author && clean.author.split(';').some(name => !/^[^,]*\p{L}[^,]*(?:,[^,]*\p{L}[^,]*)?$/u.test(name))) {
    errors.author = 'Informe nomes válidos separados por ponto e vírgula.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { style, sourceType, fields: clean }, errors };
}

function partsForName(raw) {
  const name = raw.trim();
  if (name.includes(',')) {
    const [last, ...rest] = name.split(',');
    return { last: last.trim(), first: rest.join(',').trim() };
  }
  const words = name.split(/\s+/u);
  if (words.length > 1 && /^(?:filho|neto|júnior|junior|sobrinho)$/iu.test(words.at(-1))) {
    words.splice(-2, 2, words.slice(-2).join(' '));
  }
  return { last: words.pop(), first: words.join(' ') };
}

function authorNames(value) {
  return value ? value.split(';').map(partsForName) : [];
}

function initials(first) {
  return first.split(/\s+/u)
    .filter(name => name && !/^(?:d[aeo]s?|de|e)$/iu.test(name))
    .map(name => name.split('-').map(part => part.match(/\p{L}/u)?.[0].toUpperCase()).filter(Boolean).join('.-') + '.')
    .join(' ');
}

function renderAuthors(value, style) {
  const names = authorNames(value);
  if (style === 'abnt') {
    return names.map(({ last, first }) => [last.toLocaleUpperCase('pt-BR'), first].filter(Boolean).join(', ')).join('; ');
  }
  const authors = names.map(({ last, first }) => [initials(first), last].filter(Boolean).join(' '));
  if (authors.length > 6) return authors[0] + ' et al.';
  if (authors.length === 2) return authors.join(' and ');
  if (authors.length > 2) return authors.slice(0, -1).join(', ') + ', and ' + authors.at(-1);
  return authors[0] || '';
}

const part = (text, italic = false) => ({ text, italic });
const sentence = value => /[.!?]$/u.test(value) ? value : value + '.';

function withLabel(value, label) {
  return value && label + value;
}

function dateText(date, style) {
  const [year, month, day] = date.split('-');
  const monthIndex = Number(month) - 1;
  return style === 'abnt'
    ? [Number(day), portugueseMonths[monthIndex], year].join(' ')
    : englishMonths[monthIndex] + ' ' + Number(day) + ', ' + year;
}

function abnt({ sourceType, fields: f }) {
  const author = renderAuthors(f.author, 'abnt');
  const title = author ? f.title : f.title.replace(/^\S+/u, word => word.toLocaleUpperCase('pt-BR'));
  const lead = author ? [part(sentence(author) + ' ')] : [];
  if (sourceType === 'book') {
    const [main, ...subtitle] = title.split(':');
    lead.push(part(main, Boolean(author)));
    if (subtitle.length) lead.push(part(':' + subtitle.join(':')));
    const edition = f.edition ? ' ' + f.edition + '. ed.' : '';
    lead.push(part((/[.!?]$/u.test(title) ? '' : '.') + edition + ' ' + (f.location || '[S. l.]') + ': ' + f.publisher + ', ' + f.year + '.'));
    return lead;
  }
  if (sourceType === 'article') {
    const [journal, ...subtitle] = f.journal.split(':');
    const publication = [f.location, withLabel(f.volume, 'v. '), withLabel(f.issue, 'n. '), withLabel(f.pages, 'p. '), f.year].filter(Boolean).join(', ');
    const doi = f.doi ? ' DOI: ' + f.doi + '.' : '';
    lead.push(part(sentence(title) + ' '), part(journal, true));
    if (subtitle.length) lead.push(part(':' + subtitle.join(':')));
    lead.push(part(', ' + publication + '.' + doi));
    return lead;
  }
  const link = 'Disponível em: ' + f.url + '. Acesso em: ' + dateText(f.accessDate, 'abnt') + '.';
  lead.push(part(sentence(title) + ' '), part(f.site, true), part(', ' + f.year + '. ' + link));
  return lead;
}

function ordinal(value) {
  const number = Number(value);
  const lastTwo = number % 100;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : ({1: 'st', 2: 'nd', 3: 'rd'}[number % 10] || 'th');
  return value + suffix;
}

function ieee({ sourceType, fields: f }, index) {
  const author = renderAuthors(f.author, 'ieee');
  const lead = [part('[' + index + '] ')];
  if (sourceType === 'book') {
    if (author) lead.push(part(author + ', '));
    lead.push(part(f.title, true));
    const edition = f.edition ? ', ' + ordinal(f.edition) + ' ed' : '';
    const place = f.location ? f.location + ': ' : '';
    lead.push(part(edition + '. ' + place + f.publisher + ', ' + f.year + '.'));
    return lead;
  }
  if (sourceType === 'article') {
    if (author) lead.push(part(author + ', '));
    const pages = f.pages.replace(/\s*[-–]\s*/gu, '–');
    const pageLabel = pages.includes('–') ? 'pp. ' : 'p. ';
    const publication = [withLabel(f.volume, 'vol. '), withLabel(f.issue, 'no. '), withLabel(pages, pageLabel), f.year, withLabel(f.doi, 'doi: ')].filter(Boolean);
    lead.push(part('“' + f.title.replace(/[.,]$/u, '') + ',”' + ' '), part(f.journal, true), part(', ' + publication.join(', ') + '.'));
    return lead;
  }
  if (author) lead.push(part(sentence(author) + ' '));
  const accessed = 'Accessed: ' + dateText(f.accessDate, 'ieee') + '. [Online]. Available: ';
  lead.push(part('“' + sentence(f.title) + '” ' + sentence(f.site) + ' ' + accessed + f.url));
  return lead;
}

export function formatReference(input, index = 1) {
  const result = validateReference(input);
  if (!result.ok) throw new TypeError('Referência inválida.');
  if (!Number.isSafeInteger(index) || index < 1) throw new TypeError('Índice inválido.');
  return result.value.style === 'abnt' ? abnt(result.value) : ieee(result.value, index);
}

const sortCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const accentCollator = new Intl.Collator('pt-BR', { sensitivity: 'accent' });
const caseCollator = new Intl.Collator('pt-BR', { sensitivity: 'variant', caseFirst: 'lower' });

export function compileBibliography(items, style) {
  const sortable = items.map(item => ({
    item,
    key: authorNames(item.fields.author)[0]?.last || item.fields.title,
  }));
  sortable.sort((left, right) => (
    sortCollator.compare(left.key, right.key)
    || accentCollator.compare(left.key, right.key)
    || caseCollator.compare(left.key, right.key)
    || caseCollator.compare(left.item.fields.title, right.item.fields.title)
    || caseCollator.compare(String(left.item.id), String(right.item.id))
    || (String(left.item.id) < String(right.item.id) ? -1 : Number(String(left.item.id) > String(right.item.id)))
  ));
  return sortable.map(({ item }, index) => {
    const parts = formatReference({ ...item, style }, index + 1);
    return { id: item.id, parts, text: parts.map(segment => segment.text).join('') };
  });
}
