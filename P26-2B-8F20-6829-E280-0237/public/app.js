const CHAVE_PROJETO = "P26-2B-8F20-6829-E280-0237";
const ACTIVE_GAME_KEY = "sudoku.activeGame";
const ACTIVE_DIFFICULTY_KEY = "sudoku.selectedDifficulty";

const boardElement = document.getElementById("sudokuBoard");
const timerElement = document.getElementById("gameTimer");
const gameStatusElement = document.getElementById("gameStatus");
const victoryPanelElement = document.getElementById("victoryPanel");
const victoryTimeElement = document.getElementById("victoryTime");
const difficultyElement = document.getElementById("difficultySelect");
const notesButton = document.getElementById("notesBtn");
const cellElements = [];

let sessionUser = null;
let cells = [];
let initialBoard = "";
let selectedIndex = 0;
let notesMode = false;
let gameId = null;
let puzzleId = null;
let gameStartedAt = null;
let gameCompleted = false;
let timerInterval = null;
const regionHighlightTimeouts = new Map();
const activeRegionHighlights = new Map();

function createRegions() {
  const regions = [];
  for (let group = 0; group < 9; group += 1) {
    regions.push({
      id: "row-" + group,
      label: "Linha " + (group + 1),
      indices: Array.from({ length: 9 }, (_, offset) => group * 9 + offset),
    });
    regions.push({
      id: "column-" + group,
      label: "Coluna " + (group + 1),
      indices: Array.from({ length: 9 }, (_, offset) => offset * 9 + group),
    });

    const boxRow = Math.floor(group / 3) * 3;
    const boxColumn = (group % 3) * 3;
    const indices = [];
    for (let row = boxRow; row < boxRow + 3; row += 1) {
      for (let column = boxColumn; column < boxColumn + 3; column += 1) {
        indices.push(row * 9 + column);
      }
    }
    regions.push({ id: "box-" + group, label: "Bloco " + (group + 1), indices });
  }
  return regions;
}

const REGIONS = createRegions();

class ApiError extends Error {
  constructor(status, code) {
    super(code || "http_" + status);
    this.name = "ApiError";
    this.status = status;
    this.code = code || "http_" + status;
  }
}

async function requestJson(url, options) {
  let response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });
  } catch (error) {
    throw new Error("Não foi possível conectar à API. Verifique a conexão e tente novamente.");
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!response.ok || data.ok === false) {
    throw new ApiError(response.status, data.error);
  }
  return data;
}

const gameService = {
  async start(difficulty) {
    return requestJson("/api/sudoku/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ difficulty }),
    });
  },

  async loadProgress(activeGameId) {
    return requestJson("/api/progress?gameId=" + encodeURIComponent(activeGameId));
  },

  async saveProgress(activeGameId, board, notes) {
    return requestJson("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: activeGameId, board, notes }),
    });
  },

  async validate(activeGameId, board) {
    return requestJson("/api/sudoku/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: activeGameId, board }),
    });
  },

  async ranking(activePuzzleId) {
    return requestJson("/api/ranking?puzzleId=" + encodeURIComponent(activePuzzleId) + "&limit=10");
  },

  async logout() {
    return requestJson("/api/auth/logout", { method: "POST" });
  },
};

function renderDiscordHeader() {
  const loginLink = document.getElementById("discordLoginLink");
  const userText = document.getElementById("discordUserText");
  const profileLabel = document.getElementById("profileLabel");
  const logoutButton = document.getElementById("logoutButton");

  loginLink.hidden = Boolean(sessionUser);
  userText.hidden = !sessionUser;
  userText.textContent = sessionUser ? "Discord: " + sessionUser.username : "";
  logoutButton.hidden = !sessionUser;
  logoutButton.disabled = false;
  logoutButton.textContent = "Sair da Conta";
  profileLabel.textContent = sessionUser ? "Conectado" : "Perfil Discord";
}

