"use strict";

const state = {
  user: null,
  recipes: [],
  favorites: [],
  activeView: "catalog",
  selectedRecipeId: null,
  desiredServings: new Map(),
  search: { q: "", ingredient: "", maxTime: "" },
};

const elements = {
  notice: document.getElementById("notice"),
  profile: document.getElementById("profile"),
  profileName: document.getElementById("profileName"),
  profileAvatar: document.getElementById("profileAvatar"),
  loginLink: document.getElementById("discordLoginLink"),
  introLoginLink: document.getElementById("introLoginLink"),
  catalogView: document.getElementById("catalogView"),
  favoritesView: document.getElementById("favoritesView"),
  createView: document.getElementById("createView"),
  recipeGrid: document.getElementById("recipeGrid"),
  favoritesGrid: document.getElementById("favoritesGrid"),
  detailPanel: document.getElementById("detailPanel"),
  resultCount: document.getElementById("resultCount"),
  searchForm: document.getElementById("searchForm"),
  recipeForm: document.getElementById("recipeForm"),
  createLoginPrompt: document.getElementById("createLoginPrompt"),
  ingredientBuilder: document.getElementById("ingredientBuilder"),
  stepBuilder: document.getElementById("stepBuilder"),
};

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setNotice(message, type = "info") {
  elements.notice.textContent = message;
  elements.notice.className = `notice notice-${type}`;
  elements.notice.hidden = !message;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new Error(data.error || data.message || `A solicitação falhou (${response.status}).`);
  }
  return data;
}

function normalizeRecipe(recipe) {
  const originalServings = Number(recipe.servings);
  return {
    ...recipe,
    servings: originalServings,
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).map((ingredient) => ({
      ...ingredient,
      quantityOriginal: Number(ingredient.quantity),
    })),
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    isFavorite: Boolean(recipe.isFavorite),
  };
}

function recipeImagePath(imageUrl) {
  return typeof imageUrl === "string" && /^\/images\/recipes\/[a-z0-9-]+\.svg$/.test(imageUrl)
    ? imageUrl
    : "/images/recipes/placeholder.svg";
}

function updateAccount() {
  const loggedIn = Boolean(state.user);
  elements.profile.hidden = !loggedIn;
  elements.loginLink.hidden = loggedIn;
  elements.introLoginLink.hidden = loggedIn;
  elements.createLoginPrompt.hidden = loggedIn;
  elements.recipeForm.hidden = !loggedIn;
  if (!loggedIn) return;

  elements.profileName.textContent = state.user.username || "Cozinheiro(a)";
  const avatar = state.user.avatar;
  if (avatar) {
    elements.profileAvatar.src = avatar;
    elements.profileAvatar.alt = `Avatar de ${state.user.username || "usuário"}`;
    elements.profileAvatar.hidden = false;
  } else {
    elements.profileAvatar.removeAttribute("src");
    elements.profileAvatar.hidden = true;
  }
}

function emptyState(title, message, needsLogin = false) {
  const wrapper = makeElement("div", "empty-state");
  wrapper.append(makeElement("span", "empty-mark", needsLogin ? "♡" : "✳"));
  wrapper.append(makeElement("h3", "", title));
  wrapper.append(makeElement("p", "", message));
  if (needsLogin) {
    const link = makeElement("a", "button button-discord", "Entrar com Discord");
    link.href = "/api/auth/discord";
    wrapper.append(link);
  }
  return wrapper;
}

