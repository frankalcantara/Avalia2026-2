/*
 * Markdown parser in plain JavaScript (regular expressions, no libraries).
 * Supports: headings (#..######), bold, italic, inline code, fenced code blocks,
 * bullet and numbered lists, horizontal rules, http(s) links and paragraphs.
 * All user text is HTML-escaped first, so the output is safe for innerHTML.
 */
var renderMarkdown = (function () {
  "use strict";

  var BLOCK = "\u0000"; // placeholder around extracted code blocks
  var CODE = "\u0001"; // placeholder around inline code spans

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inline(s) {
    var spans = [];
    s = s.replace(/`([^`]+)`/g, function (_, code) {
      spans.push(code);
      return CODE + (spans.length - 1) + CODE;
    });
    s = s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
    return s.replace(new RegExp(CODE + "(\\d+)" + CODE, "g"), function (_, i) {
      return "<code>" + spans[Number(i)] + "</code>";
    });
  }

  return function renderMarkdown(source) {
    var text = String(source == null ? "" : source)
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000\u0001]/g, "");
    text = escapeHtml(text);

    // 1) Pull fenced code blocks out first, so their content is never parsed.
    var blocks = [];
    text = text.replace(/```[^\n`]*\n([\s\S]*?)```/g, function (_, code) {
      blocks.push("<pre><code>" + code.replace(/\n$/, "") + "</code></pre>");
      return "\n" + BLOCK + (blocks.length - 1) + BLOCK + "\n";
    });

    // 2) Walk the document line by line.
    var out = [];
    var para = [];
    var list = null;

    function flushPara() {
      if (para.length) {
        out.push("<p>" + inline(para.join(" ")) + "</p>");
        para = [];
      }
    }
    function closeList() {
      if (list) {
        out.push("</" + list + ">");
        list = null;
      }
    }
    function openList(tag) {
      flushPara();
      if (list !== tag) {
        closeList();
        out.push("<" + tag + ">");
        list = tag;
      }
    }

    var placeholder = new RegExp("^" + BLOCK + "\\d+" + BLOCK + "$");
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      var m;

      if (placeholder.test(trimmed)) {
        flushPara();
        closeList();
        out.push(trimmed);
      } else if ((m = line.match(/^(#{1,6})\s+(.+)$/))) {
        flushPara();
        closeList();
        out.push("<h" + m[1].length + ">" + inline(m[2].trim()) + "</h" + m[1].length + ">");
      } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flushPara();
        closeList();
        out.push("<hr>");
      } else if ((m = line.match(/^\s*[-*+]\s+(.+)$/))) {
        openList("ul");
        out.push("<li>" + inline(m[1]) + "</li>");
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
        openList("ol");
        out.push("<li>" + inline(m[1]) + "</li>");
      } else if (trimmed === "") {
        flushPara();
        closeList();
      } else {
        closeList();
        para.push(trimmed);
      }
    }
    flushPara();
    closeList();

    // 3) Put the code blocks back.
    return out.join("\n").replace(new RegExp(BLOCK + "(\\d+)" + BLOCK, "g"), function (_, i) {
      return blocks[Number(i)];
    });
  };
})();
