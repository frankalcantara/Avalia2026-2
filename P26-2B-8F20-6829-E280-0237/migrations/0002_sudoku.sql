CREATE TABLE IF NOT EXISTS sudoku_puzzles (
  puzzle_id TEXT PRIMARY KEY NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('facil', 'medio', 'dificil')),
  initial_board TEXT NOT NULL CHECK (
    length(initial_board) = 81
    AND initial_board NOT GLOB '*[^0-9]*'
  ),
  solution TEXT NOT NULL CHECK (
    length(solution) = 81
    AND solution NOT GLOB '*[^1-9]*'
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sudoku_puzzles (puzzle_id, difficulty, initial_board, solution)
VALUES
  (
    'facil-1',
    'facil',
    '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
  ),
  (
    'medio-1',
    'medio',
    '530070000600095000008000060800060003000803001700020006060000280000419000000080079',
    '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
  ),
  (
    'dificil-1',
    'dificil',
    '030000000000195000098000060000060003400800001000020000060000280000419005000000079',
    '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
  )
ON CONFLICT (puzzle_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sudoku_games (
  game_id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  puzzle_id TEXT NOT NULL REFERENCES sudoku_puzzles(puzzle_id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  CHECK (
    (status = 'in_progress' AND finished_at IS NULL)
    OR (status IN ('completed', 'abandoned') AND finished_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS sudoku_progress (
  game_id TEXT PRIMARY KEY NOT NULL
    REFERENCES sudoku_games(game_id) ON DELETE CASCADE,
  board TEXT NOT NULL CHECK (
    length(board) = 81
    AND board NOT GLOB '*[^0-9]*'
  ),
  notes_json TEXT NOT NULL DEFAULT '{}'
    CHECK (json_valid(notes_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sudoku_results (
  game_id TEXT PRIMARY KEY NOT NULL
    REFERENCES sudoku_games(game_id) ON DELETE CASCADE,
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
  username_snapshot TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sudoku_games_user_status_started
  ON sudoku_games(user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sudoku_games_puzzle_status
  ON sudoku_games(puzzle_id, status);

CREATE INDEX IF NOT EXISTS idx_sudoku_results_ranking
  ON sudoku_results(elapsed_seconds, completed_at, game_id);