function createBoard() {
  for (let rowIndex = 0; rowIndex < 9; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "sudoku-row";
    row.setAttribute("role", "row");
    row.setAttribute("aria-label", "Linha " + (rowIndex + 1));

    for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
      const index = rowIndex * 9 + columnIndex;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sudoku-cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-disabled", "true");
      cell.disabled = true;
      cell.dataset.index = String(index);
      cell.tabIndex = index === 0 ? 0 : -1;

      if (columnIndex === 2 || columnIndex === 5) {
        cell.classList.add("box-right");
      }
      if (rowIndex === 2 || rowIndex === 5) {
        cell.classList.add("box-bottom");
      }

      row.appendChild(cell);
      cellElements.push(cell);
    }

    boardElement.appendChild(row);
  }
}

function setGameControlsEnabled(enabled) {
  document.body.classList.toggle("has-active-game", enabled && Boolean(gameId) && !gameCompleted);
  cellElements.forEach((element) => {
    element.disabled = !enabled;
    element.setAttribute("aria-disabled", String(!enabled));
  });

  [
    "#saveProgressBtn",
    "#numberPad button",
    "#notesBtn",
    "#eraseBtn",
    "#checkBtn",
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.disabled = !enabled;
    });
  });
  document.getElementById("newGameBtn").disabled = !sessionUser;
  difficultyElement.disabled = Boolean(gameId && !gameCompleted);
}

function renderCell(index) {
  const cellElement = cellElements[index];
  const cellState = cells[index];
  if (!cellElement || !cellState) return;

  cellElement.classList.toggle("is-fixed", cellState.fixed);
  cellElement.replaceChildren();

  if (cellState.value) {
    const valueElement = document.createElement("span");
    valueElement.className = "sudoku-value";
    valueElement.textContent = String(cellState.value);
    cellElement.appendChild(valueElement);
  } else if (cellState.notes.size > 0) {
    const notesElement = document.createElement("span");
    notesElement.className = "cell-notes";
    notesElement.setAttribute("aria-hidden", "true");

    for (let value = 1; value <= 9; value += 1) {
      const noteElement = document.createElement("span");
      noteElement.textContent = cellState.notes.has(value) ? String(value) : "";
      notesElement.appendChild(noteElement);
    }

    cellElement.appendChild(notesElement);
  }

  const row = Math.floor(index / 9) + 1;
  const column = (index % 9) + 1;
  const content = cellState.value ? String(cellState.value) : "vazia";
  const notes = cellState.notes.size ? ", com notas " + Array.from(cellState.notes).sort().join(", ") : "";
  const fixed = cellState.fixed ? ", número inicial" : "";
  cellElement.setAttribute("aria-label", "Linha " + row + ", coluna " + column + ", " + content + notes + fixed);
}

function updateHighlights() {
  const selectedRow = Math.floor(selectedIndex / 9);
  const selectedColumn = selectedIndex % 9;
  const selectedCell = cells[selectedIndex];
  const conflictingCells = findConflictingCells();

  cellElements.forEach((element, index) => {
    const row = Math.floor(index / 9);
    const column = index % 9;
    const sameBlock = Math.floor(row / 3) === Math.floor(selectedRow / 3)
      && Math.floor(column / 3) === Math.floor(selectedColumn / 3);
    const sameUnit = row === selectedRow || column === selectedColumn || sameBlock;

    element.classList.toggle("is-selected", index === selectedIndex);
    element.classList.toggle("is-peer", index !== selectedIndex && sameUnit);
    element.classList.toggle(
      "is-matching",
      index !== selectedIndex && selectedCell.value > 0 && cells[index].value === selectedCell.value,
    );
    element.classList.toggle("is-error", conflictingCells.has(index));
    element.setAttribute("aria-selected", String(index === selectedIndex));
    element.setAttribute("aria-invalid", String(conflictingCells.has(index)));
    element.tabIndex = index === selectedIndex ? 0 : -1;
  });
}

