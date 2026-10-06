import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleKey,
  normalizeKey,
  findTargetFor,
  getTarget,
  update,
  startGame,
  createInitialState,
} from '../src/game-logic.js';
import { makeState, makeWord, noRng, SMALL_INDEX } from './fixtures.js';

const typeAll = (state, keys) => keys.reduce((s, k) => handleKey(s, k), state);

// ---- normalizeKey (AC-3.1) ----

test('AC-3.1: normalizeKey keeps lowercase a-z', () => {
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
    assert.equal(normalizeKey(ch), ch);
  }
});

test('AC-3.1 / Q-5: normalizeKey lowercases uppercase letters (Shift + letter counts)', () => {
  assert.equal(normalizeKey('A'), 'a');
  assert.equal(normalizeKey('Z'), 'z');
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    assert.equal(normalizeKey(ch), ch.toLowerCase());
  }
});

test('AC-3.1: normalizeKey passes Enter, Backspace, Escape through', () => {
  assert.equal(normalizeKey('Enter'), 'Enter');
  assert.equal(normalizeKey('Backspace'), 'Backspace');
  assert.equal(normalizeKey('Escape'), 'Escape');
});

test('AC-3.1: normalizeKey returns null for digits, space, punctuation, arrows, modifiers alone', () => {
  const ignored = [
    '0', '1', '9', ' ', '.', ',', ';', "'", '-', '/', '[', '`',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'F1', 'Delete', 'Home',
    'Dead', 'Unidentified', '', 'é', 'ß',
  ];
  for (const k of ignored) {
    assert.equal(normalizeKey(k), null, `key ${JSON.stringify(k)}`);
  }
});

// ---- findTargetFor / getTarget (AC-3.2) ----

test('AC-3.2: findTargetFor picks the word with the largest y among matching first letters', () => {
  const words = [makeWord(1, 'cat', 100), makeWord(2, 'cow', 300), makeWord(3, 'dog', 500)];
  assert.equal(findTargetFor(words, 'c').id, 2);
});

test('AC-3.2: findTargetFor tie on y goes to the word that spawned first (smallest id)', () => {
  // Array order deliberately puts the later-spawned word first.
  const words = [makeWord(7, 'cow', 200), makeWord(4, 'cat', 200), makeWord(9, 'car', 100)];
  assert.equal(findTargetFor(words, 'c').id, 4);
});

test('AC-3.2: findTargetFor returns null when no word starts with the letter', () => {
  assert.equal(findTargetFor([makeWord(1, 'cat', 100)], 'z'), null);
  assert.equal(findTargetFor([], 'a'), null);
});

test('AC-3.2: getTarget returns the target word or null', () => {
  const w = makeWord(5, 'cat', 100);
  assert.equal(getTarget(makeState({ words: [w] })), null);
  assert.deepEqual(getTarget(makeState({ words: [w], targetId: 5, typed: 'c' })), w);
});

// ---- AC-3.2 target selection via handleKey ----

test('AC-3.2: with no target, typing a letter selects the matching word and sets typed prefix', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100), makeWord(2, 'dog', 50)] });
  const s1 = handleKey(s0, 'c');
  assert.equal(s1.targetId, 1);
  assert.equal(s1.typed, 'c');
  assert.equal(s1.correctKeystrokes, 1);
  assert.equal(s1.typos, 0);
  assert.equal(s1.score, 0);
});

test('AC-3.2: selection prefers the word closest to the bottom', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100), makeWord(2, 'cow', 400)] });
  assert.equal(handleKey(s0, 'c').targetId, 2);
});

test('AC-3.2: selection tie on y goes to the word that spawned first', () => {
  const s0 = makeState({ words: [makeWord(3, 'cow', 250), makeWord(2, 'cat', 250)] });
  assert.equal(handleKey(s0, 'c').targetId, 2);
});

test('AC-3.1: uppercase letter selects a target like lowercase', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)] });
  const s1 = handleKey(s0, 'C');
  assert.equal(s1.targetId, 1);
  assert.equal(s1.typed, 'c');
});