function recipeCard(recipe) {
  const article = makeElement("article", "recipe-card");
  const image = makeElement("div", "recipe-art");
  image.setAttribute("aria-hidden", "true");
  const cover = makeElement("img", "recipe-cover");
  cover.src = recipeImagePath(recipe.imageUrl);
  cover.alt = `Ilustração de ${recipe.title || "receita"}`;
  cover.loading = "lazy";
  cover.decoding = "async";
  cover.addEventListener("error", () => {
    cover.src = "/images/recipes/placeholder.svg";
  }, { once: true });
  image.append(cover);

  const favoriteButton = makeElement("button", `favorite-toggle${recipe.isFavorite ? " is-favorite" : ""}`, recipe.isFavorite ? "♥" : "♡");
  favoriteButton.type = "button";
  favoriteButton.setAttribute("aria-label", recipe.isFavorite ? `Remover ${recipe.title} dos favoritos` : `Adicionar ${recipe.title} aos favoritos`);
  favoriteButton.setAttribute("aria-pressed", String(recipe.isFavorite));
  favoriteButton.addEventListener("click", () => toggleFavorite(recipe));
  image.append(favoriteButton);
  article.append(image);

  const body = makeElement("div", "recipe-card-body");
  const meta = makeElement("div", "recipe-meta");
  meta.append(makeElement("span", "", `${recipe.prepTime || "—"} min`));
  meta.append(makeElement("span", "meta-dot", "·"));
  meta.append(makeElement("span", "", `${recipe.servings || "—"} porções`));
  body.append(meta);

  const title = makeElement("h3", "recipe-title", recipe.title || "Receita sem nome");
  body.append(title);
  body.append(makeElement("p", "recipe-description", recipe.description || "Uma receita especial para compartilhar."));
  if (recipe.author) {
    const author = makeElement("div", "recipe-author");
    if (recipe.author.avatar) {
      const avatar = makeElement("img", "mini-avatar");
      avatar.src = recipe.author.avatar;
      avatar.alt = "";
      avatar.loading = "lazy";
      author.append(avatar);
    } else {
      author.append(makeElement("span", "mini-avatar avatar-placeholder", (recipe.author.username || "?").slice(0, 1)));
    }
    author.append(makeElement("span", "", recipe.author.username || "Comunidade Panela"));
    body.append(author);
  }

  const details = makeElement("button", "text-button", "Ver receita");
  details.type = "button";
  details.addEventListener("click", () => showRecipe(recipe));
  body.append(details);
  article.append(body);
  return article;
}

function renderRecipeGrid(target, recipes, options = {}) {
  target.replaceChildren();
  if (options.busy !== undefined) target.setAttribute("aria-busy", String(options.busy));
  if (recipes.length === 0) {
    target.append(emptyState(options.title || "Ainda não há receitas por aqui", options.message || "Tente outra busca ou volte mais tarde."));
    return;
  }
  recipes.forEach((recipe) => target.append(recipeCard(recipe)));
}

function filteredRecipes(recipes) {
  if (!state.search.q && !state.search.ingredient && !state.search.maxTime) return recipes;
  const query = state.search.q.toLocaleLowerCase("pt-BR");
  const ingredient = state.search.ingredient.toLocaleLowerCase("pt-BR");
  const maxTime = Number(state.search.maxTime);
  return recipes.filter((recipe) => {
    const matchesTitle = !query || (recipe.title || "").toLocaleLowerCase("pt-BR").includes(query);
    const matchesIngredient = !ingredient || recipe.ingredients.some((item) =>
      (item.name || "").toLocaleLowerCase("pt-BR").includes(ingredient));
    const matchesTime = !maxTime || Number(recipe.prepTime) <= maxTime;
    return matchesTitle && matchesIngredient && matchesTime;
  });
}

async function loadRecipes() {
  elements.recipeGrid.setAttribute("aria-busy", "true");
  const params = new URLSearchParams();
  if (state.search.q) params.set("q", state.search.q);
  if (state.search.ingredient) params.set("ingredient", state.search.ingredient);
  if (state.search.maxTime) params.set("maxTime", state.search.maxTime);
  const queryString = params.toString();
  try {
    const data = await requestJson(`/api/recipes${queryString ? `?${queryString}` : ""}`);
    state.recipes = (Array.isArray(data.recipes) ? data.recipes : []).map(normalizeRecipe);
    renderCatalog();
    setNotice("");
  } catch (error) {
    state.recipes = [];
    renderCatalog();
    setNotice(`Não foi possível carregar as receitas. ${error.message}`, "error");
  } finally {
    elements.recipeGrid.setAttribute("aria-busy", "false");
  }
}

function renderCatalog() {
  const recipes = filteredRecipes(state.recipes);
  elements.resultCount.textContent = `${recipes.length} ${recipes.length === 1 ? "receita" : "receitas"}`;
  if (recipes.length === 0) {
    renderRecipeGrid(elements.recipeGrid, [], {
      title: state.recipes.length ? "Nenhum resultado encontrado" : "A mesa está sendo preparada",
      message: state.recipes.length ? "Experimente mudar os filtros da busca." : "Entre para descobrir receitas da comunidade ou volte em instantes.",
      busy: false,
    });
  } else {
    renderRecipeGrid(elements.recipeGrid, recipes, { busy: false });
  }
}

