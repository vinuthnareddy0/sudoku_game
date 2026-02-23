/* =============================================
   engine.js — Sudoku Puzzle Engine
   Handles: generation, solving, validation,
            stats persistence (localStorage)
   ============================================= */

/* ── Utility ── */
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Check if placing `num` at position `idx` is valid on the board.
 * Validates row, column, and (for 9×9) the 3×3 box.
 */
function isValidPlace(board, idx, num, size) {
  const row = Math.floor(idx / size);
  const col = idx % size;

  for (let i = 0; i < size; i++) {
    if (board[row * size + i] === num) return false; // row check
    if (board[i * size + col] === num) return false; // col check
  }

  // 3×3 box check (only applies to 9×9)
  if (size === 9) {
    const bR = Math.floor(row / 3) * 3;
    const bC = Math.floor(col / 3) * 3;
    for (let i = 0; i < 9; i++) {
      if (board[(bR + Math.floor(i / 3)) * 9 + (bC + i % 3)] === num) return false;
    }
  }
  return true;
}

/**
 * Generate a complete, valid solved board using
 * backtracking with randomised candidate order.
 */
function generateSolution(size) {
  const board = Array(size * size).fill(0);
  const nums  = Array.from({ length: size }, (_, i) => i + 1);

  function solve(pos) {
    if (pos === size * size) return true;
    if (board[pos] !== 0) return solve(pos + 1);
    for (const n of shuffleArr([...nums])) {
      if (isValidPlace(board, pos, n, size)) {
        board[pos] = n;
        if (solve(pos + 1)) return true;
        board[pos] = 0;
      }
    }
    return false;
  }

  solve(0);
  return board;
}

/**
 * Count solutions for a board up to `limit`.
 * Used to verify a puzzle has exactly one solution.
 */
function countSolutions(board, pos, limit, size) {
  if (pos === size * size) return 1;
  if (board[pos] !== 0) return countSolutions(board, pos + 1, limit, size);

  let count = 0;
  for (let n = 1; n <= size; n++) {
    if (isValidPlace(board, pos, n, size)) {
      board[pos] = n;
      count += countSolutions(board, pos + 1, limit, size);
      board[pos] = 0;
      if (count >= limit) return count;
    }
  }
  return count;
}

/**
 * Remove clues from a solved board to create a puzzle.
 * Difficulty controls how many clues remain.
 * Every removal is validated to keep a unique solution.
 */
const CLUE_TARGETS = { easy: 35, medium: 30, hard: 26 };

function createPuzzle(solution, diff, size) {
  const total  = size * size;
  const clues  = size === 3
    ? Math.max(3, Math.floor(total * 0.45))
    : (CLUE_TARGETS[diff] || 35);

  const puzzle = [...solution];
  const idxArr = shuffleArr(Array.from({ length: total }, (_, i) => i));
  let removed  = 0;
  const target = total - clues;

  for (const idx of idxArr) {
    if (removed >= target) break;
    const backup = puzzle[idx];
    puzzle[idx]  = 0;
    if (countSolutions([...puzzle], 0, 2, size) === 1) {
      removed++;
    } else {
      puzzle[idx] = backup; // restore — uniqueness would break
    }
  }
  return puzzle;
}

/* =============================================
   STATS — localStorage persistence
   ============================================= */
const STATS_KEY = 'sudoku_stats_v3';

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {}
}

function getStatEntry(diff, size) {
  const s = loadStats();
  const k = `${diff}_${size}`;
  if (!s[k]) s[k] = { played: 0, completed: 0, bestTime: null, totalTime: 0 };
  return { stats: s, key: k };
}

function recordPlayed(diff, size) {
  const { stats, key } = getStatEntry(diff, size);
  stats[key].played++;
  saveStats(stats);
}

function recordCompleted(diff, size, secs) {
  const { stats, key } = getStatEntry(diff, size);
  const d = stats[key];
  d.completed++;
  d.totalTime += secs;
  if (d.bestTime === null || secs < d.bestTime) d.bestTime = secs;
  saveStats(stats);
}

function clearAllStats() {
  localStorage.removeItem(STATS_KEY);
}

/* ── Formatting helpers ── */
function fmtTime(s) {
  if (s === null || s === undefined) return '—';
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function el(id) { return document.getElementById(id); }

/* ── Timeline par times (seconds) ── */
const TL_LIMITS = {
  easy_9: 480,  medium_9: 720,  hard_9: 1080,
  easy_3: 60,   medium_3: 90,   hard_3: 120
};
