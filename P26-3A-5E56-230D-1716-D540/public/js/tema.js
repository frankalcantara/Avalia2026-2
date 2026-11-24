// Aplica o tema salvo antes da primeira pintura (evita "piscar" claro/escuro).
// Arquivo externo de propósito: a CSP do site não permite script inline.
(function () {
  try {
    var t = localStorage.getItem('tema');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* armazenamento indisponível: segue o tema do sistema */ }
})();
