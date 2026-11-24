"use strict";

const byId = (id) => document.getElementById(id);
const form = byId("reference-form");
const source = byId("source");
const style = byId("style");
const formStatus = byId("form-status");
const result = byId("result");
const copy = byId("copy");
const copyStatus = byId("copy-status");
const saveReference = byId("save-reference");
const cancelReferenceEdit = byId("cancel-reference-edit");
const formTitle = byId("source-title");

const sessionStatus = byId("session-status");
const authStatus = byId("auth-status");
const workspace = byId("workspace");
const loginLink = byId("login-discord");
const sessionProfile = byId("session-profile");
const profileName = byId("profile-name");
const avatar = byId("profile-avatar");
const avatarFallback = byId("profile-avatar-fallback");
const logoutButton = byId("logout-discord");
const projectManager = byId("project-manager");
const projectForm = byId("project-form");
const projectSelect = byId("project-select");
const projectName = byId("project-name");
const projectStyle = byId("project-style");
const projectStatus = byId("project-status");
const reloadProjects = byId("reload-projects");
const projectCollection = byId("project-collection");
const referenceList = byId("reference-list");
const referenceStatus = byId("reference-status");
const bibliographyList = byId("bibliography-list");
const bibliographySummary = byId("bibliography-summary");
const bibliographyStatus = byId("bibliography-status");
const compileBibliography = byId("compile-bibliography");
const copyBibliography = byId("copy-bibliography");

const labels = { book: "Livro", article: "Artigo de periódico", website: "Página da web" };
let preview = "";
let previewRevision = 0;
let draftRevision = 0;
let user = null;
let projects = [];
let activeProject = null;
let projectEditId = null;
let referenceEditId = null;
let collection = null;
let loadController = null;
let busy = false;
let formatterReady = false;

function showError(input, message) {
  byId(input.id + "-error").textContent = message;
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
}

function clearReferenceErrors() {
  for (const input of form.querySelectorAll("input")) showError(input, "");
  formStatus.textContent = "";
}

function resetPreview() {
  if (!preview) return;
  preview = "";
  previewRevision += 1;
  result.textContent = "Gere uma nova prévia com os dados atualizados.";
  copy.disabled = true;
  copyStatus.textContent = "";
}

function updateFields() {
  for (const group of form.querySelectorAll("[data-source]")) {
    const active = group.dataset.source === source.value;
    group.hidden = !active;
    group.disabled = !active;
    if (!active) {
      for (const input of group.querySelectorAll("input")) showError(input, "");
    }
  }
}

function citation(parts) {
  const fragment = document.createDocumentFragment();
  for (const { text, italic } of parts) {
    if (italic) {
      const title = document.createElement("cite");
      title.textContent = text;
      fragment.append(title);
    } else {
      fragment.append(document.createTextNode(text));
    }
  }
  return fragment;
}

function renderPreview(parts) {
  result.replaceChildren(citation(parts));
  preview = parts.map(({ text }) => text).join("");
  previewRevision += 1;
  copy.disabled = false;
  copyStatus.textContent = "";
}

function resetReferenceEditor() {
  if (referenceEditId) {
    form.reset();
    updateFields();
    clearReferenceErrors();
    resetPreview();
  }
  referenceEditId = null;
  formTitle.textContent = "Dados da fonte";
  saveReference.textContent = "Salvar referência";
  cancelReferenceEdit.hidden = true;
  if (activeProject) style.value = activeProject.style;
}

function editReference(reference) {
  referenceEditId = reference.id;
  formTitle.textContent = "Editar referência";
  saveReference.textContent = "Salvar alterações";
  cancelReferenceEdit.hidden = false;
  source.value = reference.sourceType;
  style.value = activeProject.style;
  updateFields();
  for (const input of form.querySelectorAll("input")) {
    input.value = input.matches(":enabled") ? reference.fields[input.name] ?? "" : "";
  }
  clearReferenceErrors();
  resetPreview();
  source.focus();
}

function projectPath(id = activeProject?.id) {
  return "/api/projects/" + encodeURIComponent(id);
}

