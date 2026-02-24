# 🧩 SUDOKU

A clean, fully-featured Sudoku web app. No frameworks, no build step.

## File Structure

```
sudoku-game/
├── index.html        ← markup & layout
├── css/
│   └── style.css     ← all styles (dark/light, responsive)
├── js/
│   ├── engine.js     ← puzzle generator, solver, stats persistence
│   └── game.js       ← game logic, UI rendering, event wiring
├── README.md
├── .gitignore
└── LICENSE
```


Open https://sudokugame0.netlify.app/


## Features
- Landing page → pick difficulty → pick grid size → play
- 3×3 and 9×9 grids with unique-solution guarantee
- Real-time error highlighting, pencil/notes mode
- Undo, hints (3/game), check board, reveal solution
- Live timer + timeline progress bar
- Persistent stats per difficulty+size (localStorage)
- Dark ↔ Light theme toggle
- ← Back button always visible
- Number pad directly below the grid
- Confetti on completion
- Fully responsive

## License
MIT