function findConflictingCells() {
  const conflicts = new Set();
  for (let index = 0; index < cells.length; index += 1) {
    const value = cells[index].value;
    if (value === 0) continue;

    const row = Math.floor(index / 9);
    const column = index % 9;
    for (let otherIndex = index + 1; otherIndex < cells.length; otherIndex += 1) {
      if (cells[otherIndex].value !== value) continue;
      const otherRow = Math.floor(otherIndex / 9);
      const otherColumn = otherIndex % 9;
      const sharesRegion = row === otherRow
        || column === otherColumn
        || (Math.floor(row / 3) === Math.floor(otherRow / 3)
          && Math.floor(column / 3) === Math.floor(otherColumn / 3));
      if (!sharesRegion) continue;
      conflicts.add(index);
      conflicts.add(otherIndex);
    }
  }
  return conflicts;
}

function getCompletedRegions() {
  const completed = new Set();
  const expectedValues = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const conflictingCells = findConflictingCells();
  REGIONS.forEach((region) => {
    const values = region.indices.map((index) => cells[index].value);
    const isCompleteAndUnique = values.every((value) => value > 0)
      && new Set(values).size === expectedValues.size
      && values.every((value) => expectedValues.has(value));
    const hasConflicts = region.indices.some((index) => conflictingCells.has(index));
    if (isCompleteAndUnique && !hasConflicts) {
      completed.add(region.id);
    }
  });
  return completed;
}

function updateRegionHighlights() {
  const highlightedCells = new Set();
  activeRegionHighlights.forEach((indices) => {
    indices.forEach((index) => highlightedCells.add(index));
  });
  cellElements.forEach((element, index) => {
    element.classList.toggle("is-region-complete", highlightedCells.has(index));
  });
}

function clearRegionHighlights() {
  regionHighlightTimeouts.forEach((timeout) => window.clearTimeout(timeout));
  regionHighlightTimeouts.clear();
  activeRegionHighlights.clear();
  updateRegionHighlights();
}

function highlightNewlyCompletedRegions(previouslyCompleted) {
  const completedRegions = getCompletedRegions();
  activeRegionHighlights.forEach((indices, regionId) => {
    if (completedRegions.has(regionId)) return;
    window.clearTimeout(regionHighlightTimeouts.get(regionId));
    regionHighlightTimeouts.delete(regionId);
    activeRegionHighlights.delete(regionId);
  });

  const newlyCompleted = REGIONS.filter((region) => (
    !previouslyCompleted.has(region.id) && completedRegions.has(region.id)
  ));

  newlyCompleted.forEach((region) => {
    window.clearTimeout(regionHighlightTimeouts.get(region.id));
    activeRegionHighlights.set(region.id, region.indices);
    const timeout = window.setTimeout(() => {
      activeRegionHighlights.delete(region.id);
      regionHighlightTimeouts.delete(region.id);
      updateRegionHighlights();
    }, 1700);
    regionHighlightTimeouts.set(region.id, timeout);
  });

  updateRegionHighlights();
  return newlyCompleted.map((region) => region.label);
}

function selectCell(index, moveFocus) {
  if (index < 0 || index >= cellElements.length || !gameId) return;
  selectedIndex = index;
  updateHighlights();
  if (moveFocus) cellElements[selectedIndex].focus();
}

function serializeBoard() {
  return cells.map((cell) => String(cell.value)).join("");
}

function serializeNotes() {
  const notes = {};
  cells.forEach((cell, index) => {
    if (cell.value === 0 && cell.notes.size > 0) {
      notes[String(index)] = Array.from(cell.notes).sort((left, right) => left - right);
    }
  });
  return notes;
}

function storeActiveGame() {
  sessionStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify({
    gameId,
    puzzleId,
    difficulty: difficultyElement.value,
    startedAt: gameStartedAt,
    initialBoard,
  }));
}

