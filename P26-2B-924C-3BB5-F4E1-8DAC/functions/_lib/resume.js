import { RequestError } from "./http.js";

export const DISCORD_ID = /^[1-9][0-9]{16,19}$/;

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(`${label} inválido.`);
  }
  return value;
}

function text(value, label, max, required = false) {
  if (typeof value !== "string") throw new RequestError(`${label} deve ser texto.`);
  const clean = value.trim();
  if (required && !clean) throw new RequestError(`${label} é obrigatório.`);
  if (clean.length > max) throw new RequestError(`${label} deve ter até ${max} caracteres.`);
  if (clean.includes("\0")) throw new RequestError(`${label} contém um caractere inválido.`);
  return clean;
}

function rows(value, label, max, read) {
  if (!Array.isArray(value) || value.length > max) {
    throw new RequestError(`${label} deve ser uma lista de até ${max} itens.`);
  }
  return value.map(read);
}

function month(value, label) {
  const clean = text(value, label, 7);
  if (clean && !/^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$/.test(clean)) {
    throw new RequestError(`${label} deve usar o formato ano-mês.`);
  }
  return clean;
}

function url(value, label, required = false) {
  const clean = text(value, label, 500, required);
  if (!clean) return clean;
  try {
    const parsed = new URL(clean);
    if (!/^https?:\/\//i.test(clean) || parsed.username || parsed.password || parsed.href.length > 500) {
      throw new Error();
    }
    return parsed.href;
  } catch {
    throw new RequestError(`${label} deve ser um endereço HTTP ou HTTPS válido.`);
  }
}

function readEducation(value) {
  const row = object(value, "Item de formação");
  const start = month(row.start, "Mês inicial");
  const end = month(row.end, "Mês final");
  if (start && end && end < start) {
    throw new RequestError("A formação deve terminar no mês inicial ou depois.");
  }
  return {
    course: text(row.course, "Curso", 120, true),
    institution: text(row.institution, "Instituição", 120, true),
    start,
    end,
    description: text(row.description, "Descrição da formação", 1000),
  };
}

function readProject(value) {
  const row = object(value, "Projeto");
  return {
    name: text(row.name, "Nome do projeto", 120, true),
    description: text(row.description, "Descrição do projeto", 1200),
    url: url(row.url, "URL do projeto"),
  };
}

function readLink(value) {
  const row = object(value, "Link");
  return { label: text(row.label, "Rótulo do link", 80, true), url: url(row.url, "URL do link", true) };
}

function readColors(value) {
  if (value === null) return null;
  const colors = object(value, "Conjunto de cores");
  const cleaned = {};
  for (const key of ["accent", "background", "text"]) {
    if (typeof colors[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(colors[key])) {
      throw new RequestError("Use cores no formato hexadecimal #RRGGBB.");
    }
    cleaned[key] = colors[key].toLowerCase();
  }
  return cleaned;
}

export function validateResume(value) {
  const resume = object(value, "Currículo");
  const profile = object(resume.profile, "Perfil profissional");
  const { theme, published } = resume;
  if (!["classic", "modern", "minimal"].includes(theme)) throw new RequestError("Selecione um tema válido.");
  if (typeof published !== "boolean") throw new RequestError("Estado de publicação inválido.");
  const email = text(profile.email, "E-mail", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RequestError("Informe um e-mail válido.");

  return {
    profile: {
      name: text(profile.name, "Nome para publicar o currículo", 120, published),
      headline: text(profile.headline, "Título profissional", 140),
      email,
      location: text(profile.location, "Localização", 120),
      summary: text(profile.summary, "Resumo profissional", 2000),
    },
    education: rows(resume.education, "Formação", 12, readEducation),
    projects: rows(resume.projects, "Projetos", 16, readProject),
    skills: rows(resume.skills, "Habilidades", 30, (skill) => text(skill, "Habilidade", 60, true)),
    links: rows(resume.links, "Links", 12, readLink),
    theme,
    colors: readColors(resume.colors),
    published,
  };
}

export async function findResume(db, userId, onlyPublished = false) {
  const row = await db.prepare(`
    SELECT r.name, r.headline, r.email, r.location, r.summary, r.theme, r.colors, r.published,
      (SELECT json_group_array(json_object('course', course, 'institution', institution,
        'start', start_month, 'end', end_month, 'description', description))
        FROM (SELECT * FROM resume_education WHERE user_id = r.user_id ORDER BY position)) AS education,
      (SELECT json_group_array(json_object('name', name, 'description', description, 'url', url))
        FROM (SELECT * FROM resume_projects WHERE user_id = r.user_id ORDER BY position)) AS projects,
      (SELECT json_group_array(name)
        FROM (SELECT name FROM resume_skills WHERE user_id = r.user_id ORDER BY position)) AS skills,
      (SELECT json_group_array(json_object('label', label, 'url', url))
        FROM (SELECT label, url FROM resume_links WHERE user_id = r.user_id ORDER BY position)) AS links
    FROM resumes r WHERE r.user_id = ? AND (? = 0 OR r.published = 1)
  `).bind(userId, Number(onlyPublished)).first();

  if (!row) return null;
  return {
    profile: { name: row.name, headline: row.headline, email: row.email, location: row.location, summary: row.summary },
    education: JSON.parse(row.education),
    projects: JSON.parse(row.projects),
    skills: JSON.parse(row.skills),
    links: JSON.parse(row.links),
    theme: row.theme,
    colors: row.colors ? JSON.parse(row.colors) : null,
    published: row.published === 1,
  };
}

export async function saveResume(db, userId, resume) {
  const { name, headline, email, location, summary } = resume.profile;
  const { theme, colors, published } = resume;
  const statements = [
    db.prepare(`INSERT INTO resumes (user_id, name, headline, email, location, summary, theme, colors, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, headline = excluded.headline,
        email = excluded.email, location = excluded.location, summary = excluded.summary,
        theme = excluded.theme, colors = excluded.colors, published = excluded.published`)
      .bind(userId, name, headline, email, location, summary, theme, colors ? JSON.stringify(colors) : null, Number(published)),
    db.prepare("DELETE FROM resume_education WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM resume_projects WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM resume_skills WHERE user_id = ?").bind(userId),
    db.prepare("DELETE FROM resume_links WHERE user_id = ?").bind(userId),
    ...resume.education.map((row, position) => db.prepare(`
      INSERT INTO resume_education (user_id, position, course, institution, start_month, end_month, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(userId, position, row.course, row.institution, row.start, row.end, row.description)),
    ...resume.projects.map((row, position) => db.prepare(`
      INSERT INTO resume_projects (user_id, position, name, description, url) VALUES (?, ?, ?, ?, ?)
    `).bind(userId, position, row.name, row.description, row.url)),
    ...resume.skills.map((skill, position) => db.prepare(`
      INSERT INTO resume_skills (user_id, position, name) VALUES (?, ?, ?)
    `).bind(userId, position, skill)),
    ...resume.links.map((row, position) => db.prepare(`
      INSERT INTO resume_links (user_id, position, label, url) VALUES (?, ?, ?, ?)
    `).bind(userId, position, row.label, row.url)),
  ];
  await db.batch(statements);
}
