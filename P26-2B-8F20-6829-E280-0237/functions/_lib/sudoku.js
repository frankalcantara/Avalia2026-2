export const MIN_GAME_DURATION_SECONDS = 30;

export function validateProgressBoard(board, puzzle) {
  if (typeof board !== "string" || !/^[0-9]{81}$/.test(board)) {
    return "invalid_board";
  }

  for (let index = 0; index < 81; index += 1) {
    if (puzzle.initial_board[index] !== "0" && board[index] !== puzzle.initial_board[index]) {
      return "clues_modified";
    }
  }
  return null;
}

export function normalizeNotes(notes, board) {
  if (notes === undefined) notes = {};
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
    return { error: "invalid_notes" };
  }

  const normalized = {};
  for (const [key, values] of Object.entries(notes)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index > 80 || String(index) !== key) {
      return { error: "invalid_notes" };
    }
    if (
      !Array.isArray(values)
      || values.length > 9
      || values.some((value) => !Number.isInteger(value) || value < 1 || value > 9)
      || new Set(values).size !== values.length
      || (board[index] !== "0" && values.length > 0)
    ) {
      return { error: "invalid_notes" };
    }
    if (values.length > 0) {
      normalized[key] = [...values].sort((a, b) => a - b);
    }
  }

  return { notesJson: JSON.stringify(normalized) };
}

export function validateSolvedBoard(board, puzzle) {
  const progressError = validateProgressBoard(board, puzzle);
  if (progressError) return progressError;
  if (board.includes("0")) return "incomplete_board";

  for (let group = 0; group < 9; group += 1) {
    const row = [];
    const column = [];
    const block = [];
    for (let offset = 0; offset < 9; offset += 1) {
      row.push(board[group * 9 + offset]);
      column.push(board[offset * 9 + group]);
      const blockRow = Math.floor(group / 3) * 3 + Math.floor(offset / 3);
      const blockColumn = (group % 3) * 3 + offset % 3;
      block.push(board[blockRow * 9 + blockColumn]);
    }
    if (new Set(row).size !== 9 || new Set(column).size !== 9 || new Set(block).size !== 9) {
      return "invalid_solution";
    }
  }

  if (board !== puzzle.solution) return "incorrect_solution";
  return null;
}