function restoreSelectedDifficulty() {
  const savedDifficulty = sessionStorage.getItem(ACTIVE_DIFFICULTY_KEY);
  if (["facil", "medio", "dificil"].includes(savedDifficulty)) {
    difficultyElement.value = savedDifficulty;
  }
}

function storeSelectedDifficulty() {
  sessionStorage.setItem(ACTIVE_DIFFICULTY_KEY, difficultyElement.value);
}

function clearStoredGame() {
  sessionStorage.removeItem(ACTIVE_GAME_KEY);
}

function restoreBoard(board, notes) {
  if (typeof board !== "string" || !/^[0-9]{81}$/.test(board)) {
    throw new Error("A API retornou um tabuleiro inválido.");
  }
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    throw new Error("A API retornou notas inválidas.");
  }

  cells = board.split("").map((character, index) => {
    const value = Number(character);
    return {
      value,
      fixed: initialBoard[index] !== "0",
      notes: new Set(),
    };
  });

  Object.entries(notes).forEach(([key, values]) => {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > 80 || String(index) !== key || !Array.isArray(values)) {
      throw new Error("A API retornou notas inválidas.");
    }
    if (cells[index].value !== 0 || values.some((value) => !Number.isInteger(value) || value < 1 || value > 9)) {
      throw new Error("A API retornou notas inválidas.");
    }
    cells[index].notes = new Set(values);
  });

  cells.forEach((cell, index) => renderCell(index));
  selectedIndex = cells.findIndex((cell) => !cell.fixed);
  if (selectedIndex < 0) selectedIndex = 0;
  updateHighlights();
}

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return hours.toString().padStart(2, "0") + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
  }
  return minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
}

function showVictoryPanel(elapsedSeconds) {
  victoryTimeElement.textContent = formatTime(elapsedSeconds);
  victoryTimeElement.dateTime = "PT" + elapsedSeconds + "S";
  victoryPanelElement.hidden = false;
}

function hideVictoryPanel() {
  victoryPanelElement.hidden = true;
}

function updateTimer() {
  if (!gameStartedAt || gameCompleted) return;
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(gameStartedAt)) / 1000));
  timerElement.textContent = formatTime(elapsed);
  timerElement.dateTime = "PT" + elapsed + "S";
}

function startTimer() {
  window.clearInterval(timerInterval);
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 1000);
}

function stopTimer(elapsedSeconds) {
  window.clearInterval(timerInterval);
  timerInterval = null;
  gameCompleted = true;
  if (Number.isInteger(elapsedSeconds) && elapsedSeconds >= 0) {
    timerElement.textContent = formatTime(elapsedSeconds);
    timerElement.dateTime = "PT" + elapsedSeconds + "S";
  }
  setGameControlsEnabled(false);
}

function formatApiError(error) {
  const messages = {
    authentication_required: "Sua sessão Discord expirou. Entre novamente para continuar.",
    invalid_solution: "O servidor identificou números repetidos em uma linha, coluna ou bloco.",
    incorrect_solution: "A solução não está correta. Revise as células e tente novamente.",
    incomplete_board: "Preencha todas as casas antes de verificar a solução.",
    clues_modified: "Os números iniciais do desafio não podem ser alterados.",
    game_not_active: "Esta partida não está mais ativa. Inicie uma nova partida.",
    active_game_not_found: "A partida não está mais ativa.",
  };
  return messages[error.code] || "A operação não foi concluída: " + error.message;
}

function setNotesMode(enabled) {
  notesMode = enabled;
  notesButton.setAttribute("aria-pressed", String(notesMode));
  notesButton.querySelector("span").textContent = notesMode ? "Notas: ativadas" : "Notas";
  gameStatusElement.textContent = notesMode
    ? "Modo de notas ativado. Escolha um número para anotar."
    : "Modo de notas desativado.";
}

