import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  startGame,
  handleKey,
  handleFocusLoss,
  update,
} from '../src/game-logic.js';
import { makeState, makeWord, seqRng, noRng, SMALL_INDEX, snapshot } from './fixtures.js';

// ---- AC-1.1 ----

test('AC-1.1: initial state is START with no words', () => {
  const s = createInitialState();
  assert.equal(s.status, 'START');
  assert.deepEqual(s.words, []);
  assert.equal(s.targetId, null);
  assert.equal(s.typed, '');
});

test('AC-1.1: initial state has the documented fields and values (DESIGN 4.2)', () => {
  assert.deepEqual(createInitialState(), {
    status: 'START',
    score: 0,
    lives: 3,
    level: 1,
    elapsedSec: 0,
    words: [],
    nextWordId: 1,
    targetId: null,
    typed: '',
    wordsDestroyed: 0,
    typos: 0,
    correctKeystrokes: 0,
    spawnTimerMs: 0,
    flashMs: 0,
    bannerMs: 0,
    gameOverMs: 0,
    skipNextDt: false,
  });
});

test('AC-1.1: createInitialState returns a fresh object each call', () => {
  const a = createInitialState();
  const b = createInitialState();
  assert.notEqual(a, b);
  assert.notEqual(a.words, b.words);
});

// ---- AC-1.2 ----

test('AC-1.2: Enter in START changes the state to PLAYING', () => {
  assert.equal(handleKey(createInitialState(), 'Enter').status, 'PLAYING');
});

test('AC-1.2: any other key in START does nothing', () => {
  const s0 = createInitialState();
  for (const k of ['a', 'Z', ' ', '1', 'Escape', 'Backspace', 'ArrowDown', 'Shift', 'Tab', 'Control']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${k}`);
  }
});

// ---- AC-1.3 ----

test('AC-1.3: PLAYING begins with score 0, lives 3, level 1, elapsed 0, no words, no target, counters 0', () => {
  const s = handleKey(createInitialState(), 'Enter');
  assert.equal(s.status, 'PLAYING');
  assert.equal(s.score, 0);
  assert.equal(s.lives, 3);
  assert.equal(s.level, 1);
  assert.equal(s.elapsedSec, 0);
  assert.deepEqual(s.words, []);
  assert.equal(s.targetId, null);
  assert.equal(s.typed, '');
  assert.equal(s.wordsDestroyed, 0);
  assert.equal(s.typos, 0);
  assert.equal(s.correctKeystrokes, 0);
});

test('AC-1.3 / AC-1.4 / Q-8: startGame sets spawnTimerMs = 0 and skipNextDt = true', () => {
  const s = startGame();
  assert.equal(s.status, 'PLAYING');
  assert.equal(s.spawnTimerMs, 0);
  assert.equal(s.skipNextDt, true);
  assert.equal(s.flashMs, 0);
  assert.equal(s.bannerMs, 0);
  assert.equal(s.gameOverMs, 0);
});

test('AC-1.3: startGame equals the initial state except status, spawn timer and skipNextDt', () => {
  assert.deepEqual(startGame(), { ...createInitialState(), status: 'PLAYING', spawnTimerMs: 0, skipNextDt: true });
});

// ---- AC-6.4 / AC-6.5 restart ----

function gameOverState(gameOverMs) {
  return makeState({
    status: 'GAME_OVER',
    lives: 0,
    score: 1230,
    level: 4,
    elapsedSec: 100,
    words: [makeWord(5, 'cat', 300), makeWord(6, 'tree', 200)],
    nextWordId: 7,
    wordsDestroyed: 12,
    typos: 9,
    correctKeystrokes: 60,
    spawnTimerMs: 400,
    flashMs: 300,
    bannerMs: 500,
    gameOverMs,
  });
}

test('AC-6.5: Enter is ignored in GAME_OVER at 0 ms', () => {
  const s0 = gameOverState(0);
  assert.deepEqual(handleKey(s0, 'Enter'), s0);
});

test('AC-6.5: Enter is ignored in GAME_OVER at 499 ms', () => {
  const s0 = gameOverState(499);
  assert.deepEqual(handleKey(s0, 'Enter'), s0);
});

test('AC-6.5: Enter is accepted in GAME_OVER at exactly 500 ms', () => {
  assert.equal(handleKey(gameOverState(500), 'Enter').status, 'PLAYING');
});

test('AC-6.4: Enter after the guard starts a fresh game directly in PLAYING; nothing carries over', () => {
  const s1 = handleKey(gameOverState(750), 'Enter');
  assert.deepEqual(s1, startGame());
});

test('AC-6.4: other keys in GAME_OVER do nothing even after the guard', () => {
  const s0 = gameOverState(5000);
  for (const k of ['a', ' ', 'Escape', 'Backspace', '1']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${k}`);
  }
});

