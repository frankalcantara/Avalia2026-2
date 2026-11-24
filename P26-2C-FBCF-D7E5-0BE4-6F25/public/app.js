
const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const message = document.getElementById("gameMessage");

const keys = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  ["ENTER", ..."ZXCVBNM".split(""), "⌫"]
];

let currentGuess = "";
let gameState = null;
let busy = false;

function mostrarMensagem(texto) {
  message.textContent = texto;
}

function desenharTabuleiro(guesses = []) {
  board.innerHTML = "";

  for (let row = 0; row < 6; row++) {
    const saved = guesses[row];

    for (let col = 0; col < 5; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      if (saved) {
        cell.textContent = saved.guess[col] || "";
        const result = saved.result[col];
        if (result) cell.classList.add(result);
      } else if (row === guesses.length && currentGuess[col]) {
        cell.textContent = currentGuess[col];
        cell.classList.add("filled");
      }

      board.appendChild(cell);
    }
  }
}

function desenharTeclado(guesses = []) {
  const states = {};

  guesses.forEach(({ guess, result }) => {
    [...guess].forEach((letter, index) => {
      const rank = { absent: 1, present: 2, correct: 3 };
      const next = result[index];
      if (!states[letter] || rank[next] > rank[states[letter]]) {
        states[letter] = next;
      }
    });
  });

  keyboard.innerHTML = "";

  keys.forEach((line) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";

    line.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = key === "⌫" ? "⌫" : key;
      button.className = "key";

      if (key.length === 1 && states[key]) {
        button.classList.add(states[key]);
      }

      if (key === "ENTER" || key === "⌫") {
        button.classList.add("key-wide");
      }

      button.addEventListener("click", () => pressionarTecla(key));
      row.appendChild(button);
    });

    keyboard.appendChild(row);
  });
}

function atualizarEstatisticas(stats = {}) {
  document.getElementById("gamesPlayed").textContent =
    stats.gamesPlayed ?? 0;

  const played = Number(stats.gamesPlayed || 0);
  const won = Number(stats.gamesWon || 0);

  document.getElementById("winRate").textContent =
    played ? `${Math.round((won / played) * 100)}%` : "0%";

  document.getElementById("currentStreak").textContent =
    stats.currentStreak ?? 0;

  document.getElementById("maxStreak").textContent =
    stats.maxStreak ?? 0;

  const distribution = document.getElementById("distribution");
  distribution.innerHTML = "";

  for (let i = 1; i <= 6; i++) {
    const line = document.createElement("div");
    line.className = "distribution-row";

    const label = document.createElement("span");
    label.textContent = i;

    const bar = document.createElement("div");
    bar.className = "distribution-bar";

    const value = Number(stats.distribution?.[i] || 0);
    bar.textContent = value;
    bar.style.width = `${Math.max(value ? 12 : 0, value * 12)}%`;

    line.append(label, bar);
    distribution.appendChild(line);
  }
}

async function carregarJogo() {
  try {
    const response = await fetch("/api/game", {
      credentials: "same-origin"
    });

    const data = await response.json();

    if (response.status === 401 || !data.authenticated) {
      document.getElementById("loginNotice").hidden = false;
      document.getElementById("gameArea").hidden = true;
      document.getElementById("discordUserText").textContent =
        "Não autenticado";
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Não foi possível carregar o jogo.");
    }

    document.getElementById("loginNotice").hidden = true;
    document.getElementById("gameArea").hidden = false;
    document.getElementById("discordUserText").textContent =
      `Discord: ${data.user.username}`;
    document.getElementById("discordLoginLink").hidden = true;

    document.getElementById("gameDate").textContent =
      data.gameDate || "";

    gameState = data;
    currentGuess = "";

    desenharTabuleiro(data.guesses);
    desenharTeclado(data.guesses);
    atualizarEstatisticas(data.stats);

    if (data.status === "won") {
      mostrarMensagem("Você venceu! Volte amanhã para um novo desafio.");
    } else if (data.status === "lost") {
      mostrarMensagem("Fim de jogo! Você poderá tentar novamente amanhã.");
    } else {
      mostrarMensagem("Boa sorte! Digite uma palavra de cinco letras.");
    }
  } catch (error) {
    mostrarMensagem(error.message || "Erro ao conectar com o servidor.");
  }
}

async function enviarTentativa() {
  if (busy || !gameState || gameState.status !== "playing") return;

  if (currentGuess.length !== 5) {
    mostrarMensagem("A palavra precisa ter cinco letras.");
    return;
  }

  busy = true;
  mostrarMensagem("Verificando palavra...");

  try {
    const response = await fetch("/api/game", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guess: currentGuess })
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarMensagem(data.error || "Não foi possível enviar a tentativa.");
      return;
    }

    gameState = data;
    currentGuess = "";

    desenharTabuleiro(data.guesses);
    desenharTeclado(data.guesses);
    atualizarEstatisticas(data.stats);

    if (data.status === "won") {
      mostrarMensagem("Parabéns! Você acertou a palavra!");
    } else if (data.status === "lost") {
      mostrarMensagem("Suas tentativas acabaram. Tente novamente amanhã.");
    } else {
      mostrarMensagem("Tentativa registrada. Continue!");
    }
  } catch {
    mostrarMensagem("Falha de conexão. Tente novamente.");
  } finally {
    busy = false;
  }
}

function pressionarTecla(key) {
  if (busy || !gameState || gameState.status !== "playing") return;

  if (key === "ENTER") {
    enviarTentativa();
  } else if (key === "⌫") {
    currentGuess = currentGuess.slice(0, -1);
    desenharTabuleiro(gameState.guesses);
  } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
    currentGuess += key;
    desenharTabuleiro(gameState.guesses);
  }
}

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;

  if (event.key === "Enter") {
    pressionarTecla("ENTER");
  } else if (event.key === "Backspace") {
    pressionarTecla("⌫");
  } else if (/^[a-zA-Z]$/.test(event.key)) {
    pressionarTecla(event.key.toUpperCase());
  }
});

carregarJogo();
