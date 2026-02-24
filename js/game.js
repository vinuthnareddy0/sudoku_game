/* =============================================
   game.js — Game Logic, UI & Event Wiring
   Depends on: engine.js (loaded first)
   ============================================= */

/* ── Navigation state ── */
let chosenLevel = 'easy';
let chosenSize  = 9;

/**
 * Transition between screens with a fade+slide animation.
 */
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => {
    if (s.classList.contains('active')) {
      s.classList.remove('active');
      s.classList.add('exit');
      setTimeout(() => s.classList.remove('exit'), 500);
    }
  });
  setTimeout(() => {
    const screen = el(id);
    screen.classList.add('active');
    if (id === 'screen-game') updateStatsUI();
  }, 80);
}

/** Called when user picks a difficulty card */
function selectLevel(lvl) {
  chosenLevel = lvl;
  document.querySelectorAll('[data-level]').forEach(c => c.classList.remove('selected'));
  document.querySelector(`[data-level="${lvl}"]`).classList.add('selected');
  setTimeout(() => goTo('screen-size'), 280);
}

/** Called when user picks a grid size card */
function selectSize(sz) {
  chosenSize = sz;
  document.querySelectorAll('[data-size]').forEach(c => c.classList.remove('selected'));
  document.querySelector(`[data-size="${sz}"]`).classList.add('selected');
  setTimeout(() => {
    goTo('screen-game');
    Game.init(chosenLevel, chosenSize);
  }, 280);
}

/* =============================================
   GAME OBJECT
   Encapsulates all game state behind a clean API.
   ============================================= */
