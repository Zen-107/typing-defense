import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleFocusLoss,
  handleKey,
  update,
  createInitialState,
  accuracyPercent,
} from '../src/game-logic.js';
import { makeState, makeWord, seqRng, noRng, lcgRng, SMALL_INDEX } from './fixtures.js';

const DT = 0.0625;

function pausedState(overrides = {}) {
  return handleFocusLoss(makeState(overrides));
}

// ---- AC-10.1 ----

test('AC-10.1: focus loss in PLAYING changes the state to PAUSED immediately', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 300)], score: 50, elapsedSec: 12 });
  const s1 = handleFocusLoss(s0);
  assert.equal(s1.status, 'PAUSED');
});

test('AC-10.1 / AC-10.7: focus loss changes only the status', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 300)], targetId: 1, typed: 'ca', score: 50, typos: 2, spawnTimerMs: 700 });
  const s1 = handleFocusLoss(s0);
  assert.deepEqual(s1, { ...s0, status: 'PAUSED' });
});

// ---- AC-10.2 ----

test('AC-10.2: focus loss in START does nothing', () => {
  const s0 = createInitialState();
  assert.deepEqual(handleFocusLoss(s0), s0);
});

test('AC-10.2: focus loss in GAME_OVER does nothing', () => {
  const s0 = makeState({ status: 'GAME_OVER', lives: 0, gameOverMs: 200, score: 90 });
  assert.deepEqual(handleFocusLoss(s0), s0);
});

test('AC-10.2: focus loss in PAUSED does nothing (blur + visibilitychange both firing)', () => {
  const s1 = pausedState({ words: [makeWord(1, 'cat', 300)] });
  assert.deepEqual(handleFocusLoss(s1), s1);
});

// ---- AC-10.3 freezing ----

test('AC-10.3: a 60-second pause changes nothing (positions, time, level, timers)', () => {
  const s0 = pausedState({
    elapsedSec: 29.99,
    words: [makeWord(1, 'cat', 300), makeWord(2, 'dog', 599.9)],
    spawnTimerMs: 700,
    flashMs: 150,
    bannerMs: 400,
  });
  let s = update(s0, 60, noRng(), SMALL_INDEX);
  assert.deepEqual(s, s0);
  for (let i = 0; i < 600; i++) s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.deepEqual(s, s0);
});

test('AC-10.3: no word is missed and no life is lost while PAUSED', () => {
  const s0 = pausedState({ words: [makeWord(1, 'cat', 599.99)], lives: 1 });
  const s1 = update(s0, 60, noRng(), SMALL_INDEX);
  assert.equal(s1.lives, 1);
  assert.equal(s1.status, 'PAUSED');
  assert.equal(s1.words.length, 1);
});

test('AC-10.3: no word spawns while PAUSED even if the spawn timer is due', () => {
  const s0 = pausedState({ spawnTimerMs: 0 });
  const s1 = update(s0, 60, noRng(), SMALL_INDEX);
  assert.equal(s1.words.length, 0);
});

test('AC-10.3: 700 ms left at pause -> next spawn 700 ms of game time after resume', () => {
  let s = pausedState({ spawnTimerMs: 700 });
  s = update(s, 60, noRng(), SMALL_INDEX);
  s = handleKey(s, 'Enter');
  s = update(s, 0.1, noRng(), SMALL_INDEX); // first frame after resume: dt = 0
  assert.equal(s.spawnTimerMs, 700);
  for (let i = 0; i < 6; i++) s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(s.words.length, 0, 'no spawn after 600 ms');
  assert.equal(s.spawnTimerMs, 100);
  s = update(s, 0.1, seqRng([0, 0, 0]), SMALL_INDEX);
  assert.equal(s.words.length, 1, 'spawn at 700 ms');
});

