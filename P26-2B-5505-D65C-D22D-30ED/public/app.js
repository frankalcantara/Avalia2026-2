function parseMarkdown(md) {
  if (!md) return "";
  let html = md;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
  html = html.replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\n<ul>/gim, '');
  html = html.replace(/\n/gim, '<br>');
  return html.trim();
}

document.addEventListener("DOMContentLoaded", async () => {
  const mdInput = document.getElementById("md-input");
  const mdPreview = document.getElementById("md-preview");
  const btnSave = document.getElementById("btn-save-note");
  const statusMsg = document.getElementById("statusMessage");
  const userText = document.getElementById("discordUserText");
  const btnLogout = document.getElementById("btnLogout");

  // Live Preview ao digitar
  if (mdInput && mdPreview) {
    mdInput.addEventListener("input", (e) => {
      mdPreview.innerHTML = parseMarkdown(e.target.value);
    });
  }

  // Checar Sessão
  try {
    const res = await fetch("/api/status");
    const data = await res.json();

    if (data.authenticated && data.user) {
      userText.textContent = `Discord: ${data.user.username}`;
      if (btnLogout) btnLogout.style.display = "inline";
      loadNotes();
    } else {
      userText.innerHTML = `<a href="/api/auth/discord" style="color:white; font-weight:bold;">Entrar com Discord</a>`;
      if (btnLogout) btnLogout.style.display = "none";
      document.getElementById("recordsList").innerHTML = `<li>Faça login com o Discord para ver e salvar suas notas.</li>`;
    }
  } catch (err) {
    console.error("Erro ao verificar status:", err);
  }

  // Salvar Nota
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const title = document.getElementById("note-title").value.trim();
      const content = mdInput.value.trim();
      const tagsRaw = document.getElementById("note-tags").value.trim();
      const tags = tagsRaw ? tagsRaw.split(",").map(t => t.trim()) : [];

      if (!content) {
        statusMsg.style.color = "#dc2626";
        statusMsg.textContent = "Digite algum conteúdo na caixa Markdown para salvar!";
        return;
      }

      statusMsg.style.color = "#2563eb";
      statusMsg.textContent = "Salvando no Cloudflare D1...";

      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, tags })
        });

        if (res.ok) {
          statusMsg.style.color = "#166534";
          statusMsg.textContent = "✓ Nota salva no Cloudflare D1!";
          document.getElementById("note-title").value = "";
          mdInput.value = "";
          mdPreview.innerHTML = "";
          document.getElementById("note-tags").value = "";
          loadNotes();
        } else {
          const errData = await res.json();
          statusMsg.style.color = "#dc2626";
          statusMsg.textContent = errData.error || "Erro ao salvar nota.";
        }
      } catch (err) {
        statusMsg.style.color = "#dc2626";
        statusMsg.textContent = "Erro de conexão com a API.";
      }
    });
  }

  // Filtrar Notas
  document.getElementById("btn-filter")?.addEventListener("click", loadNotes);
});

async function loadNotes() {
  const recordsList = document.getElementById("recordsList");
  if (!recordsList) return;

  const search = document.getElementById("search-input")?.value.trim() || "";
  const tag = document.getElementById("tag-filter-input")?.value.trim() || "";

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (tag) params.append("tag", tag);

    const res = await fetch(`/api/notes?${params.toString()}`);
    if (!res.ok) {
      recordsList.innerHTML = `<li style="color: #dc2626;">Erro ao carregar notas salvas.</li>`;
      return;
    }

    const data = await res.json();
    const notes = data.notes || [];

    if (notes.length === 0) {
      recordsList.innerHTML = `<li style="color: #64748b;">Nenhuma nota gravada ainda.</li>`;
      return;
    }

    recordsList.innerHTML = notes.map(note => `
      <li style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px dashed #cbd5e1;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${escapeHtml(note.title)}</strong>
          <button onclick="deleteNote('${note.id}')" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:0.2rem 0.5rem; cursor:pointer; font-size:0.75rem;">Excluir</button>
        </div>
        <div style="margin: 0.4rem 0;">${parseMarkdown(note.content)}</div>
        <div>
          ${(note.tags || []).map(t => `<span style="background:#e2e8f0; color:#475569; font-size:0.75rem; padding:0.1rem 0.4rem; border-radius:12px; margin-right:0.25rem;">#${escapeHtml(t)}</span>`).join("")}
        </div>
      </li>
    `).join("");

  } catch (err) {
    recordsList.innerHTML = `<li style="color: #dc2626;">Erro de rede ao buscar notas.</li>`;
  }
}

window.deleteNote = async (id) => {
  if (!confirm("Deseja excluir esta nota do D1?")) return;
  try {
    const res = await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    if (res.ok) loadNotes();
  } catch (err) {
    alert("Erro ao excluir nota.");
  }
};

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}