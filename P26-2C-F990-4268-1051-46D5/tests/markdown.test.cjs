// Run with: node --test tests/markdown.test.cjs
// public/markdown.js is a plain browser script, so it is evaluated in an isolated
// context here, exactly as a browser would load it.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = {};
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "public", "markdown.js"), "utf8"),
  context
);
const md = context.renderMarkdown;

test("headings from level 1 to 6", () => {
  assert.equal(md("# Título"), "<h1>Título</h1>");
  assert.equal(md("### Seção"), "<h3>Seção</h3>");
  assert.equal(md("###### Fundo"), "<h6>Fundo</h6>");
});

test("a hash without a space is not a heading", () => {
  assert.equal(md("#semespaco"), "<p>#semespaco</p>");
});

test("bold, italic and inline code", () => {
  assert.equal(md("um **forte** e *leve*"), "<p>um <strong>forte</strong> e <em>leve</em></p>");
  assert.equal(md("use `ping`"), "<p>use <code>ping</code></p>");
});

test("markup inside inline code is not interpreted", () => {
  assert.equal(md("`**x**`"), "<p><code>**x**</code></p>");
});

test("bullet list", () => {
  assert.equal(md("- a\n- b\n* c"), "<ul>\n<li>a</li>\n<li>b</li>\n<li>c</li>\n</ul>");
});

test("numbered list", () => {
  assert.equal(md("1. um\n2. dois"), "<ol>\n<li>um</li>\n<li>dois</li>\n</ol>");
});

test("switching list type closes the previous list", () => {
  assert.equal(md("- a\n1. b"), "<ul>\n<li>a</li>\n</ul>\n<ol>\n<li>b</li>\n</ol>");
});

test("fenced code block keeps its content untouched", () => {
  const html = md("```js\n# nao e titulo\n**nao e negrito**\n```");
  assert.equal(
    html,
    "<pre><code># nao e titulo\n**nao e negrito**</code></pre>"
  );
});

test("HTML in the source is escaped (XSS)", () => {
  const html = md("<script>alert(1)</script>");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  const inCode = md("```\n<img src=x onerror=alert(1)>\n```");
  assert.ok(!inCode.includes("<img"));
});

test("quotes cannot break out of a link attribute", () => {
  const html = md('[x](https://a.com/"onmouseover="alert(1))');
  assert.ok(!/onmouseover="/.test(html));
});

test("only http(s) links become anchors", () => {
  assert.ok(md("[site](https://exemplo.com)").includes('<a href="https://exemplo.com"'));
  assert.ok(!md("[x](javascript:alert(1))").includes("<a "));
});

test("consecutive lines form one paragraph; a blank line splits them", () => {
  assert.equal(md("linha um\nlinha dois"), "<p>linha um linha dois</p>");
  assert.equal(md("a\n\nb"), "<p>a</p>\n<p>b</p>");
});

test("horizontal rule", () => {
  assert.equal(md("---"), "<hr>");
});

test("empty, null and undefined input", () => {
  assert.equal(md(""), "");
  assert.equal(md(null), "");
  assert.equal(md(undefined), "");
});

test("Windows line endings behave like Unix ones", () => {
  assert.equal(md("# A\r\n\r\ntexto"), "<h1>A</h1>\n<p>texto</p>");
});

test("placeholder characters typed by the user are ignored", () => {
  assert.equal(md("a\u0000b\u0001c"), "<p>abc</p>");
});