const Game = (() => {

  /* ── Private state ── */
  let solution   = [];  // full solved board
  let puzzle     = [];  // clues only (0 = empty)
  let userBoard  = [];  // current player state
  let notes      = [];  // Array<Set<number>> per cell
  let givenSet   = new Set(); // indices of pre-filled clues
  let selectedIdx = -1;
  let pencilMode  = false;
  let hintsLeft   = 3;
  let undoStack   = [];

  let timerInterval = null;
  let elapsed       = 0;
  let timerStarted  = false;
  let diff = 'easy';
  let size = 9;

  /* ── Init / New Game ── */
  function init(d, sz) {
    diff = d;
    size = sz;
    solution  = generateSolution(size);
    puzzle    = createPuzzle(solution, diff, size);
    userBoard = [...puzzle];
    notes     = Array.from({ length: size * size }, () => new Set());
    givenSet  = new Set(puzzle.reduce((a, v, i) => { if (v) a.push(i); return a; }, []));

    selectedIdx = -1;
    pencilMode  = false;
    hintsLeft   = 3;
    undoStack   = [];

    stopTimer();
    elapsed      = 0;
    timerStarted = false;

    recordPlayed(diff, size);
    buildGrid();
    renderAll();
    updateUI();
    updateTimerDisplay();
    updateStatsUI();
    el('btn-pencil').classList.remove('active');
  }

  function newGame() { init(diff, size); }

  function reset() {
    userBoard    = [...puzzle];
    notes        = Array.from({ length: size * size }, () => new Set());
    undoStack    = [];
    selectedIdx  = -1;
    stopTimer();
    elapsed      = 0;
    timerStarted = false;
    updateTimerDisplay();
    renderAll();
    updateUI();
  }

  /* ── Timer ── */
  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    const tlLimit = TL_LIMITS[`${diff}_${size}`] || 600;
    timerInterval = setInterval(() => {
      elapsed++;
      updateTimerDisplay();
      updateTimeline(elapsed, tlLimit);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function updateTimerDisplay() {
    const t = fmtTime(elapsed);
    el('timer-display').textContent = t;
    el('tl-elapsed').textContent    = t;
  }

  function updateTimeline(current, limit) {
    const pct = Math.min(100, (current / limit) * 100);
    el('timeline-fill').style.width   = pct + '%';
    el('tl-limit').textContent         = fmtTime(limit);
  }

  /* ── Build grid DOM ── */
  function buildGrid() {
    const grid = el('sudoku-grid');
    grid.innerHTML = '';
    grid.className = `sudoku-grid size-${size}`;
    grid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    grid.style.gridTemplateRows    = `repeat(${size}, 1fr)`;

    for (let i = 0; i < size * size; i++) {
      const cell = document.createElement('div');
      cell.className    = 'cell';
      cell.dataset.idx  = i;
      cell.dataset.row  = Math.floor(i / size);
      cell.dataset.col  = i % size;
      cell.addEventListener('click', () => select(i));
      grid.appendChild(cell);
    }

    // Build numpad — all numbers + erase in one row
    const np = el('numpad');
    np.innerHTML  = '';
    np.className  = 'numpad-grid' + (size === 3 ? ' cols-3' : '');

    for (let n = 1; n <= size; n++) {
      const b = document.createElement('button');
      b.className    = 'num-btn';
      b.dataset.num  = n;
      b.textContent  = n;
      b.addEventListener('click', () => enter(n));
      np.appendChild(b);
    }

    const er = document.createElement('button');
    er.className   = 'num-btn erase-btn';
    er.dataset.num = 0;
    er.textContent = '⌫';
    er.addEventListener('click', () => enter(0));
    np.appendChild(er);

    // Update topbar badges
    el('badge-diff').textContent = diff.toUpperCase();
    el('badge-size').textContent = `${size}×${size}`;

    // Init timeline
    const tlLimit = TL_LIMITS[`${diff}_${size}`] || 600;
    el('tl-limit').textContent          = fmtTime(tlLimit);
    el('timeline-fill').style.width     = '0%';
  }

  /* ── Cell selection & highlighting ── */
  function select(idx) {
    selectedIdx = idx;
    highlightCells();
  }

  function highlightCells() {
    const cells = document.querySelectorAll('.cell');
    if (selectedIdx < 0) {
      cells.forEach(c => c.classList.remove('selected', 'highlighted', 'same-num'));
      return;
    }
    const sR   = Math.floor(selectedIdx / size);
    const sC   = selectedIdx % size;
    const sBR  = Math.floor(sR / 3) * 3;
    const sBC  = Math.floor(sC / 3) * 3;
    const selNum = userBoard[selectedIdx];

    cells.forEach((cell, i) => {
      const r  = Math.floor(i / size);
      const c  = i % size;
      const bR = Math.floor(r / 3) * 3;
      const bC = Math.floor(c / 3) * 3;
      const inRegion = r === sR || c === sC || (size === 9 && bR === sBR && bC === sBC);

      cell.classList.toggle('selected',    i === selectedIdx);
      cell.classList.toggle('highlighted', i !== selectedIdx && inRegion);
      cell.classList.toggle('same-num',    i !== selectedIdx && selNum !== 0 && userBoard[i] === selNum);
    });
  }

  /* ── Enter a number into the selected cell ── */
  function enter(num) {
    if (selectedIdx < 0 || givenSet.has(selectedIdx)) return;
    startTimer();

    if (pencilMode && num !== 0) {
      // Toggle note
      const prev = new Set(notes[selectedIdx]);
      notes[selectedIdx].has(num)
        ? notes[selectedIdx].delete(num)
        : notes[selectedIdx].add(num);
      undoStack.push({ idx: selectedIdx, prev: userBoard[selectedIdx], prevNotes: prev, isNote: true });
    } else {
      // Normal value
      const prev      = userBoard[selectedIdx];
      const prevNotes = new Set(notes[selectedIdx]);
      userBoard[selectedIdx] = num;
      notes[selectedIdx].clear();
      undoStack.push({ idx: selectedIdx, prev, prevNotes, isNote: false });
      if (num !== 0) checkCompletion();
    }

    renderCell(selectedIdx);
    highlightCells();
  }

  /* ── Undo last move ── */
  function undo() {
    if (!undoStack.length) return;
    const { idx, prev, prevNotes } = undoStack.pop();
    userBoard[idx] = prev;
    notes[idx]     = new Set(prevNotes);
    renderCell(idx);
    highlightCells();
  }

  /* ── Hint: fill one random incorrect/empty cell ── */
  function hint() {
    if (hintsLeft <= 0) return;
    const candidates = [];
    for (let i = 0; i < size * size; i++) {
      if (!givenSet.has(i) && userBoard[i] !== solution[i]) candidates.push(i);
    }
    if (!candidates.length) return;

    startTimer();
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    undoStack.push({ idx, prev: userBoard[idx], prevNotes: new Set(notes[idx]) });
    userBoard[idx] = solution[idx];
    notes[idx].clear();
    hintsLeft--;
    renderCell(idx);
    updateUI();
    select(idx);
    checkCompletion();
  }

  /* ── Check: highlight all errors ── */
  function checkBoard() {
    document.querySelectorAll('.cell').forEach((cell, i) => {
      if (givenSet.has(i) || userBoard[i] === 0) { cell.classList.remove('error'); return; }
      cell.classList.toggle('error', userBoard[i] !== solution[i]);
    });
  }

  /* ── Reveal full solution ── */
  function reveal() {
    stopTimer();
    userBoard = [...solution];
    notes     = Array.from({ length: size * size }, () => new Set());
    renderAll();
    highlightCells();
  }

  /* ── Clear all stats ── */
  function clearAll() {
    if (!confirm('Clear all stats and start fresh?')) return;
    clearAllStats();
    updateStatsUI();
  }

  /* ── Completion check ── */
  function checkCompletion() {
    if (userBoard.every((v, i) => v === solution[i])) {
      stopTimer();
      recordCompleted(diff, size, elapsed);
      setTimeout(() => {
        showComplete();
        launchConfetti();
        updateStatsUI();
      }, 300);
    }
  }

  /* ── Render helpers ── */
  function renderAll() {
    for (let i = 0; i < size * size; i++) renderCell(i);
  }

  function renderCell(i) {
    const cell = document.querySelector(`.cell[data-idx="${i}"]`);
    if (!cell) return;
    cell.classList.remove('given', 'user-input', 'error');
    cell.innerHTML = '';

    if (givenSet.has(i)) {
      cell.classList.add('given');
      cell.textContent = puzzle[i];
    } else if (userBoard[i] !== 0) {
      cell.classList.add('user-input');
      cell.textContent = userBoard[i];
      // Inline validation
      const copy = userBoard.map((v, j) => j === i ? 0 : v);
      if (!isValidPlace(copy, i, userBoard[i], size)) cell.classList.add('error');
    } else if (notes[i].size > 0) {
      // Render pencil notes as mini 3×3 grid
      const ng = document.createElement('div');
      ng.className = 'notes-grid';
      for (let n = 1; n <= 9; n++) {
        const sp = document.createElement('span');
        sp.textContent = notes[i].has(n) ? n : '';
        ng.appendChild(sp);
      }
      cell.appendChild(ng);
    }
  }

  function updateUI() {
    el('hint-left').textContent  = `(${hintsLeft})`;
    el('btn-hint').disabled      = hintsLeft <= 0;
  }

  /* ── Public API ── */
  return {
    init, newGame, reset, undo, hint, checkBoard, reveal, clearAll, enter,
    togglePencil() {
      pencilMode = !pencilMode;
      el('btn-pencil').classList.toggle('active', pencilMode);
    },
    getSize()    { return size; },
    getDiff()    { return diff; },
    getElapsed() { return elapsed; }
  };

})();

/* =============================================
   STATS UI — update side panel display
   ============================================= */
function updateStatsUI() {
  const diff = Game.getDiff ? Game.getDiff() : chosenLevel;
  const size = Game.getSize ? Game.getSize() : chosenSize;
  const s    = loadStats();
  const k    = `${diff}_${size}`;
  if (!s[k]) s[k] = { played: 0, completed: 0, bestTime: null, totalTime: 0 };
  const d    = s[k];

  const pct = d.played    ? Math.round(d.completed / d.played * 100) + '%' : '—';
  const avg = d.completed ? fmtTime(Math.round(d.totalTime / d.completed)) : '—';

  el('stat-played').textContent    = d.played;
  el('stat-completed').textContent = d.completed;
  el('stat-winrate').textContent   = pct;
  el('stat-best').textContent      = fmtTime(d.bestTime);
  el('stat-avg').textContent       = avg;
}

/* =============================================
   COMPLETION OVERLAY
   ============================================= */
function showComplete() {
  el('complete-time').textContent = fmtTime(Game.getElapsed());
  el('complete-info').textContent =
    `${Game.getDiff().toUpperCase()} · ${Game.getSize()}×${Game.getSize()}`;
  el('overlay-complete').classList.add('show');
}

function closeComplete() {
  el('overlay-complete').classList.remove('show');
}

/* =============================================
   CONFETTI
   ============================================= */
function launchConfetti() {
  const container = el('confetti-layer');
  container.innerHTML = '';
  const colors = ['#b8943c', '#d4aa4e', '#f2ead8', '#1a2744', '#e8dcc4', '#2e4070', '#fff'];

  for (let i = 0; i < 90; i++) {
    const p  = document.createElement('div');
    p.className = 'confetti-piece';
    const sz = 6 + Math.random() * 10;
    p.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${sz}px; height:${sz}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration:${1.8 + Math.random() * 2.5}s;
      animation-delay:${Math.random() * 1.4}s;
    `;
    container.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

/* =============================================
   EVENT WIRING
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {

  /* Theme toggle */
  const themeBtn  = el('theme-toggle');
  const thumbEl   = el('toggle-thumb');
  if (localStorage.getItem('sudoku_theme') === 'light') {
    document.body.classList.add('light');
    thumbEl.textContent = '☀️';
  }
  themeBtn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    thumbEl.textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem('sudoku_theme', isLight ? 'light' : 'dark');
  });

  /* Game controls */
  el('btn-new').addEventListener('click',     () => Game.newGame());
  el('btn-reset').addEventListener('click',   () => Game.reset());
  el('btn-undo').addEventListener('click',    () => Game.undo());
  el('btn-pencil').addEventListener('click',  () => Game.togglePencil());
  el('btn-hint').addEventListener('click',    () => Game.hint());
  el('btn-check').addEventListener('click',   () => Game.checkBoard());
  el('btn-reveal').addEventListener('click',  () => {
    if (confirm('Reveal the full solution?')) Game.reveal();
  });
  el('btn-clearall').addEventListener('click', () => Game.clearAll());

  /* Keyboard input */
  document.addEventListener('keydown', e => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9)                              { Game.enter(num); return; }
    if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { Game.enter(0);   return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z')        { e.preventDefault(); Game.undo(); return; }
    if (e.key === 'p')                                     { Game.togglePencil(); return; }

    // Arrow key navigation
    const sel  = document.querySelector('.cell.selected');
    if (!sel) return;
    const size = Game.getSize();
    const idx  = parseInt(sel.dataset.idx);
    let next   = -1;
    if (e.key === 'ArrowRight') next = idx % size < size - 1 ? idx + 1 : idx;
    if (e.key === 'ArrowLeft')  next = idx % size > 0        ? idx - 1 : idx;
    if (e.key === 'ArrowDown')  next = idx < size * (size - 1) ? idx + size : idx;
    if (e.key === 'ArrowUp')    next = idx >= size              ? idx - size : idx;
    if (next >= 0) {
      e.preventDefault();
      document.querySelector(`.cell[data-idx="${next}"]`)?.click();
    }
  });

});