function enterValue(value) {
  const cell = cells[selectedIndex];
  if (!gameId || gameCompleted || !cell || cell.fixed) return;

  const completedBeforeInput = notesMode ? null : getCompletedRegions();
  if (notesMode) {
    if (cell.value) return;
    if (cell.notes.has(value)) {
      cell.notes.delete(value);
    } else {
      cell.notes.add(value);
    }
  } else {
    cell.value = value;
    cell.notes.clear();
  }

  renderCell(selectedIndex);
  updateHighlights();
  if (notesMode) {
    gameStatusElement.textContent = "Nota " + value + (cell.notes.has(value) ? " adicionada." : " removida.")
      + " · Linha " + (Math.floor(selectedIndex / 9) + 1) + ", coluna " + ((selectedIndex % 9) + 1) + ".";
    return;
  }

  const completedRegions = highlightNewlyCompletedRegions(completedBeforeInput);
  if (findConflictingCells().has(selectedIndex)) {
    gameStatusElement.textContent = "Conflito detectado na linha, coluna ou bloco desta célula. O número foi mantido.";
  } else {
    gameStatusElement.textContent = completedRegions.length > 0
      ? "Região concluída: " + completedRegions.join(", ") + "."
      : value + " inserido na linha " + (Math.floor(selectedIndex / 9) + 1) + ", coluna " + ((selectedIndex % 9) + 1) + ".";
  }
}

function eraseCell() {
  const cell = cells[selectedIndex];
  if (!gameId || gameCompleted || !cell || cell.fixed) return;

  const completedBeforeInput = getCompletedRegions();
  cell.value = 0;
  cell.notes.clear();
  renderCell(selectedIndex);
  updateHighlights();
  highlightNewlyCompletedRegions(completedBeforeInput);
  gameStatusElement.textContent = "Conteúdo removido da célula selecionada.";
}

function moveSelection(rowDelta, columnDelta) {
  const row = Math.floor(selectedIndex / 9);
  const column = selectedIndex % 9;
  const nextRow = Math.max(0, Math.min(8, row + rowDelta));
  const nextColumn = Math.max(0, Math.min(8, column + columnDelta));
  selectCell(nextRow * 9 + nextColumn, true);
}

async function loadRanking() {
  const rankingStatus = document.getElementById("rankingStatus");
  const rankingList = document.getElementById("rankingList");
  const rankingTag = document.getElementById("rankingTag");
  rankingStatus.textContent = "Carregando ranking...";
  rankingTag.textContent = "Carregando";

  try {
    const data = await gameService.ranking(puzzleId);
    rankingList.replaceChildren();
    rankingTag.textContent = "Dificuldade " + data.difficulty;

    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      rankingStatus.textContent = "Ainda não há resultados para este desafio.";
      return;
    }

    rankingStatus.textContent = "Melhores tempos deste desafio.";
    data.entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "ranking-placeholder";

      const rank = document.createElement("span");
      rank.className = "ranking-placeholder-icon";
      rank.textContent = String(entry.rank);

      const result = document.createElement("span");
      result.textContent = entry.username + " · " + formatTime(Number(entry.elapsedSeconds));

      item.append(rank, result);
      rankingList.appendChild(item);
    });
  } catch (error) {
    rankingTag.textContent = "Indisponível";
    rankingStatus.textContent = "Não foi possível carregar o ranking: " + formatApiError(error);
  }
}