async function request(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(path, {
    method,
    signal,
    credentials: "same-origin",
    headers: body === undefined ? { Accept: "application/json" } : {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).catch(error => {
    if (error.name === "AbortError") throw error;
    throw new Error("Não foi possível conectar à API de projetos.");
  });
  if (response.status === 401) {
    hideProjects("Sua sessão terminou. Entre novamente para continuar.");
  }
  if (response.status === 204) return null;
  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("A API de projetos está indisponível.");
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Não foi possível concluir a operação.");
    error.status = response.status;
    error.fields = data.error?.fields;
    throw error;
  }
  return data;
}

function updateControls() {
  const available = Boolean(user && activeProject);
  const collectionReady = available && Boolean(collection) && !loadController;
  projectSelect.disabled = busy;
  logoutButton.disabled = busy;
  byId("new-project").disabled = busy;
  byId("edit-project").disabled = busy || !available;
  byId("delete-project").disabled = busy || !available;
  projectName.readOnly = busy;
  projectStyle.disabled = busy;
  byId("save-project").disabled = busy;
  byId("cancel-project").disabled = busy;
  reloadProjects.disabled = busy;
  saveReference.hidden = !available;
  saveReference.disabled = busy || !collectionReady || !formatterReady;
  cancelReferenceEdit.disabled = busy;
  for (const control of referenceList.querySelectorAll("button")) control.disabled = busy || !collectionReady;
  compileBibliography.disabled = busy || !available || Boolean(loadController);
  copyBibliography.disabled = busy || !collectionReady || !collection.bibliography.text;
}

function clearCollection() {
  collection = null;
  referenceStatus.textContent = "";
  bibliographyStatus.textContent = "";
  bibliographySummary.textContent = "";
  referenceList.replaceChildren();
  bibliographyList.replaceChildren();
}

function closeProjectEditor() {
  projectEditId = null;
  projectForm.hidden = true;
  showError(projectName, "");
}

function hideProjects(message, canLogin = true) {
  loadController?.abort();
  loadController = null;
  resetReferenceEditor();
  activeProject = null;
  projects = [];
  user = null;
  form.reset();
  updateFields();
  clearReferenceErrors();
  resetPreview();
  result.textContent = "Sua referência aparecerá aqui.";
  workspace.hidden = true;
  sessionProfile.hidden = true;
  profileName.textContent = "";
  avatar.removeAttribute("src");
  avatar.hidden = true;
  avatarFallback.textContent = "";
  avatarFallback.hidden = true;
  loginLink.hidden = !canLogin;
  clearCollection();
  closeProjectEditor();
  projectForm.reset();
  projectStatus.textContent = "";
  projectSelect.replaceChildren();
  projectManager.hidden = true;
  projectCollection.hidden = true;
  sessionStatus.textContent = message;
  updateControls();
}

function openProjectEditor(project = null) {
  projectEditId = project?.id ?? null;
  projectName.value = project?.name ?? "";
  projectStyle.value = project?.style ?? "abnt";
  byId("save-project").textContent = project ? "Salvar alterações" : "Criar projeto";
  showError(projectName, "");
  projectStatus.textContent = "";
  projectForm.hidden = false;
  projectName.focus();
}

function renderProjectOptions(id) {
  const prompt = new Option(projects.length ? "Selecione um projeto" : "Nenhum projeto disponível", "");
  projectSelect.replaceChildren(prompt, ...projects.map(project => new Option(project.name, project.id)));
  projectSelect.value = id ?? "";
}

function referenceButton(action, label, reference) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.dataset.referenceId = reference.id;
  button.textContent = label;
  button.setAttribute("aria-label", label + " " + reference.fields.title);
  if (action === "delete-reference") button.className = "danger";
  return button;
}