// ---- AC-3.3 target lock ----

test('AC-3.3: target "cat" with prefix "ca", typing "r" is a typo and does not switch to "car"', () => {
  const s0 = makeState({
    words: [makeWord(1, 'cat', 100), makeWord(2, 'car', 300)],
    targetId: 1,
    typed: 'ca',
    correctKeystrokes: 2,
  });
  const s1 = handleKey(s0, 'r');
  assert.equal(s1.targetId, 1);
  assert.equal(s1.typed, 'ca');
  assert.equal(s1.typos, 1);
  assert.equal(s1.correctKeystrokes, 2);
  assert.equal(s1.words.length, 2);
  assert.equal(s1.score, 0);
});

test('AC-3.3: target stays locked even when another word is closer to the bottom', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)] });
  let s = handleKey(s0, 'c');
  s = { ...s, words: [...s.words, makeWord(2, 'cow', 590)] };
  s = handleKey(s, 'a');
  assert.equal(s.targetId, 1);
  assert.equal(s.typed, 'ca');
});

// ---- AC-3.4 correct keystroke ----

test('AC-3.4: correct next letter is appended to the typed prefix', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 't', correctKeystrokes: 1 });
  const s1 = handleKey(s0, 'r');
  assert.equal(s1.typed, 'tr');
  assert.equal(s1.targetId, 1);
  assert.equal(s1.correctKeystrokes, 2);
  assert.equal(s1.typos, 0);
  assert.equal(s1.score, 0);
});

test('AC-3.4: uppercase correct letter is accepted (case-insensitive)', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 't' });
  assert.equal(handleKey(s0, 'R').typed, 'tr');
});

// ---- AC-3.5 typo with target ----

test('AC-3.5: wrong letter with a target increments typos only', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 'tr', lives: 3, score: 50 });
  const s1 = handleKey(s0, 'x');
  assert.equal(s1.typed, 'tr');
  assert.equal(s1.targetId, 1);
  assert.equal(s1.typos, 1);
  assert.equal(s1.lives, 3);
  assert.equal(s1.score, 50);
  assert.equal(s1.correctKeystrokes, s0.correctKeystrokes);
});

test('AC-3.5: repeating an already-typed letter (not the next one) is a typo', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 'tr' });
  const s1 = handleKey(s0, 'r');
  assert.equal(s1.typed, 'tr');
  assert.equal(s1.typos, 1);
});

// ---- AC-3.6 typo without target ----

test('AC-3.6: no target and no word with that first letter -> typo, nothing else changes', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)] });
  const s1 = handleKey(s0, 'z');
  assert.deepEqual(s1, { ...s0, typos: 1 });
});

test('AC-3.6: no target and empty playfield -> typo', () => {
  const s0 = makeState({ words: [] });
  const s1 = handleKey(s0, 'a');
  assert.deepEqual(s1, { ...s0, typos: 1 });
});

test('AC-3.6: a letter matching a non-first letter of a word does not select it', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)] });
  const s1 = handleKey(s0, 'a');
  assert.equal(s1.targetId, null);
  assert.equal(s1.typed, '');
  assert.equal(s1.typos, 1);
});

// ---- AC-3.7 Backspace ----

test('AC-3.7: Backspace removes the last typed character', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 'tre', typos: 2, score: 40, correctKeystrokes: 3 });
  const s1 = handleKey(s0, 'Backspace');
  assert.equal(s1.typed, 'tr');
  assert.equal(s1.targetId, 1);
  assert.equal(s1.typos, 2);
  assert.equal(s1.score, 40);
  assert.equal(s1.correctKeystrokes, 3);
});

test('AC-3.7: Backspace emptying the prefix clears the target', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 't' });
  const s1 = handleKey(s0, 'Backspace');
  assert.equal(s1.typed, '');
  assert.equal(s1.targetId, null);
  assert.equal(s1.words.length, 1, 'word stays active');
});

