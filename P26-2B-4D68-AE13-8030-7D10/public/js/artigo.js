import { api } from "./api.js";
import { avatarImage, element } from "./dom.js";
import { formatDate } from "./text.js";

const list = document.getElementById("commentsList");
const form = document.querySelector(".comment-form");

function commentItem(comment) {
  const heading = element("div", {}, [
    element("span", { className: "comment-author", text: comment.username }),
    element("time", {
      className: "comment-date",
      text: formatDate(comment.created_at),
      attrs: { datetime: comment.created_at || "" },
    }),
  ]);

  // O servidor decide: as mesmas regras do DELETE vêm em can_delete/can_report.
  const actions = element("div", { className: "comment-actions" });
  if (comment.can_delete) {
    actions.append(element("button", {
      className: "action-button action-danger",
      text: "Excluir comentário",
      attrs: {
        type: "button",
        "data-delete-comment": String(comment.id),
        "aria-label": `Excluir comentário de ${comment.username}`,
      },
    }));
  }
  if (comment.can_report) {
    actions.append(element("button", {
      className: "action-button",
      text: "Denunciar",
      attrs: {
        type: "button",
        "data-report-comment": String(comment.id),
        "aria-label": `Denunciar comentário de ${comment.username}`,
      },
    }));
  }

  const body = element("div", {}, [
    heading,
    element("p", { className: "comment-body", text: comment.body }),
  ]);
  if (actions.childElementCount) body.append(actions);

  return element("div", { className: "comment-item", attrs: { "data-comment": comment.id } }, [
    avatarImage(comment.avatar),
    body,
  ]);
}

async function renderComments(articleId) {
  const { comments } = await api(`/api/articles/${articleId}/comments`);
  list.replaceChildren();
  if (!comments.length) {
    list.append(element("p", { className: "muted", text: "Ainda não há comentários. Comece a conversa." }));
    return;
  }
  for (const comment of comments) list.append(commentItem(comment));
}

if (form && list) {
  const input = form.querySelector("input");
  const submit = form.querySelector("button");
  const { articleId } = form.dataset;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await api(`/api/articles/${articleId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: input.value }),
      });
      input.value = "";
      await renderComments(articleId);
    } catch (error) {
      window.alert(error.message);
    } finally {
      submit.disabled = false;
    }
  });
}

// Moderação: o servidor já decidiu quem pode excluir/denunciar; aqui só executamos.
document.addEventListener("click", async (event) => {
  const removeArticle = event.target.closest("[data-delete-article]");
  if (removeArticle) {
    const id = removeArticle.dataset.deleteArticle;
    if (!window.confirm("Excluir este artigo? Os comentários e as curtidas dele também serão apagados.")) return;
    removeArticle.disabled = true;
    try {
      await api(`/api/articles/${id}`, { method: "DELETE" });
      location.href = "/";
    } catch (error) {
      removeArticle.disabled = false;
      window.alert(error.message);
    }
    return;
  }

  const removeButton = event.target.closest("[data-delete-comment]");
  if (removeButton) {
    const id = removeButton.dataset.deleteComment;
    if (!window.confirm("Excluir este comentário?")) return;
    removeButton.disabled = true;
    try {
      await api(`/api/comments/${id}`, { method: "DELETE" });
      document.querySelector(`[data-comment="${id}"]`)?.remove();
      if (!document.querySelector("#commentsList .comment-item")) {
        document.getElementById("commentsList")?.replaceChildren(
          element("p", { className: "muted", text: "Ainda não há comentários. Comece a conversa." }),
        );
      }
    } catch (error) {
      removeButton.disabled = false;
      window.alert(error.message);
    }
    return;
  }

  const reportButton = event.target.closest("[data-report-comment]");
  if (reportButton) {
    const id = reportButton.dataset.reportComment;
    const reason = window.prompt("Por que este comentário deveria ser revisto? (opcional)") ?? null;
    if (reason === null) return;
    reportButton.disabled = true;
    try {
      await api(`/api/comments/${id}/report`, { method: "POST", body: JSON.stringify({ reason }) });
      reportButton.textContent = "Denúncia enviada";
    } catch (error) {
      reportButton.disabled = false;
      window.alert(error.message);
    }
  }
});
