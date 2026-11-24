import { compileBibliography, validateReference } from '../../public/references.mjs';
import { callbackPath, discordOAuth, loginPath } from '../_lib/discord-oauth.mjs';
import { opaqueCookie, sessionCookie, sessionFor } from '../_lib/session.mjs';

const maxBodySize = 16 * 1024;
const identifier = /^[a-zA-Z0-9_-]{1,80}$/u;
const projectColumns = 'id, name, style';
const referenceColumns = 'id, source_type, fields_json';

class RequestError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200) => Response.json(value, { status, headers });
const empty = (extra = {}) => new Response(null, { status: 204, headers: { ...headers, ...extra } });

function notFound() {
  return new RequestError(404, 'not_found', 'Recurso não encontrado.');
}

function concurrentUpdate() {
  return new RequestError(409, 'concurrent_update', 'Os dados mudaram durante a atualização. Recarregue e tente novamente.');
}

function invalid(fields) {
  return new RequestError(422, 'invalid_fields', 'Confira os dados informados.', fields);
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

async function readObject(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'unsupported_media_type', 'Envie dados em JSON.');
  }
  if (Number(request.headers.get('Content-Length')) > maxBodySize) {
    throw new RequestError(413, 'payload_too_large', 'O corpo da requisição excede o limite.');
  }
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new TypeError();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0;
    let text = '';
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > maxBodySize) {
        await reader.cancel();
        throw new RequestError(413, 'payload_too_large', 'O corpo da requisição excede o limite.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const data = JSON.parse(text + decoder.decode());
    if (!record(data)) throw new TypeError();
    return data;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'invalid_json', 'O corpo deve ser um objeto JSON válido.');
  }
}

function verifyOrigin(request, url) {
  if (request.headers.get('Origin') !== url.origin) {
    throw new RequestError(403, 'invalid_origin', 'Origem da requisição inválida.');
  }
}

async function rows(statement) {
  return (await statement.all()).results;
}

function projectData(input, previous = {}) {
  const name = Object.hasOwn(input, 'name') ? input.name : previous.name;
  const style = Object.hasOwn(input, 'style') ? input.style : previous.style;
  const errors = {};
  if (typeof name !== 'string' || !name.trim() || name.length > 120 || /[\u0000-\u001f\u007f]/u.test(name)) {
    errors.name = 'Informe um nome de até 120 caracteres.';
  }
  if (style !== 'abnt' && style !== 'ieee') errors.style = 'Escolha ABNT ou IEEE.';
  if (Object.keys(errors).length) throw invalid(errors);
  return { name: name.trim().normalize('NFC'), style };
}

async function ownedProject(db, userId, projectId) {
  const project = await db.prepare(
    'SELECT ' + projectColumns + ' FROM projects WHERE id = ? AND owner_id = ?'
  ).bind(projectId, userId).first();
  if (!project) throw notFound();
  return project;
}

function mapReference(row) {
  return { id: row.id, sourceType: row.source_type, fields: JSON.parse(row.fields_json) };
}

function referenceData(input, style, previous = {}) {
  const sourceType = Object.hasOwn(input, 'sourceType') ? input.sourceType : previous.sourceType;
  let fields = Object.hasOwn(input, 'fields') ? input.fields : previous.fields;
  if (sourceType === previous.sourceType && fields !== previous.fields && record(fields)) {
    fields = { ...previous.fields, ...fields };
  }
  const result = validateReference({ style, sourceType, fields });
  if (!result.ok) throw invalid(result.errors);
  return { sourceType, fields: result.value.fields };
}

async function bibliographyRoute(request, db, userId, projectId) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  // One query keeps the style and entries in the same database snapshot.
  const found = await rows(db.prepare(
    'SELECT p.style, r.id, r.source_type, r.fields_json FROM projects p ' +
    'LEFT JOIN bibliographic_references r ON r.project_id = p.id WHERE p.id = ? AND p.owner_id = ?'
  ).bind(projectId, userId));
  if (!found.length) throw notFound();

  const { style } = found[0];
  const entries = compileBibliography(found.filter(row => row.id !== null).map(mapReference), style);
  return json({ style, entries, text: entries.map(entry => entry.text).join('\n') });
}

async function projectsRoute(request, db, userId, projectId) {
  if (!projectId) {
    if (request.method === 'GET') {
      const projects = await rows(db.prepare(
        'SELECT ' + projectColumns + ' FROM projects WHERE owner_id = ? ORDER BY created_at DESC, id'
      ).bind(userId));
      return json({ projects });
    }
    if (request.method === 'POST') {
      const project = { id: crypto.randomUUID(), ...projectData(await readObject(request)) };
      await db.prepare('INSERT INTO projects (id, owner_id, name, style) VALUES (?, ?, ?, ?)')
        .bind(project.id, userId, project.name, project.style).run();
      return json({ project }, 201);
    }
    return methodNotAllowed('GET, POST');
  }

  if (request.method === 'GET') return json({ project: await ownedProject(db, userId, projectId) });
  if (request.method === 'PATCH') {
    const previous = await ownedProject(db, userId, projectId);
    const project = { id: projectId, ...projectData(await readObject(request), previous) };
    // Reference fields are validated independently of the style used to render them.
    const result = await db.prepare(
      'UPDATE projects SET name = ?, style = ?, updated_at = unixepoch() ' +
      'WHERE id = ? AND owner_id = ? AND name = ? AND style = ?'
    ).bind(project.name, project.style, projectId, userId, previous.name, previous.style).run();
    if (!result.meta.changes) {
      await ownedProject(db, userId, projectId);
      throw concurrentUpdate();
    }
    return json({ project });
  }
  if (request.method === 'DELETE') {
    const result = await db.prepare('DELETE FROM projects WHERE id = ? AND owner_id = ?').bind(projectId, userId).run();
    if (!result.meta.changes) throw notFound();
    return empty();
  }
  return methodNotAllowed('GET, PATCH, DELETE');
}