function renderCollection() {
  const { references, bibliography } = collection;
  const referenceItems = references.map(reference => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = reference.fields.title;
    const kind = document.createElement("p");
    kind.className = "hint";
    kind.textContent = labels[reference.sourceType];
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.append(referenceButton("edit-reference", "Editar", reference),
      referenceButton("delete-reference", "Excluir", reference));
    item.append(name, kind, actions);
    return item;
  });
  referenceList.replaceChildren(...referenceItems);
  referenceStatus.textContent = references.length ? "" : "Nenhuma referência salva neste projeto.";
  bibliographyList.replaceChildren(...bibliography.entries.map(entry => {
    const item = document.createElement("li");
    item.append(citation(entry.parts));
    return item;
  }));
  bibliographySummary.textContent = bibliography.entries.length
    ? bibliography.style.toUpperCase() + " · ordem alfabética · cópia como texto simples"
    : "Salve uma referência para compilar a bibliografia.";
}

async function loadCollection() {
  loadController?.abort();
  clearCollection();
  projectCollection.hidden = !activeProject;
  if (!activeProject) {
    loadController = null;
    updateControls();
    return;
  }
  const controller = new AbortController();
  loadController = controller;
  const path = projectPath();
  referenceStatus.textContent = "Carregando referências…";
  bibliographySummary.textContent = "Compilando bibliografia…";
  updateControls();
  try {
    const [data, bibliography] = await Promise.all([
      request(path + "/references", { signal: controller.signal }),
      request(path + "/bibliography", { signal: controller.signal })
    ]);
    if (loadController !== controller) return;
    if (style.value === activeProject.style && style.value !== bibliography.style) {
      style.value = bibliography.style;
      resetPreview();
    }
    activeProject.style = bibliography.style;
    collection = { references: data.references, bibliography };
    renderCollection();
    return true;
  } catch (error) {
    if (loadController !== controller) return;
    referenceStatus.textContent = error.message;
    bibliographySummary.textContent = "Bibliografia indisponível.";
    reloadProjects.hidden = false;
  } finally {
    if (loadController === controller) {
      loadController = null;
      updateControls();
    }
  }
}

function selectProject(id) {
  resetReferenceEditor();
  closeProjectEditor();
  activeProject = projects.find(project => project.id === id) ?? null;
  if (activeProject && style.value !== activeProject.style) {
    style.value = activeProject.style;
    resetPreview();
  }
  return loadCollection();
}

async function loadProjects({ preferFirst = false } = {}) {
  reloadProjects.hidden = true;
  projectStatus.textContent = "Carregando projetos…";
  try {
    const data = await request("/api/projects");
    projects = data.projects;
    const id = projects.some(project => project.id === activeProject?.id)
      ? activeProject.id
      : preferFirst ? projects[0]?.id : "";
    renderProjectOptions(id);
    projectStatus.textContent = projects.length ? "" : "Crie um projeto para salvar suas referências.";
    await selectProject(id);
  } catch (error) {
    if (!user) return;
    projectStatus.textContent = error.message;
    reloadProjects.hidden = false;
  }
}

async function mutate(status, operation) {
  if (busy || !user) return;
  busy = true;
  status.textContent = "";
  updateControls();
  let focusTarget;
  try {
    focusTarget = await operation();
  } catch (error) {
    if (!user) return;
    status.textContent = error.message;
    if (error.status === 404 || error.status === 409) reloadProjects.hidden = false;
    if (error.fields?.name && status === projectStatus) {
      showError(projectName, error.fields.name);
      focusTarget = projectName;
    }
    if (error.fields && status === formStatus) {
      const invalid = [...form.querySelectorAll("input:enabled")].filter(input => error.fields[input.name]);
      for (const input of invalid) showError(input, error.fields[input.name]);
      focusTarget = invalid[0];
    }
  } finally {
    busy = false;
    updateControls();
    focusTarget?.focus();
  }
}

