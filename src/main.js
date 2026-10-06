// Browser glue: boot, rAF loop, keyboard and focus-loss listeners.
// The only place where real time and randomness enter the game.
import {
  createInitialState,
  buildWordIndex,
  update,
  handleKey,
  handleFocusLoss,
  normalizeKey,
} from './game-logic.js';
import { WORDS } from './words.js';
import { createRenderer } from './renderer.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const wordsByLength = buildWordIndex(WORDS);
const rng = Math.random;

let state = createInitialState();
let lastTimestamp = null;

const GAME_KEYS = new Set(['Enter', 'Backspace', 'Escape', ' ']);

function onKeyDown(event) {
  // Q-5: leave Ctrl/Alt/Meta combos to the browser; ignore IME composition.
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;

  const key = event.key;
  if (normalizeKey(key) !== null || GAME_KEYS.has(key)) {
    event.preventDefault();
  }

  // Key repeat is intentionally not filtered (AC-3.11).
  const prevStatus = state.status;
  state = handleKey(state, key);
  if (prevStatus !== 'PLAYING' && state.status === 'PLAYING') {
    // Belt and braces: the logic already uses dt = 0 for the first update.
    lastTimestamp = null;
  }
}

function onFocusLoss() {
  state = handleFocusLoss(state);
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('blur', onFocusLoss);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') onFocusLoss();
});

function frame(timestamp) {
  const dtSec = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  state = update(state, dtSec, rng, wordsByLength);
  renderer.render(state);
  requestAnimationFrame(frame);
}

canvas.focus();
requestAnimationFrame(frame);