test('AC-6.5 / Q-6: guard measured by update frames in GAME_OVER (4 x 100 ms ignored, 5th accepted)', () => {
  let s = gameOverState(0);
  for (let i = 0; i < 4; i++) s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(handleKey(s, 'Enter').status, 'GAME_OVER');
  s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(handleKey(s, 'Enter').status, 'PLAYING');
});

test('AC-6.5 / Q-6: one long frame (2 s) counts only 100 ms toward the guard', () => {
  let s = gameOverState(0);
  s = update(s, 2.0, noRng(), SMALL_INDEX);
  assert.equal(handleKey(s, 'Enter').status, 'GAME_OVER');
});

test('AC-6.1 / AC-6.4: full cycle START -> PLAYING -> GAME_OVER -> PLAYING', () => {
  let s = handleKey(createInitialState(), 'Enter');
  s = update(s, 0.016, seqRng([0, 0, 0]), SMALL_INDEX); // first word at y = 0
  assert.equal(s.words.length, 1);
  s = { ...s, lives: 1, words: [{ ...s.words[0], y: 599 }], spawnTimerMs: 1e9 };
  s = update(s, 0.05, noRng(), SMALL_INDEX);
  assert.equal(s.status, 'GAME_OVER');
  for (let i = 0; i < 5; i++) s = update(s, 0.1, noRng(), SMALL_INDEX);
  s = handleKey(s, 'Enter');
  assert.deepEqual(s, startGame());
});

test('DESIGN 4.3: Enter in PLAYING is a no-op (no restart)', () => {
  const s0 = makeState({ score: 100, words: [makeWord(1, 'cat', 100)] });
  assert.deepEqual(handleKey(s0, 'Enter'), s0);
});

// ---- AC-7.3 score invariant ----

test('AC-7.3: score stays a non-negative integer over a played sequence', () => {
  let s = makeState({ words: [makeWord(1, 'cat', 590), makeWord(2, 'tree', 100)], spawnTimerMs: 1e9 });
  const steps = [
    (x) => handleKey(x, 'z'),
    (x) => handleKey(x, 't'),
    (x) => handleKey(x, 'Backspace'),
    (x) => update(x, 0.1, noRng(), SMALL_INDEX),
    (x) => update(x, 0.1, noRng(), SMALL_INDEX),
    (x) => update(x, 0.1, noRng(), SMALL_INDEX), // cat missed
    (x) => handleKey(x, 'Escape'),
    (x) => ['t', 'r', 'e', 'e'].reduce(handleKey, x),
  ];
  for (const step of steps) {
    s = step(s);
    assert.ok(Number.isInteger(s.score) && s.score >= 0);
  }
  assert.equal(s.score, 40);
  assert.equal(s.lives, 2);
});

// ---- Immutability (DESIGN 3 / 9) ----

test('DESIGN 3: handleKey does not mutate its input', () => {
  const inputs = [
    [makeState({ words: [makeWord(1, 'cat', 100)] }), 'c'],
    [makeState({ words: [makeWord(1, 'cat', 100)], targetId: 1, typed: 'ca' }), 't'],
    [makeState({ words: [makeWord(1, 'cat', 100)], targetId: 1, typed: 'ca' }), 'x'],
    [makeState({ words: [makeWord(1, 'cat', 100)], targetId: 1, typed: 'ca' }), 'Backspace'],
    [makeState({ words: [makeWord(1, 'cat', 100)], targetId: 1, typed: 'ca' }), 'Escape'],
    [createInitialState(), 'Enter'],
    [makeState({ status: 'PAUSED' }), 'Enter'],
    [makeState({ status: 'GAME_OVER', lives: 0, gameOverMs: 600 }), 'Enter'],
  ];
  for (const [s0, key] of inputs) {
    const before = snapshot(s0);
    handleKey(s0, key);
    assert.deepEqual(s0, before, `key ${key} in ${before.status}`);
  }
});

test('DESIGN 3: update does not mutate its input', () => {
  const s0 = makeState({
    words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 100)],
    targetId: 1,
    typed: 'c',
    elapsedSec: 29.95,
    spawnTimerMs: 10,
  });
  const before = snapshot(s0);
  update(s0, 0.1, seqRng([0, 0.81 /* ant */, 0]), SMALL_INDEX);
  assert.deepEqual(s0, before);
  const go = makeState({ status: 'GAME_OVER', lives: 0 });
  const goBefore = snapshot(go);
  update(go, 0.1, noRng(), SMALL_INDEX);
  assert.deepEqual(go, goBefore);
});

test('DESIGN 3: handleFocusLoss does not mutate its input', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)] });
  const before = snapshot(s0);
  handleFocusLoss(s0);
  assert.deepEqual(s0, before);
});