function showRecipe(recipe) {
  state.selectedRecipeId = recipe.id;
  const servings = state.desiredServings.get(recipe.id) || recipe.servings || 1;
  renderRecipeDetail(recipe, servings);
  elements.detailPanel.hidden = false;
  elements.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRecipeDetail(recipe, desiredServings) {
  const panel = elements.detailPanel;
  panel.replaceChildren();
  const heading = makeElement("div", "detail-heading");
  const top = makeElement("div", "detail-title-row");
  top.append(makeElement("p", "eyebrow", "A receita completa"));
  const closeButton = makeElement("button", "close-detail", "Fechar ×");
  closeButton.type = "button";
  closeButton.addEventListener("click", () => {
    panel.hidden = true;
    state.selectedRecipeId = null;
  });
  top.append(closeButton);
  heading.append(top);
  heading.append(makeElement("h2", "", recipe.title || "Receita sem nome"));
  const cover = makeElement("img", "detail-cover");
  cover.src = recipeImagePath(recipe.imageUrl);
  cover.alt = `Ilustração de ${recipe.title || "receita"}`;
  cover.addEventListener("error", () => {
    cover.src = "/images/recipes/placeholder.svg";
  }, { once: true });
  heading.append(cover);
  if (recipe.description) heading.append(makeElement("p", "detail-description", recipe.description));
  const byline = makeElement("p", "detail-byline", `${recipe.prepTime || "—"} minutos · ${recipe.author?.username || "Comunidade Panela"}`);
  heading.append(byline);
  panel.append(heading);

  const content = makeElement("div", "detail-content");
  const ingredientSection = makeElement("section", "detail-ingredients");
  const ingredientHeading = makeElement("div", "detail-section-heading");
  ingredientHeading.append(makeElement("h3", "", "Ingredientes"));
  const servingsLabel = makeElement("label", "servings-control");
  servingsLabel.append(makeElement("span", "", "Porções"));
  const servingsInput = makeElement("input", "");
  servingsInput.type = "number";
  servingsInput.min = "1";
  servingsInput.step = "1";
  servingsInput.inputMode = "numeric";
  servingsInput.value = String(desiredServings);
  servingsInput.setAttribute("aria-label", "Porções desejadas");
  servingsLabel.append(servingsInput);
  ingredientHeading.append(servingsLabel);
  ingredientSection.append(ingredientHeading);

  const ingredientList = makeElement("ul", "detail-ingredient-list");
  const quantityNodes = [];
  recipe.ingredients.forEach((ingredient) => {
    const item = makeElement("li", "detail-ingredient");
    const quantity = makeElement("span", "ingredient-quantity");
    const name = makeElement("span", "ingredient-name", ingredient.name || "Ingrediente");
    item.append(quantity, name);
    ingredientList.append(item);
    quantityNodes.push({ node: quantity, ingredient });
  });
  if (!recipe.ingredients.length) ingredientList.append(makeElement("li", "muted", "Ingredientes não informados."));
  ingredientSection.append(ingredientList);

  const updateQuantities = () => {
    const entered = Number(servingsInput.value);
    const requested = servingsInput.value === "" ? 1 : Math.max(1, entered || 1);
    if (servingsInput.value !== "" && requested !== entered) servingsInput.value = String(requested);
    state.desiredServings.set(recipe.id, requested);
    quantityNodes.forEach(({ node, ingredient }) => {
      const original = ingredient.quantityOriginal;
      const base = Number(recipe.servings);
      const scaled = Number.isFinite(original) && Number.isFinite(base) && base > 0
        ? original * requested / base
        : ingredient.quantity;
      const number = Number(scaled);
      node.textContent = Number.isFinite(number)
        ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(number)}${ingredient.unit ? ` ${ingredient.unit}` : ""}`
        : `${ingredient.quantity ?? ""}${ingredient.unit ? ` ${ingredient.unit}` : ""}`;
    });
  };
  servingsInput.addEventListener("input", updateQuantities);
  updateQuantities();

  const stepsSection = makeElement("section", "detail-steps");
  stepsSection.append(makeElement("h3", "", "Modo de preparo"));
  const steps = makeElement("ol", "detail-step-list");
  recipe.steps.forEach((step) => steps.append(makeElement("li", "", step)));
  if (!recipe.steps.length) steps.append(makeElement("li", "", "Modo de preparo não informado."));
  stepsSection.append(steps);
  content.append(ingredientSection, stepsSection);
  panel.append(content);

  const detailActions = makeElement("div", "detail-actions");
  const favorite = makeElement("button", `button ${recipe.isFavorite ? "button-favorited" : "button-outline"}`, recipe.isFavorite ? "♥ Salvo no meu livro" : "♡ Salvar no meu livro");
  favorite.type = "button";
  favorite.addEventListener("click", () => toggleFavorite(recipe));
  detailActions.append(favorite);
  panel.append(detailActions);
}

async function toggleFavorite(recipe) {
  if (!state.user) {
    setNotice("Entre com o Discord para guardar receitas no seu livro.", "error");
    return;
  }
  const wasFavorite = recipe.isFavorite;
  const method = wasFavorite ? "DELETE" : "POST";
  try {
    await requestJson(`/api/favorites/${encodeURIComponent(recipe.id)}`, { method });
    recipe.isFavorite = !wasFavorite;
    state.recipes.forEach((item) => {
      if (item.id === recipe.id) item.isFavorite = recipe.isFavorite;
    });
    if (recipe.isFavorite) {
      const favoriteRecipe = state.recipes.find((item) => item.id === recipe.id) || recipe;
      if (!state.favorites.some((item) => item.id === recipe.id)) state.favorites.push(favoriteRecipe);
    } else {
      state.favorites = state.favorites.filter((item) => item.id !== recipe.id);
    }
    renderCatalog();
    renderFavorites();
    if (state.selectedRecipeId === recipe.id) {
      const selected = state.recipes.find((item) => item.id === recipe.id) || recipe;
      renderRecipeDetail(selected, state.desiredServings.get(recipe.id) || selected.servings || 1);
    }
    setNotice(recipe.isFavorite ? "Receita adicionada ao seu livro." : "Receita removida do seu livro.", "success");
  } catch (error) {
    setNotice(`Não foi possível atualizar os favoritos. ${error.message}`, "error");
  }
}

async function loadFavorites() {
  if (!state.user) {
    state.favorites = [];
    renderFavorites();
    return;
  }
  elements.favoritesGrid.setAttribute("aria-busy", "true");
  try {
    const data = await requestJson("/api/favorites");
    state.favorites = (Array.isArray(data.recipes) ? data.recipes : []).map(normalizeRecipe);
    state.favorites.forEach((recipe) => {
      recipe.isFavorite = true;
      const catalogRecipe = state.recipes.find((item) => item.id === recipe.id);
      if (catalogRecipe) catalogRecipe.isFavorite = true;
    });
    renderFavorites();
    setNotice("");
  } catch (error) {
    state.favorites = [];
    renderFavorites();
    setNotice(`Não foi possível carregar seu livro. ${error.message}`, "error");
  } finally {
    elements.favoritesGrid.setAttribute("aria-busy", "false");
  }
}

function renderFavorites() {
  if (!state.user) {
    elements.favoritesGrid.replaceChildren(emptyState("Seu livro começa com uma entrada", "Entre com o Discord para salvar as receitas que você quer preparar.", true));
    return;
  }
  if (!state.favorites.length) {
    elements.favoritesGrid.replaceChildren(emptyState("Seu livro ainda está em branco", "Explore as receitas e toque no coração para guardar as suas favoritas."));
    return;
  }
  renderRecipeGrid(elements.favoritesGrid, state.favorites);
}

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".tab").forEach((tab) => {
    const selected = tab.dataset.view === view;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  elements.catalogView.hidden = view !== "catalog";
  elements.favoritesView.hidden = view !== "favorites";
  elements.createView.hidden = view !== "create";
  if (view === "favorites") loadFavorites();
  if (view === "catalog") loadRecipes();
  if (view === "create" && !state.user) setNotice("Entre com o Discord para compartilhar uma receita.", "info");
}

function addIngredientRow() {
  const row = makeElement("div", "ingredient-row");
  const name = makeElement("input", "ingredient-name-input");
  name.type = "text";
  name.maxLength = 100;
  name.placeholder = "Ingrediente";
  name.setAttribute("aria-label", "Nome do ingrediente");
  name.required = true;
  const quantity = makeElement("input", "ingredient-quantity-input");
  quantity.type = "number";
  quantity.min = "0.001";
  quantity.step = "any";
  quantity.inputMode = "decimal";
  quantity.placeholder = "Qtd.";
  quantity.setAttribute("aria-label", "Quantidade do ingrediente");
  quantity.required = true;
  const unit = makeElement("input", "ingredient-unit-input");
  unit.type = "text";
  unit.maxLength = 30;
  unit.placeholder = "Unidade";
  unit.setAttribute("aria-label", "Unidade de medida");
  unit.required = true;
  const remove = makeElement("button", "remove-row", "×");
  remove.type = "button";
  remove.setAttribute("aria-label", "Remover ingrediente");
  remove.addEventListener("click", () => {
    if (elements.ingredientBuilder.children.length > 1) row.remove();
  });
  row.append(name, quantity, unit, remove);
  elements.ingredientBuilder.append(row);
}

function addStepRow() {
  const row = makeElement("li", "step-row");
  const textarea = makeElement("textarea", "");
  textarea.rows = 2;
  textarea.maxLength = 500;
  textarea.placeholder = "Descreva esta etapa...";
  textarea.setAttribute("aria-label", `Etapa ${elements.stepBuilder.children.length + 1}`);
  textarea.required = true;
  const remove = makeElement("button", "remove-row", "×");
  remove.type = "button";
  remove.setAttribute("aria-label", "Remover etapa");
  remove.addEventListener("click", () => {
    if (elements.stepBuilder.children.length > 1) {
      row.remove();
      updateStepLabels();
    }
  });
  row.append(textarea, remove);
  elements.stepBuilder.append(row);
}

function updateStepLabels() {
  [...elements.stepBuilder.querySelectorAll("textarea")].forEach((textarea, index) => {
    textarea.setAttribute("aria-label", `Etapa ${index + 1}`);
  });
}

async function submitRecipe(event) {
  event.preventDefault();
  const ingredients = [...elements.ingredientBuilder.querySelectorAll(".ingredient-row")].map((row) => ({
    name: row.querySelector(".ingredient-name-input").value.trim(),
    quantity: Number(row.querySelector(".ingredient-quantity-input").value),
    unit: row.querySelector(".ingredient-unit-input").value.trim(),
  }));
  const steps = [...elements.stepBuilder.querySelectorAll("textarea")].map((input) => input.value.trim());
  if (ingredients.some((item) => !item.name || !item.unit || !Number.isFinite(item.quantity) || item.quantity <= 0)
    || steps.some((step) => !step)) {
    setNotice("Preencha todos os ingredientes, quantidades, unidades e etapas com valores válidos.", "error");
    return;
  }
  const payload = {
    title: document.getElementById("recipeTitle").value.trim(),
    description: document.getElementById("recipeDescription").value.trim(),
    prepTime: Number(document.getElementById("recipePrepTime").value),
    servings: Number(document.getElementById("recipeServings").value),
    ingredients,
    steps,
  };
  const submitButton = document.getElementById("submitRecipeButton");
  submitButton.disabled = true;
  submitButton.textContent = "Publicando...";
  try {
    await requestJson("/api/recipes", { method: "POST", body: JSON.stringify(payload) });
    elements.recipeForm.reset();
    elements.ingredientBuilder.replaceChildren();
    elements.stepBuilder.replaceChildren();
    addIngredientRow();
    addStepRow();
    setNotice("Sua receita foi publicada. Obrigado por compartilhar!", "success");
    setView("catalog");
  } catch (error) {
    setNotice(`Não foi possível publicar sua receita. ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Publicar receita ↗";
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setView(tab.dataset.view));
});

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.search = {
    q: document.getElementById("searchQuery").value.trim(),
    ingredient: document.getElementById("searchIngredient").value.trim(),
    maxTime: document.getElementById("searchMaxTime").value.trim(),
  };
  elements.detailPanel.hidden = true;
  state.selectedRecipeId = null;
  loadRecipes();
});

document.getElementById("addIngredientButton").addEventListener("click", addIngredientRow);
document.getElementById("addStepButton").addEventListener("click", addStepRow);
elements.recipeForm.addEventListener("submit", submitRecipe);

document.getElementById("logoutButton").addEventListener("click", async () => {
  const button = document.getElementById("logoutButton");
  button.disabled = true;
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.favorites = [];
    updateAccount();
    renderFavorites();
    setNotice("Você saiu da sua conta.", "success");
    setView("catalog");
  } catch (error) {
    setNotice(`Não foi possível sair da conta. ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
});

async function initialize() {
  addIngredientRow();
  addStepRow();
  try {
    const data = await requestJson("/api/auth/me");
    state.user = data.user || null;
  } catch (error) {
    state.user = null;
    setNotice(`Não foi possível verificar sua sessão. ${error.message}`, "error");
  }
  updateAccount();
  renderFavorites();
  await loadRecipes();
}

initialize();