async function referencesRoute(request, db, userId, projectId, referenceId) {
  const project = await ownedProject(db, userId, projectId);
  const ownership = ' AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND owner_id = ?)';
  if (!referenceId) {
    if (request.method === 'GET') {
      const found = await rows(db.prepare(
        'SELECT ' + referenceColumns + ' FROM bibliographic_references WHERE project_id = ?' + ownership +
        ' ORDER BY created_at, id'
      ).bind(projectId, projectId, userId));
      return json({ references: found.map(mapReference) });
    }
    if (request.method === 'POST') {
      const reference = { id: crypto.randomUUID(), ...referenceData(await readObject(request), project.style) };
      const result = await db.prepare(
        'INSERT INTO bibliographic_references (id, project_id, source_type, fields_json) ' +
        'SELECT ?, id, ?, ? FROM projects WHERE id = ? AND owner_id = ?'
      ).bind(reference.id, reference.sourceType, JSON.stringify(reference.fields), projectId, userId).run();
      if (!result.meta.changes) throw notFound();
      return json({ reference }, 201);
    }
    return methodNotAllowed('GET, POST');
  }

  if (request.method === 'PATCH') {
    const previous = await db.prepare(
      'SELECT ' + referenceColumns + ' FROM bibliographic_references WHERE id = ? AND project_id = ?' + ownership
    ).bind(referenceId, projectId, projectId, userId).first();
    if (!previous) throw notFound();
    const reference = { id: referenceId, ...referenceData(await readObject(request), project.style, mapReference(previous)) };
    const result = await db.prepare(
      'UPDATE bibliographic_references SET source_type = ?, fields_json = ?, updated_at = unixepoch() ' +
      'WHERE id = ? AND project_id = ? AND source_type = ? AND fields_json = ?' + ownership
    ).bind(reference.sourceType, JSON.stringify(reference.fields), referenceId, projectId,
      previous.source_type, previous.fields_json, projectId, userId).run();
    if (!result.meta.changes) {
      const current = await db.prepare(
        'SELECT id FROM bibliographic_references WHERE id = ? AND project_id = ?' + ownership
      ).bind(referenceId, projectId, projectId, userId).first();
      if (!current) throw notFound();
      throw concurrentUpdate();
    }
    return json({ reference });
  }
  if (request.method === 'DELETE') {
    const result = await db.prepare(
      'DELETE FROM bibliographic_references WHERE id = ? AND project_id = ?' + ownership
    ).bind(referenceId, projectId, projectId, userId).run();
    if (!result.meta.changes) throw notFound();
    return empty();
  }
  return methodNotAllowed('PATCH, DELETE');
}

function methodNotAllowed(methods) {
  return Response.json({ error: { code: 'method_not_allowed', message: 'Método indisponível.' } },
    { status: 405, headers: { ...headers, Allow: methods } });
}

export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/u, '');
    if (path === loginPath || path === callbackPath) {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return await discordOAuth(request, url, env, path);
    }
    if (path === '/api/session') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      const session = await sessionFor(request, env?.DB);
      return json({ user: session?.user ?? null });
    }
    const route = /^\/api\/projects(?:\/([^/]+)(?:\/(references|bibliography)(?:\/([^/]+))?)?)?$/u.exec(path);
    const logout = path === '/api/auth/logout';
    if (!route && !logout) throw notFound();
    const session = await sessionFor(request, env?.DB);
    if (!session) throw new RequestError(401, 'unauthenticated', 'Entre para continuar.');
    if (['POST', 'PATCH', 'DELETE'].includes(request.method)) verifyOrigin(request, url);

    if (logout) {
      if (request.method !== 'POST') return methodNotAllowed('POST');
      await env.DB.prepare('UPDATE sessions SET revoked_at = unixepoch() WHERE token_hash = ?').bind(session.hash).run();
      return empty({ 'Set-Cookie': opaqueCookie(sessionCookie, '', 0) });
    }

    const [, projectId, section, referenceId] = route;
    if ((projectId && !identifier.test(projectId)) || (referenceId && !identifier.test(referenceId))) throw notFound();
    if (section === 'bibliography') {
      if (referenceId) throw notFound();
      return await bibliographyRoute(request, env.DB, session.user.id, projectId);
    }
    if (section === 'references') return await referencesRoute(request, env.DB, session.user.id, projectId, referenceId);
    return await projectsRoute(request, env.DB, session.user.id, projectId);
  } catch (error) {
    if (!(error instanceof RequestError)) {
      return json({ error: { code: 'internal_error', message: 'Não foi possível concluir a operação.' } }, 500);
    }
    return json({ error: { code: error.code, message: error.message, fields: error.fields } }, error.status);
  }
}
