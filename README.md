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

## How to Run

Open `index.html` directly in any browser, or use Live Server in VS Code.

```bash
# Optional local server
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo
2. Settings → Pages → Source: `main` branch, `/` root
3. Live at `https://YOUR_USERNAME.github.io/REPO_NAME/`

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
