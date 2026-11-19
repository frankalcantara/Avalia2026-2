/* Aplica o tema salvo antes da pintura para evitar flash. */
try {
  var t = localStorage.getItem("acervo-theme");
  if (t === "dark" || t === "light") document.documentElement.setAttribute("data-theme", t);
} catch (e) { /* ignora */ }