async function startGame() {
  if (!sessionUser) {
    gameStatusElement.textContent = "Entre com sua conta Discord antes de iniciar uma partida.";
    return;
  }

  const newGameButton = document.getElementById("newGameBtn");
  newGameButton.disabled = true;
  gameStatusElement.textContent = "Solicitando uma nova partida ao servidor...";
  try {
    const game = await gameService.start(difficultyElement.value);
    if (
      typeof game.gameId !== "string"
      || typeof game.puzzleId !== "string"
      || typeof game.board !== "string"
      || !/^[0-9]{81}$/.test(game.board)
      || typeof game.startedAt !== "string"
    ) {
      throw new Error("A API retornou dados incompletos para a partida.");
    }

    hideVictoryPanel();
    gameId = game.gameId;
    puzzleId = game.puzzleId;
    gameStartedAt = game.startedAt;
    initialBoard = game.board;
    gameCompleted = false;
    clearRegionHighlights();
    difficultyElement.value = game.difficulty;
    storeSelectedDifficulty();
    restoreBoard(game.board, {});
    storeActiveGame();
    setNotesMode(false);
    setGameControlsEnabled(true);
    document.getElementById("gameModeLabel").textContent = "Partida autenticada · " + sessionUser.username;
    gameStatusElement.textContent = "Partida carregada do servidor. Seu progresso pode ser salvo a qualquer momento.";
    startTimer();
    await loadRanking();
  } catch (error) {
    setGameControlsEnabled(Boolean(gameId) && !gameCompleted);
    gameStatusElement.textContent = formatApiError(error);
  } finally {
    newGameButton.disabled = !sessionUser;
  }
}

async function resumeGame(savedGame) {
  const progress = await gameService.loadProgress(savedGame.gameId);
  if (
    typeof progress.board !== "string"
    || progress.gameId !== savedGame.gameId
    || typeof savedGame.puzzleId !== "string"
    || typeof savedGame.initialBoard !== "string"
    || !/^[0-9]{81}$/.test(savedGame.initialBoard)
  ) {
    throw new Error("Não foi possível restaurar os dados da partida salva.");
  }

  gameId = savedGame.gameId;
  puzzleId = savedGame.puzzleId;
  gameStartedAt = savedGame.startedAt;
  initialBoard = savedGame.initialBoard;
  difficultyElement.value = savedGame.difficulty;
  gameCompleted = false;
  clearRegionHighlights();
  restoreBoard(progress.board, progress.notes);
  setNotesMode(false);
  setGameControlsEnabled(true);
  document.getElementById("gameModeLabel").textContent = "Partida restaurada · " + sessionUser.username;
  gameStatusElement.textContent = "Progresso recuperado do servidor.";
  startTimer();
  await loadRanking();
}

async function initializeAuthenticatedGame() {
  const newGameButton = document.getElementById("newGameBtn");
  newGameButton.disabled = true;
  try {
    const savedValue = sessionStorage.getItem(ACTIVE_GAME_KEY);
    if (savedValue) {
      let savedGame;
      try {
        savedGame = JSON.parse(savedValue);
      } catch (error) {
        clearStoredGame();
        gameStatusElement.textContent = "O estado local da partida estava inválido; será iniciada uma nova partida.";
      }

      if (savedGame) {
        try {
          await resumeGame(savedGame);
          return;
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 404) {
            throw error;
          }
          clearStoredGame();
        }
      }
    }
    setGameControlsEnabled(false);
    gameStatusElement.textContent = "Escolha a dificuldade e clique em Novo jogo para começar.";
  } catch (error) {
    gameStatusElement.textContent = formatApiError(error);
    setGameControlsEnabled(false);
  }
}

function renderRecords(data) {
  const listElement = document.getElementById("recordsList");
  const items = Array.isArray(data.ultimosRegistros) ? data.ultimosRegistros : [];
  listElement.replaceChildren();
  if (items.length === 0) {
    const item = document.createElement("li");
    item.textContent = data.sessionUser
      ? "API Online (" + (data.d1Connected ? "D1 conectado" : "modo diagnóstico") + "). Nenhum registro gravado ainda."
      : "Entre com o Discord para consultar os registros da sua conta.";
    listElement.appendChild(item);
    return;
  }

  items.forEach((record) => {
    const item = document.createElement("li");
    item.textContent = "[" + (record.created_at || "agora") + "] " + record.username + ": " + record.conteudo;
    listElement.appendChild(item);
  });
}