test('AC-3.7: Backspace with no target does nothing', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], typos: 1 });
  assert.deepEqual(handleKey(s0, 'Backspace'), s0);
});

test('AC-3.7 / AC-4.4: after Backspace clears target, a new letter selects a new target', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100), makeWord(2, 'dog', 50)], targetId: 1, typed: 't' });
  const s1 = handleKey(handleKey(s0, 'Backspace'), 'd');
  assert.equal(s1.targetId, 2);
  assert.equal(s1.typed, 'd');
});

// ---- AC-3.8 Escape ----

test('AC-3.8: Escape clears the target and prefix; the word stays at the same position', () => {
  const w = makeWord(1, 'tree', 123.5, 77);
  const s0 = makeState({ words: [w], targetId: 1, typed: 'tre', typos: 2, score: 60 });
  const s1 = handleKey(s0, 'Escape');
  assert.equal(s1.targetId, null);
  assert.equal(s1.typed, '');
  assert.deepEqual(s1.words, [w]);
  assert.equal(s1.typos, 2);
  assert.equal(s1.score, 60);
});

test('AC-3.8: Escape with no target changes nothing', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)] });
  assert.deepEqual(handleKey(s0, 'Escape'), s0);
});

// ---- AC-3.1 ignored keys in PLAYING ----

test('AC-3.1: digits, space, punctuation, arrows, modifiers are ignored in PLAYING', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 't', typos: 1 });
  for (const k of ['1', ' ', '.', ';', 'ArrowUp', 'ArrowLeft', 'Shift', 'Control', 'Alt', 'Meta', 'Tab']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${JSON.stringify(k)}`);
  }
});

// ---- AC-3.10 input per state ----

test('AC-3.10: Enter in PLAYING does nothing', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], targetId: 1, typed: 't' });
  assert.deepEqual(handleKey(s0, 'Enter'), s0);
});

test('AC-3.10: letters, Backspace, Escape are ignored in START', () => {
  const s0 = createInitialState();
  for (const k of ['a', 'Z', 'Backspace', 'Escape', '1', ' ']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${k}`);
  }
});

