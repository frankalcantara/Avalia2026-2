import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { basename, extname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { callFunction, createEnv, mockDiscord, student } from './fixture.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = resolve(root, 'public');
const chromiumPath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

async function startServer(env) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url, 'http://127.0.0.1:' + server.address().port);
      if (url.pathname.startsWith('/api/')) {
        const method = incoming.method;
        const request = new Request(url, {
          method,
          headers: incoming.headers,
          ...(method === 'GET' || method === 'HEAD' ? {} : {
            body: Readable.toWeb(incoming),
            duplex: 'half',
          }),
        });
        const response = await callFunction(request, env);
        for (const [name, value] of response.headers) {
          if (name !== 'set-cookie') outgoing.setHeader(name, value);
        }
        if (response.headers.has('set-cookie')) {
          outgoing.setHeader('Set-Cookie', response.headers.getSetCookie());
        }
        outgoing.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const path = resolve(publicDir, url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      const type = types[extname(path)];
      if (!path.startsWith(publicDir + sep) || !type || !existsSync(path)) {
        outgoing.writeHead(404).end();
        return;
      }
      outgoing.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }).end(readFileSync(path));
    } catch (error) {
      console.error(error);
      outgoing.writeHead(500).end();
    }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  return server;
}

const launchAvailable = (() => {
  try {
    require.resolve('playwright');
    return existsSync(chromiumPath);
  } catch {
    return false;
  }
})();