projectSelect.addEventListener("change", () => {
  projectStatus.textContent = "";
  selectProject(projectSelect.value);
});
byId("new-project").addEventListener("click", () => openProjectEditor());
byId("edit-project").addEventListener("click", () => openProjectEditor(activeProject));
byId("cancel-project").addEventListener("click", () => {
  closeProjectEditor();
  byId(activeProject ? "edit-project" : "new-project").focus();
});
projectName.addEventListener("input", () => showError(projectName, ""));
reloadProjects.addEventListener("click", () => mutate(projectStatus, loadProjects));

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = projectEditId;
  const body = { name: projectName.value, style: projectStyle.value };
  mutate(projectStatus, async () => {
    const { project } = await request(id ? projectPath(id) : "/api/projects", {
      method: id ? "PATCH" : "POST", body
    });
    projects = id ? projects.map(item => item.id === id ? project : item) : [project, ...projects];
    renderProjectOptions(project.id);
    projectStatus.textContent = id ? "Projeto atualizado." : "Projeto criado.";
    await selectProject(project.id);
    return projectSelect;
  });
});

byId("delete-project").addEventListener("click", () => {
  const project = activeProject;
  if (!project || !window.confirm("Excluir este projeto e todas as suas referências?")) return;
  mutate(projectStatus, async () => {
    await request(projectPath(project.id), { method: "DELETE" });
    projects = projects.filter(item => item.id !== project.id);
    const id = projects[0]?.id;
    renderProjectOptions(id);
    projectStatus.textContent = "Projeto excluído.";
    await selectProject(id);
    return projectSelect;
  });
});

referenceList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !collection || busy) return;
  const reference = collection.references.find(item => item.id === button.dataset.referenceId);
  if (!reference) return;
  if (button.dataset.action === "edit-reference") {
    editReference(reference);
    return;
  }
  if (!window.confirm("Excluir esta referência do projeto?")) return;
  const path = projectPath() + "/references/" + encodeURIComponent(reference.id);
  mutate(formStatus, async () => {
    await request(path, { method: "DELETE" });
    if (referenceEditId === reference.id) resetReferenceEditor();
    await loadCollection();
    formStatus.textContent = "Referência excluída.";
    source.focus();
  });
});

cancelReferenceEdit.addEventListener("click", () => {
  resetReferenceEditor();
  source.focus();
});

compileBibliography.addEventListener("click", async () => {
  if (await loadCollection()) {
    bibliographyStatus.textContent = collection.bibliography.entries.length
      ? "Bibliografia compilada."
      : "O projeto ainda não tem referências para compilar.";
  }
});

copyBibliography.addEventListener("click", async () => {
  const snapshot = collection;
  if (!snapshot?.bibliography.text) return;
  try {
    await navigator.clipboard.writeText(snapshot.bibliography.text);
    if (collection === snapshot) bibliographyStatus.textContent = "Bibliografia copiada como texto simples.";
  } catch {
    if (collection === snapshot) bibliographyStatus.textContent = "Selecione a bibliografia para copiar manualmente.";
  }
});

source.addEventListener("change", updateFields);
form.addEventListener("input", (event) => {
  draftRevision += 1;
  if (event.target instanceof HTMLInputElement) showError(event.target, "");
  formStatus.textContent = "";
  resetPreview();
});
form.addEventListener("change", () => {
  draftRevision += 1;
  resetPreview();
});

copy.addEventListener("click", async () => {
  const revision = previewRevision;
  try {
    await navigator.clipboard.writeText(preview);
    if (revision === previewRevision) copyStatus.textContent = "Referência copiada como texto simples.";
  } catch {
    if (revision === previewRevision) copyStatus.textContent = "Selecione o texto da prévia para copiar manualmente.";
  }
});

function showAvatar(account, displayName) {
  avatarFallback.textContent = Array.from(displayName)[0]?.toLocaleUpperCase("pt-BR") ?? "?";
  avatar.hidden = true;
  avatarFallback.hidden = false;
  if (!account.avatarUrl) return;
  try {
    const url = new URL(account.avatarUrl);
    if (url.protocol === "https:" && url.hostname === "cdn.discordapp.com") {
      avatar.src = url.href;
    }
  } catch {
    // The fallback remains visible for missing or invalid avatar URLs.
  }
}