async function loadDiagnostics() {
  const listElement = document.getElementById("recordsList");
  try {
    const data = await requestJson("/api/status");
    renderRecords(data);
    return data;
  } catch (error) {
    const item = document.createElement("li");
    item.textContent = "API de diagnóstico indisponível: " + formatApiError(error);
    listElement.replaceChildren(item);
    throw error;
  }
}

async function loadSession() {
  setGameControlsEnabled(false);
  try {
    const data = await loadDiagnostics();
    sessionUser = data.sessionUser || null;
    renderDiscordHeader();

    if (!sessionUser || typeof sessionUser.userId !== "string" || typeof sessionUser.username !== "string") {
      sessionUser = null;
      renderDiscordHeader();
      document.getElementById("gameModeLabel").textContent = "Aguardando autenticação Discord";
      gameStatusElement.textContent = "Entre com sua conta Discord para iniciar e salvar uma partida.";
      return;
    }

    document.getElementById("gameModeLabel").textContent = "Conta Discord autenticada";
    await initializeAuthenticatedGame();
  } catch (error) {
    sessionUser = null;
    renderDiscordHeader();
    document.getElementById("gameModeLabel").textContent = "Autenticação indisponível";
    gameStatusElement.textContent = "Não foi possível confirmar sua sessão: " + formatApiError(error);
  }
}

function isBoardComplete() {
  return cells.length === 81 && cells.every((cell) => cell.value > 0);
}

async function saveProgress() {
  if (!sessionUser || !gameId || gameCompleted) return;

  const saveButton = document.getElementById("saveProgressBtn");
  saveButton.disabled = true;
  gameStatusElement.textContent = "Salvando progresso no servidor...";
  try {
    await gameService.saveProgress(gameId, serializeBoard(), serializeNotes());
    storeActiveGame();
    gameStatusElement.textContent = "Progresso salvo no servidor.";
  } catch (error) {
    gameStatusElement.textContent = formatApiError(error);
  } finally {
    saveButton.disabled = !gameId || gameCompleted;
  }
}

async function validateGame() {
  if (!sessionUser || !gameId || gameCompleted) return;
  if (!isBoardComplete()) {
    gameStatusElement.textContent = "Preencha todas as casas antes de enviar a solução ao servidor.";
    return;
  }

  const checkButton = document.getElementById("checkBtn");
  checkButton.disabled = true;
  gameStatusElement.textContent = "Enviando a solução para validação no servidor...";
  try {
    const result = await gameService.validate(gameId, serializeBoard());
    if (result.completed !== true) {
      throw new Error("O servidor não confirmou a conclusão da partida.");
    }

    const elapsedSeconds = Number(result.elapsedSeconds);
    if (!Number.isInteger(elapsedSeconds) || elapsedSeconds < 0) {
      throw new Error("O servidor retornou um tempo de conclusão inválido.");
    }

    stopTimer(elapsedSeconds);
    clearStoredGame();
    showVictoryPanel(elapsedSeconds);
    gameStatusElement.textContent = "Sudoku validado pelo servidor.";
    await loadRanking();
  } catch (error) {
    gameStatusElement.textContent = formatApiError(error);
  } finally {
    checkButton.disabled = !gameId || gameCompleted;
  }
}

async function sendDiagnosticRecord() {
  const input = document.getElementById("recordInput");
  const statusElement = document.getElementById("statusMessage");
  const content = input.value.trim();
  if (!content) {
    statusElement.textContent = "Digite um conteúdo antes de registrar.";
    input.focus();
    return;
  }

  statusElement.textContent = "Enviando para Cloudflare Function...";
  try {
    await requestJson("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudo: content }),
    });
    input.value = "";
    statusElement.textContent = "Registro processado na Cloudflare Function.";
    await loadDiagnostics();
  } catch (error) {
    statusElement.textContent = formatApiError(error);
  }
}