test('edita, personaliza, publica, imprime e retira o currículo pelo navegador', {
  skip: launchAvailable ? false : 'Requer Playwright e Chromium (defina CHROMIUM_PATH se necessário).',
  timeout: 60_000,
}, async (context) => {
  const { chromium } = require('playwright');
  const { env, database } = createEnv();
  context.after(() => database.close());
  const server = await startServer(env);
  context.after(() => new Promise((accept) => server.close(accept)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const restoreFetch = mockDiscord(origin);
  context.after(restoreFetch);

  const localDir = join(root, '.local');
  mkdirSync(localDir, { recursive: true });
  const tempDir = mkdtempSync(join(localDir, 'browser-test-'));
  const previousTemp = process.env.TMPDIR;
  const previousCwd = process.cwd();
  process.env.TMPDIR = tempDir;
  let browser;
  try {
    process.chdir(root);
    // Use a short alias on Linux to fit Chromium’s Unix socket path limit.
    const socketTemp = process.platform === 'linux' ? '/proc/self/cwd/.local/' + basename(tempDir) : tempDir;
    browser = await chromium.launch({
      executablePath: chromiumPath,
      env: {
        ...process.env,
        TMPDIR: socketTemp,
        XDG_CACHE_HOME: tempDir,
        XDG_CONFIG_HOME: tempDir,
        XDG_DATA_HOME: tempDir,
        XDG_STATE_HOME: tempDir,
      },
    });
  } finally {
    process.chdir(previousCwd);
    if (previousTemp === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = previousTemp;
    if (!browser) rmSync(tempDir, { force: true, recursive: true });
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    page.setDefaultTimeout(7000);
    const scriptErrors = [];
    page.on('pageerror', (error) => scriptErrors.push(error.message));
    await page.route('**/api/auth/discord', async (route) => {
      const login = await route.fetch({ maxRedirects: 0 });
      assert.equal(login.status(), 302);
      const authorize = new URL(login.headers().location);
      const callback = new URL(authorize.searchParams.get('redirect_uri'));
      callback.searchParams.set('state', authorize.searchParams.get('state'));
      callback.searchParams.set('code', 'student');
      await route.fulfill({ response: login, headers: { ...login.headers(), location: callback.href } });
    });
    await page.goto(origin);
    await page.locator('#login').click();
    await page.waitForURL((url) => url.searchParams.get('login') === 'success').catch((error) => {
      throw new Error('Login de teste não retornou ao editor: ' + page.url(), { cause: error });
    });
    await page.locator('#editor input[name=name]').first().fill('Ana Silva');
    await page.locator('input[name=headline]').fill('Desenvolvedora web');
    await page.locator('textarea[name=summary]').fill('Projetos acadêmicos com dados abertos.');

    const resume = page.locator('#resume');
    await resume.getByText('Ana Silva', { exact: true }).waitFor();
    const section = (name) => page.locator('#section-nav [data-section=' + name + ']');
    const addEntry = (name) => page.locator('[data-add=' + name + ']');
    await section('education').click();
    await addEntry('education').click();
    await page.locator('#education-list input[name=course]').fill('Engenharia de Software');
    await page.locator('#education-list input[name=institution]').fill('Instituição de Exemplo');
    await section('projects').click();
    await addEntry('projects').click();
    await page.locator('#projects-list input[name=name]').fill('Mapa do Campus');
    await page.locator('#projects-list input[name=url]').fill('https://example.com/projeto');
    await section('skills').click();
    await addEntry('skills').click();
    await page.locator('#skills-list input[name=skill]').fill('JavaScript');
    await section('links').click();
    await addEntry('links').click();
    await page.locator('#links-list input[name=label]').fill('Repositório do campus');
    await page.locator('#links-list input[name=url]').fill('https://github.com/example/mapa');

    await section('appearance').click();
    for (const theme of ['minimal', 'classic', 'modern']) {
      await page.locator('input[name=theme][value=' + theme + ']').check();
      assert.equal(await resume.evaluate((element, value) => element.classList.contains('theme-' + value), theme), true);
    }
    await page.locator('#custom-colors').check();
    await page.locator('input[name=accent]').fill('#2e576a');
    assert.equal(await resume.evaluate((element) => getComputedStyle(element).getPropertyValue('--resume-accent').trim()), '#2e576a');

    const save = async () => {
      const response = page.waitForResponse((event) => event.url().endsWith('/api/resume') && event.request().method() === 'PUT');
      await page.locator('#save').click();
      const returned = await response;
      assert.equal(returned.status(), 200, await returned.text());
      return (await returned.json()).resume;
    };
    const saved = await save();
    assert.equal(saved.published, false);
    assert.equal(saved.theme, 'modern');
    assert.equal(saved.colors.accent, '#2e576a');
    assert.equal(saved.education[0].course, 'Engenharia de Software');
    assert.equal(saved.projects[0].name, 'Mapa do Campus');
    assert.deepEqual(saved.skills, ['JavaScript']);
    assert.equal(saved.links[0].url, 'https://github.com/example/mapa');

    await page.reload();
    await page.locator('#editor').waitFor();
    assert.equal(await page.locator('#editor input[name=name]').first().inputValue(), 'Ana Silva');
    await section('sharing').click();
    await page.locator('input[name=published]').check();
    assert.equal((await save()).published, true);
    const shareUrl = page.locator('#share-url');
    await shareUrl.waitFor();
    const publicUrl = await shareUrl.inputValue();
    assert.equal(publicUrl, origin + '/?user=' + student.id);

    const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    publicPage.setDefaultTimeout(7000);
    publicPage.on('pageerror', (error) => scriptErrors.push(error.message));
    await publicPage.goto(publicUrl);
    const publicResume = publicPage.locator('#resume');
    await publicResume.getByText('Engenharia de Software', { exact: true }).waitFor();
    assert.equal(await publicPage.locator('#editor').isVisible(), false);
    assert.equal(await publicResume.evaluate((element) => element.classList.contains('theme-modern')), true);
    assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    await publicPage.evaluate(() => {
      window.printCount = 0;
      window.print = () => { window.printCount += 1; };
    });
    await publicPage.locator('#print').click();
    assert.equal(await publicPage.evaluate(() => window.printCount), 1);
    await publicPage.emulateMedia({ media: 'print' });
    assert.equal(await publicPage.locator('.topbar').isVisible(), false);
    assert.equal(await publicResume.isVisible(), true);
    const pdf = await publicPage.pdf({ format: 'A4', printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    if (existsSync('/usr/bin/pdftotext')) {
      const words = execFileSync('/usr/bin/pdftotext', ['-', '-'], { input: pdf, encoding: 'utf8' });
      assert.match(words, /Ana Silva/);
      assert.match(words, /Engenharia de Software/);
      assert.doesNotMatch(words, /Exportar PDF/);
    }

    await page.locator('input[name=published]').uncheck();
    assert.equal((await save()).published, false);
    const lookup = publicPage.waitForResponse((event) => event.url().includes('/api/public-resume?user='));
    await publicPage.reload();
    assert.equal((await lookup).status(), 404);
    assert.deepEqual(scriptErrors, []);
  } finally {
    await browser.close();
    rmSync(tempDir, { force: true, recursive: true });
  }
});