test('AC-3.10: letters, Backspace, Escape are ignored in GAME_OVER', () => {
  const s0 = makeState({ status: 'GAME_OVER', lives: 0, gameOverMs: 1000, words: [makeWord(1, 'cat', 300)] });
  for (const k of ['c', 'a', 'Backspace', 'Escape', '1', ' ']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${k}`);
  }
});

test('AC-3.10: letters, Backspace, Escape are ignored in PAUSED', () => {
  const s0 = makeState({ status: 'PAUSED', words: [makeWord(1, 'cat', 300)], targetId: 1, typed: 'c' });
  for (const k of ['a', 'x', 'Backspace', 'Escape', '1', ' ']) {
    assert.deepEqual(handleKey(s0, k), s0, `key ${k}`);
  }
});

// ---- AC-3.11 key repeat ----

test('AC-3.11: repeated keydowns are each handled (correct then typo)', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], targetId: 1, typed: 'c', correctKeystrokes: 1 });
  const s1 = typeAll(s0, ['a', 'a', 'a']);
  assert.equal(s1.typed, 'ca');
  assert.equal(s1.correctKeystrokes, 2);
  assert.equal(s1.typos, 2);
});

test('AC-3.11: repeated typo keydowns each count as a typo', () => {
  const s0 = makeState({ words: [] });
  const s1 = typeAll(s0, ['q', 'q', 'q', 'q']);
  assert.equal(s1.typos, 4);
});

test('AC-3.11: repeated letters in a word ("tree") are typed by repeated keystrokes', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)] });
  const s1 = typeAll(s0, ['t', 'r', 'e']);
  assert.equal(s1.typed, 'tre');
  const s2 = handleKey(s1, 'e');
  assert.equal(s2.words.length, 0);
  assert.equal(s2.wordsDestroyed, 1);
});

// ---- AC-4.x destroy ----

test('AC-4.1: typing the full word destroys it in the same event', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100), makeWord(2, 'dog', 50)] });
  const s1 = typeAll(s0, ['c', 'a', 't']);
  assert.deepEqual(s1.words.map((w) => w.id), [2]);
  assert.equal(s1.targetId, null);
  assert.equal(s1.typed, '');
  assert.equal(s1.wordsDestroyed, 1);
  assert.equal(s1.correctKeystrokes, 3);
  assert.equal(s1.typos, 0);
});

test('AC-4.2 / AC-7.1: destroying "cat" at level 1 adds 30 points in the same event', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], targetId: 1, typed: 'ca', score: 100 });
  const s1 = handleKey(s0, 't');
  assert.equal(s1.score, 130);
});

test('AC-7.1: destroying "planet" at level 4 adds 240', () => {
  const s0 = makeState({ level: 4, elapsedSec: 95, words: [makeWord(1, 'planet', 100)], targetId: 1, typed: 'plane' });
  assert.equal(handleKey(s0, 't').score, 240);
});

test('AC-7.1: destroying "keyboard" at level 10 adds 800', () => {
  const s0 = makeState({ level: 10, elapsedSec: 280, words: [makeWord(1, 'keyboard', 100)], targetId: 1, typed: 'keyboar' });
  assert.equal(handleKey(s0, 'd').score, 800);
});

test('AC-7.2: points use the level at destroy time, not at spawn time', () => {
  // Word spawned during level 1, destroyed after reaching level 2.
  let s = makeState({ level: 1, elapsedSec: 29.9375, spawnTimerMs: 1e9, words: [makeWord(1, 'tree', 100)] });
  s = typeAll(s, ['t', 'r', 'e']);
  s = update(s, 0.0625, noRng(), SMALL_INDEX);
  assert.equal(s.level, 2);
  s = handleKey(s, 'e');
  assert.equal(s.score, 80);
});

test('AC-4.3: a word at y = 599.5 destroyed by a key is never counted as missed', () => {
  let s = makeState({ words: [makeWord(1, 'cat', 599.5)], targetId: 1, typed: 'ca', spawnTimerMs: 1e9 });
  s = handleKey(s, 't');
  assert.equal(s.wordsDestroyed, 1);
  s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(s.lives, 3);
  assert.equal(s.score, 30);
});

test('AC-4.4: after a destroy, the next letter selects a new target by AC-3.2', () => {
  const s0 = makeState({
    words: [makeWord(1, 'cat', 300), makeWord(2, 'cow', 100), makeWord(3, 'car', 200)],
  });
  let s = typeAll(s0, ['c', 'a', 't']);
  assert.equal(s.wordsDestroyed, 1);
  s = handleKey(s, 'c');
  assert.equal(s.targetId, 3, 'car is now the lowest c-word');
  assert.equal(s.typed, 'c');
});

test('AC-7.3: typos, Backspace and Escape never change the score', () => {
  const s0 = makeState({ words: [makeWord(1, 'tree', 100)], score: 70 });
  const keys = ['z', 't', 'x', 'r', 'Backspace', 'Backspace', 'Backspace', 't', 'Escape', 'q'];
  let s = s0;
  for (const k of keys) {
    s = handleKey(s, k);
    assert.equal(s.score, 70, `after ${k}`);
  }
});

test('AC-6.3: correct keystrokes count target selection and AC-3.4 letters; typos counted separately', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)] });
  const s1 = typeAll(s0, ['z', 'c', 'x', 'a', 't']);
  assert.equal(s1.correctKeystrokes, 3);
  assert.equal(s1.typos, 2);
});

// ---- AC-1.2 Enter in START (input side) ----

test('AC-1.2: Enter in START starts a game (PLAYING)', () => {
  const s1 = handleKey(createInitialState(), 'Enter');
  assert.equal(s1.status, 'PLAYING');
  assert.deepEqual(s1, startGame());
});