function resetGameAfterLogout() {
  hideVictoryPanel();
  window.clearInterval(timerInterval);
  timerInterval = null;
  gameId = null;
  puzzleId = null;
  gameStartedAt = null;
  initialBoard = "";
  gameCompleted = false;
  selectedIndex = 0;
  notesMode = false;
  cells = Array.from({ length: 81 }, () => ({ value: 0, fixed: false, notes: new Set() }));
  cells.forEach((cell, index) => renderCell(index));
  clearRegionHighlights();
  updateHighlights();
  timerElement.textContent = "00:00";
  timerElement.dateTime = "PT0S";
  notesButton.setAttribute("aria-pressed", "false");
  notesButton.querySelector("span").textContent = "Notas";
  setGameControlsEnabled(false);
  clearStoredGame();

  const rankingList = document.getElementById("rankingList");
  rankingList.replaceChildren();
  const placeholder = document.createElement("li");
  placeholder.className = "ranking-placeholder";
  const icon = document.createElement("span");
  icon.className = "ranking-placeholder-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "—";
  const message = document.createElement("span");
  message.textContent = "Entre com o Discord para iniciar uma partida.";
  placeholder.append(icon, message);
  rankingList.appendChild(placeholder);
  document.getElementById("rankingTag").textContent = "Aguardando partida";
  document.getElementById("rankingStatus").textContent = "O ranking será carregado ao iniciar uma partida.";
}

async function logout() {
  const button = document.getElementById("logoutButton");
  if (!sessionUser || button.disabled) return;

  button.disabled = true;
  button.textContent = "Saindo...";
  gameStatusElement.textContent = "Encerrando sessão Discord...";
  try {
    await gameService.logout();
    sessionUser = null;
    renderDiscordHeader();
    resetGameAfterLogout();
    document.getElementById("gameModeLabel").textContent = "Aguardando autenticação Discord";
    gameStatusElement.textContent = "Você saiu da sua conta Discord.";
    try {
      await loadDiagnostics();
    } catch (error) {
      document.getElementById("statusMessage").textContent = "Sessão encerrada; não foi possível atualizar o diagnóstico.";
    }
  } catch (error) {
    gameStatusElement.textContent = "Não foi possível encerrar a sessão: " + formatApiError(error);
    button.disabled = false;
    button.textContent = "Sair da Conta";
  }
}

function handleBoardKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!(event.target instanceof Element) || !event.target.closest(".sudoku-cell")) return;

  const movement = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }[event.key];

  if (movement) {
    event.preventDefault();
    moveSelection(movement[0], movement[1]);
  }
}

function handleDocumentKeydown(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || !gameId || gameCompleted) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

  if (/^[1-9]$/.test(event.key)) {
    enterValue(Number(event.key));
  } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
    event.preventDefault();
    eraseCell();
  } else if (event.key.toLowerCase() === "n") {
    setNotesMode(!notesMode);
  }
}

createBoard();
setGameControlsEnabled(false);

boardElement.addEventListener("click", (event) => {
  const cellElement = event.target.closest(".sudoku-cell");
  if (cellElement) selectCell(Number(cellElement.dataset.index), false);
});
boardElement.addEventListener("keydown", handleBoardKeydown);
document.addEventListener("keydown", handleDocumentKeydown);

document.getElementById("numberPad").addEventListener("click", (event) => {
  const button = event.target.closest("[data-number]");
  if (button) enterValue(Number(button.dataset.number));
});
document.getElementById("eraseBtn").addEventListener("click", eraseCell);
document.getElementById("checkBtn").addEventListener("click", validateGame);
document.getElementById("saveProgressBtn").addEventListener("click", saveProgress);
notesButton.addEventListener("click", () => setNotesMode(!notesMode));
document.getElementById("newGameBtn").addEventListener("click", startGame);
document.getElementById("sendBtn").addEventListener("click", sendDiagnosticRecord);
document.getElementById("logoutButton").addEventListener("click", logout);
document.getElementById("difficultySelect").addEventListener("change", storeSelectedDifficulty);

restoreSelectedDifficulty();
renderDiscordHeader();
loadSession();
