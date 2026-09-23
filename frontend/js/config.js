export const DISPLAY = { width: 800, height: 480 };

// Position/Größe des Walzen-Ausschnitts im Rahmenbild (assets/frame/frame.png).
// Muss angepasst werden, sobald das finale Rahmenbild feststeht.
export const REEL_WINDOW = { top: 100, left: 100, width: 600, height: 280 };

// 5 Spalten x 3 Reihen - muss mit backend/config.py (GRID_COLS/GRID_ROWS) übereinstimmen.
export const GRID_COLS = 5;
export const GRID_ROWS = 3;

// Gewinnlinien als [spalte, reihe]-Koordinaten - Reihenfolge/Index muss exakt mit
// PAYLINES in backend/config.py übereinstimmen, da der Server nur den Line-Index
// zurückgibt (spin_result.winning_lines) und das Frontend die Koordinaten dafür
// zum Zeichnen der Gewinnlinie braucht.
export const PAYLINES = [
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], // mittlere Reihe
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], // obere Reihe
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], // untere Reihe
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]], // V-Form
  [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]], // Lambda-Form (umgekehrtes V)
];

// Symbolnamen müssen exakt mit SYMBOLS in backend/config.py übereinstimmen.
export const SYMBOL_ASSETS = {
  cherry: "assets/sprites/cherry.png",
  lemon: "assets/sprites/lemon.png",
  bell: "assets/sprites/bell.png",
  star: "assets/sprites/star.png",
  seven: "assets/sprites/seven.png",
};

export const SYMBOLS = Object.keys(SYMBOL_ASSETS);
