// Texto de compartilhamento do resultado (grade em emoji, sem revelar a palavra)

import { formatDayMonth } from "./ui.js";

export function shareText({ mode, date, status, attempts, maxAttempts, colorblind, label }) {
  const score = status === "won" ? attempts.length : "X";
  const nome = mode === "sombra" ? "Sombra" : mode === "desafio" ? "Desafio" : "Clássico";
  const titulo = `Cypher ${nome}${date ? ` ${formatDayMonth(date)}` : ""}${label ? ` ${label}` : ""} · ${score}/${maxAttempts}`;
  const cor = colorblind
    ? { correct: "🟧", present: "🟦", absent: "⬛" }
    : { correct: "🟩", present: "🟨", absent: "⬛" };
  const linhas = attempts.map((a) => {
    if (mode === "sombra") return `🎯${a.feedback.exact} 🔁${a.feedback.misplaced}`;
    return a.feedback.map((s) => cor[s]).join("");
  });
  return [titulo, "", ...linhas, "", location.origin].join("\n");
}

export async function shareResult(text) {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // usuário cancelou ou não suportado: cai para a cópia
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