function showAuthNotice() {
  const url = new URL(location.href);
  const auth = url.searchParams.get("auth");
  if (auth === null) return;
  const messages = new Map([
    ["cancelled", "Login com Discord cancelado."],
    ["invalid", "A solicitação de login expirou ou é inválida. Inicie o login novamente."],
    ["failed", "Não foi possível concluir o login com Discord. Tente novamente."],
    ["unavailable", "O login com Discord está temporariamente indisponível."]
  ]);
  const message = messages.get(auth);
  if (message) {
    authStatus.textContent = message;
    authStatus.hidden = false;
  }
  url.searchParams.delete("auth");
  history.replaceState(history.state, "", url);
}

avatar.addEventListener("load", () => {
  if (!user || !avatar.getAttribute("src")) return;
  avatarFallback.hidden = true;
  avatar.hidden = false;
});

avatar.addEventListener("error", () => {
  if (!user) return;
  avatar.hidden = true;
  avatarFallback.hidden = false;
});

logoutButton.addEventListener("click", () => {
  mutate(sessionStatus, async () => {
    await request("/api/auth/logout", { method: "POST" });
    authStatus.hidden = true;
    authStatus.textContent = "";
    hideProjects("Você saiu da sua conta.");
    return loginLink;
  });
});

async function startSession() {
  if (location.protocol === "file:") {
    hideProjects("Abra a página por um servidor HTTP local para consultar a sessão.", false);
    return;
  }
  showAuthNotice();
  try {
    const session = await request("/api/session");
    user = session.user;
    if (!user) {
      hideProjects("Entre com Discord para gerar referências e acessar seus projetos.");
      return;
    }
    const displayName = user.displayName?.trim() || "Conta Discord";
    profileName.textContent = displayName;
    showAvatar(user, displayName);
    sessionStatus.textContent = "Sessão ativa de " + displayName + ".";
    sessionProfile.hidden = false;
    loginLink.hidden = true;
    workspace.hidden = false;
    projectManager.hidden = false;
    await mutate(projectStatus, () => loadProjects({ preferFirst: true }));
  } catch {
    hideProjects("Não foi possível consultar a sessão. Confira se a API está em execução e recarregue a página.");
  }
}

updateFields();

import("./references.mjs").then(({ validateReference, formatReference }) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const saving = event.submitter === saveReference;
    if (saving && (busy || !user || !activeProject || !collection)) return;
    const fields = {};
    const inputs = form.querySelectorAll("input:enabled");
    for (const input of inputs) fields[input.name] = input.value;
    const reference = { sourceType: source.value, style: saving ? activeProject.style : style.value, fields };
    const { ok, value, errors } = validateReference(reference);
    let firstError;
    for (const input of inputs) {
      const message = input.validity.badInput ? "Informe um valor válido." : errors?.[input.name] || "";
      showError(input, message);
      if (message && !firstError) firstError = input;
    }
    if (firstError || !ok) {
      formStatus.textContent = "Revise os campos indicados.";
      firstError?.focus();
      return;
    }
    if (!saving) {
      renderPreview(formatReference(value));
      formStatus.textContent = "";
      return;
    }
    const id = referenceEditId;
    const path = projectPath() + "/references" + (id ? "/" + encodeURIComponent(id) : "");
    const body = { sourceType: value.sourceType, fields };
    const revision = draftRevision;
    mutate(formStatus, async () => {
      await request(path, { method: id ? "PATCH" : "POST", body });
      if (draftRevision === revision) {
        if (!referenceEditId) {
          form.reset();
          updateFields();
          resetPreview();
        }
        resetReferenceEditor();
      }
      await loadCollection();
      formStatus.textContent = id ? "Referência atualizada." : "Referência salva.";
      if (draftRevision === revision) return source;
    });
  });
  formatterReady = true;
  byId("generate-preview").disabled = false;
  updateControls();
}).catch(() => {
  formStatus.textContent = location.protocol === "file:"
    ? "Abra a página por um servidor HTTP local para carregar o formatador."
    : "O formatador não pôde ser carregado. Recarregue a página para tentar novamente.";
});

startSession();