test('AC-10.3: life-lost flash and level banner are frozen while PAUSED and resume counting after', () => {
  let s = pausedState({ flashMs: 200, bannerMs: 600, spawnTimerMs: 1e9 });
  s = update(s, 60, noRng(), SMALL_INDEX);
  assert.equal(s.flashMs, 200);
  assert.equal(s.bannerMs, 600);
  s = handleKey(s, 'Enter');
  s = update(s, 0.1, noRng(), SMALL_INDEX); // dt = 0
  assert.equal(s.flashMs, 200);
  assert.equal(s.bannerMs, 600);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.flashMs, 137.5);
  assert.equal(s.bannerMs, 537.5);
});

test('AC-10.3: the level does not change while PAUSED even across a 30 s boundary', () => {
  let s = pausedState({ elapsedSec: 29.99, spawnTimerMs: 1e9 });
  s = update(s, 60, noRng(), SMALL_INDEX);
  assert.equal(s.level, 1);
  assert.equal(s.elapsedSec, 29.99);
});

// ---- AC-10.5 ----

test('AC-10.5: in PAUSED, letters, Backspace, Escape and other keys change nothing', () => {
  const s0 = pausedState({ words: [makeWord(1, 'cat', 300), makeWord(2, 'dog', 100)], targetId: 1, typed: 'c', correctKeystrokes: 1 });
  for (const k of ['a', 't', 'd', 'z', 'A', 'Backspace', 'Escape', '1', ' ', 'ArrowUp', 'Shift', 'Tab']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${k}`);
  }
});

test('AC-10.5: keys pressed while PAUSED do not count toward accuracy', () => {
  let s = pausedState({ words: [makeWord(1, 'cat', 300)], correctKeystrokes: 3, typos: 1 });
  for (const k of ['c', 'x', 'q', 'a']) s = handleKey(s, k);
  assert.equal(s.correctKeystrokes, 3);
  assert.equal(s.typos, 1);
  assert.equal(accuracyPercent(s.correctKeystrokes, s.typos), 75);
});

// ---- AC-10.6 / AC-10.8 resume ----

test('AC-10.6: Enter in PAUSED resumes to PLAYING and flags dt = 0 for the next update', () => {
  const s1 = handleKey(pausedState(), 'Enter');
  assert.equal(s1.status, 'PLAYING');
  assert.equal(s1.skipNextDt, true);
});

test('AC-10.6: a word at y = 300.0 when paused is still at 300.0 in the first frame after resume', () => {
  let s = pausedState({ words: [makeWord(1, 'cat', 300)], elapsedSec: 12, spawnTimerMs: 1e9 });
  s = update(s, 60, noRng(), SMALL_INDEX);
  s = handleKey(s, 'Enter');
  s = update(s, 1.0, noRng(), SMALL_INDEX);
  assert.equal(s.words[0].y, 300);
  assert.equal(s.elapsedSec, 12);
  assert.equal(s.skipNextDt, false);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.words[0].y, 302.5, 'normal movement from the second frame');
});

test('AC-10.8: Enter is accepted immediately after the pause begins (no guard)', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 300)] });
  const s1 = handleKey(handleFocusLoss(s0), 'Enter');
  assert.equal(s1.status, 'PLAYING');
});

test('AC-10.8: time passing while PAUSED never resumes the game by itself', () => {
  let s = pausedState();
  for (let i = 0; i < 100; i++) s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(s.status, 'PAUSED');
});

// ---- AC-10.7 ----

test('AC-10.7: target and typed prefix survive pause/resume; next correct letter continues the word', () => {
  let s = makeState({ words: [makeWord(1, 'cat', 300), makeWord(2, 'cow', 500)], targetId: 1, typed: 'ca', correctKeystrokes: 2, spawnTimerMs: 1e9 });
  s = handleFocusLoss(s);
  s = update(s, 60, noRng(), SMALL_INDEX);
  s = handleKey(s, 'Enter');
  assert.equal(s.targetId, 1);
  assert.equal(s.typed, 'ca');
  s = update(s, DT, noRng(), SMALL_INDEX);
  s = handleKey(s, 't');
  assert.equal(s.wordsDestroyed, 1);
  assert.equal(s.score, 30);
  assert.deepEqual(s.words.map((w) => w.id), [2]);
});

// ---- AC-10.9 ----

test('AC-10.9: if the last life is lost first, a focus loss in the same frame stays GAME_OVER', () => {
  let s = makeState({ lives: 1, words: [makeWord(1, 'cat', 599)], spawnTimerMs: 1e9 });
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.status, 'GAME_OVER');
  const s2 = handleFocusLoss(s);
  assert.equal(s2.status, 'GAME_OVER');
  assert.deepEqual(s2, s);
});

test('AC-10.9: if the focus loss is handled first, no life is lost while paused', () => {
  let s = makeState({ lives: 1, words: [makeWord(1, 'cat', 599)], spawnTimerMs: 1e9 });
  s = handleFocusLoss(s);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.status, 'PAUSED');
  assert.equal(s.lives, 1);
});

test('AC-10.9: the game-over Enter guard is unaffected (focus loss in GAME_OVER does not reset gameOverMs)', () => {
  let s = makeState({ status: 'GAME_OVER', lives: 0, gameOverMs: 0 });
  for (let i = 0; i < 4; i++) s = update(s, 0.1, noRng(), SMALL_INDEX);
  s = handleFocusLoss(s);
  assert.equal(s.gameOverMs, 400);
  assert.equal(handleKey(s, 'Enter').status, 'GAME_OVER');
  s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(handleKey(s, 'Enter').status, 'PLAYING');
});

// ---- AC-10.10 ----

/**
 * Deterministic script: 60 fps frames; every 40 frames the player types the lowest word fully,
 * plus one typo. If pauseAt is set, a pause (focus loss, 60 s + extra updates, extra keys,
 * Enter) is inserted before that frame.
 */
function playScript({ pauseAt = null, frames = 2400 } = {}) {
  const rng = lcgRng(42);
  let s = handleKey(createInitialState(), 'Enter');
  for (let f = 0; f < frames; f++) {
    if (f === pauseAt) {
      s = handleFocusLoss(s);
      s = update(s, 60, rng, SMALL_INDEX);
      for (let i = 0; i < 20; i++) s = update(s, 0.1, rng, SMALL_INDEX);
      for (const k of ['q', 'Backspace', 'Escape', 'z']) s = handleKey(s, k);
      s = handleFocusLoss(s);
      s = handleKey(s, 'Enter');
      s = update(s, 0.5, rng, SMALL_INDEX); // dt = 0 frame after resume
    }
    s = update(s, 1 / 60, rng, SMALL_INDEX);
    if (s.status !== 'PLAYING') break;
    if (f % 40 === 39 && s.words.length > 0) {
      s = handleKey(s, 'Escape');
      const lowest = [...s.words].sort((a, b) => b.y - a.y || a.id - b.id)[0];
      s = handleKey(s, '1'); // ignored
      s = handleKey(s, 'q'); // typo: no word in SMALL_INDEX starts with q
      for (const ch of lowest.text) s = handleKey(s, ch);
    }
  }
  return s;
}

test('AC-10.10: score, lives, level, destroyed, typos and accuracy match a run without the pause', () => {
  const a = playScript();
  const b = playScript({ pauseAt: 1500 });
  assert.ok(a.wordsDestroyed > 0, 'script actually destroys words');
  assert.equal(b.status, a.status);
  assert.equal(b.score, a.score);
  assert.equal(b.lives, a.lives);
  assert.equal(b.level, a.level);
  assert.equal(b.wordsDestroyed, a.wordsDestroyed);
  assert.equal(b.typos, a.typos);
  assert.equal(b.correctKeystrokes, a.correctKeystrokes);
  assert.equal(accuracyPercent(b.correctKeystrokes, b.typos), accuracyPercent(a.correctKeystrokes, a.typos));
  assert.equal(b.elapsedSec, a.elapsedSec);
  assert.deepEqual(b.words, a.words);
});
