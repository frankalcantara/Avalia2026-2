export const $ = (id) => document.getElementById(id);

export function setMessage(text, isError = false) {
  const message = $("setupMessage");
  message.textContent = text;
  message.classList.toggle("error", isError);
}

export function renderProfile(user) {
  const loginLink = $("discordLoginLink");
  const profile = $("profileArea");

  loginLink.classList.toggle("hidden", Boolean(user));
  profile.classList.toggle("hidden", !user);

  if (!user) return;

  $("profileAvatar").src =
    user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
  $("discordUserText").textContent = user.username;
  $("discordUserText").title = `Discord · ${user.userId}`;
}

export function handleExpiredSession() {
  renderProfile(null);
  $("categorySelect").disabled = true;
  $("startBtn").disabled = true;
  $("quizPanel").classList.add("hidden");
  $("resultPanel").classList.add("hidden");
  $("setupPanel").classList.remove("hidden");
  setMessage(
    "Sua sessão expirou. Entre novamente com o Discord para continuar.",
    true,
  );
}

export function renderCategories(categories) {
  const select = $("categorySelect");
  select.replaceChildren(new Option("Selecione uma matéria", ""));

  for (const category of categories) {
    select.add(
      new Option(
        `${category.name} · ${category.questionCount} questões`,
        category.id,
      ),
    );
  }

  const hasCategories = categories.length > 0;
  select.disabled = !hasCategories;
  $("startBtn").disabled = !hasCategories;
  setMessage(
    hasCategories
      ? "Escolha um tema para começar."
      : "Ainda não há matérias disponíveis.",
  );
}

export function renderCategoryLoadError(error) {
  const select = $("categorySelect");

  if (error.status === 401) {
    select.replaceChildren(new Option("Entre com o Discord para continuar", ""));
    setMessage("Entre com sua conta Discord para carregar as matérias.");
  } else {
    select.replaceChildren(new Option("Não foi possível carregar as matérias", ""));
    setMessage("A API não respondeu. Atualize a página para tentar novamente.", true);
  }

  select.disabled = true;
  $("startBtn").disabled = true;
}

export function resetToSignedOutView(message) {
  renderProfile(null);
  $("quizPanel").classList.add("hidden");
  $("resultPanel").classList.add("hidden");
  $("setupPanel").classList.remove("hidden");
  $("categorySelect").replaceChildren(
    new Option("Entre com o Discord para continuar", ""),
  );
  $("categorySelect").disabled = true;
  $("startBtn").disabled = true;
  setMessage(message);
}
