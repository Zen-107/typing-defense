import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  trySpawn,
  spawnX,
  wordWidth,
  buildWordIndex,
  lengthRange,
} from '../src/game-logic.js';
import { makeState, makeWord, seqRng, noRng, SMALL_INDEX, snapshot } from './fixtures.js';

// SMALL_INDEX[3] = ['cat', 'car', 'dog', 'cow', 'ant'] -> index i is picked by rng value i/5 (+ epsilon).
const pick3 = (i) => i / 5 + 0.01;

// ---- wordWidth / spawnX (AC-2.2) ----

test('AC-2.2: wordWidth is length x CHAR_WIDTH_PX', () => {
  assert.equal(wordWidth('cat'), 3 * CONFIG.CHAR_WIDTH_PX);
  assert.equal(wordWidth('keyboard'), 8 * CONFIG.CHAR_WIDTH_PX);
});

test('AC-2.2: spawnX with r = 0 puts the word at the 10 px left margin', () => {
  assert.equal(spawnX('keyboard', 0), 10);
  assert.equal(spawnX('cat', 0), 10);
});

test('AC-2.2: spawnX with r -> 1 keeps the whole word at least 10 px from the right edge', () => {
  for (const text of ['cat', 'tree', 'apple', 'planet', 'monster', 'keyboard']) {
    const x = spawnX(text, 0.999999);
    assert.ok(x >= 10, `${text} left`);
    assert.ok(x + wordWidth(text) <= 790, `${text} right edge ${x + wordWidth(text)}`);
  }
});

test('AC-2.2: spawnX follows MARGIN_X + r * (800 - 20 - width)', () => {
  const w = wordWidth('planet');
  assert.equal(spawnX('planet', 0.5), 10 + 0.5 * (780 - w));
});

// ---- buildWordIndex (AC-2.3) ----

test('AC-2.3: buildWordIndex groups words by length', () => {
  const idx = buildWordIndex(['cat', 'tree', 'dog', 'apple', 'keyboard']);
  assert.deepEqual([...idx[3]].sort(), ['cat', 'dog']);
  assert.deepEqual([...idx[4]], ['tree']);
  assert.deepEqual([...idx[5]], ['apple']);
  assert.deepEqual([...idx[8]], ['keyboard']);
});

// ---- trySpawn basics ----

test('AC-2.2: spawned word starts at y = 0 with x from spawnX, and gets the next id', () => {
  const s0 = makeState({ nextWordId: 7 });
  const rng = seqRng([0, pick3(2), 0.5]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0, 'rng order: length, word, x');
  assert.equal(s1.words.length, 1);
  const w = s1.words[0];
  assert.equal(w.text, 'dog');
  assert.equal(w.y, 0);
  assert.equal(w.id, 7);
  assert.equal(w.x, spawnX('dog', 0.5));
  assert.equal(s1.nextWordId, 8);
});

test('AC-2.2: spawned words are appended in spawn order with increasing ids', () => {
  let s = makeState();
  s = trySpawn(s, seqRng([0, pick3(0), 0]), SMALL_INDEX);
  s = trySpawn(s, seqRng([0, pick3(2), 0]), SMALL_INDEX);
  assert.deepEqual(s.words.map((w) => w.text), ['cat', 'dog']);
  assert.ok(s.words[0].id < s.words[1].id);
});

test('AC-2.1: trySpawn does not touch spawnTimerMs', () => {
  const s0 = makeState({ spawnTimerMs: -12.5 });
  const s1 = trySpawn(s0, seqRng([0, pick3(0), 0]), SMALL_INDEX);
  assert.equal(s1.spawnTimerMs, -12.5);
});

test('AC-2.2: spawned x keeps the word inside the field for every rng extreme', () => {
  for (const r of [0, 0.25, 0.999999]) {
    const s1 = trySpawn(makeState({ level: 10, elapsedSec: 280 }), seqRng([0.999999, 0, r]), SMALL_INDEX);
    const w = s1.words[0];
    assert.equal(w.text.length, 8);
    assert.ok(w.x >= 10);
    assert.ok(w.x + wordWidth(w.text) <= 790);
  }
});

// ---- AC-2.3 / AC-8.4 length bands ----

for (let level = 1; level <= 10; level++) {
  test(`AC-8.4 / AC-2.3: level ${level} spawns min length with rng 0 and max length with rng 0.999999`, () => {
    const [min, max] = lengthRange(level);
    const base = makeState({ level, elapsedSec: (level - 1) * 30 });
    const sMin = trySpawn(base, seqRng([0, 0, 0]), SMALL_INDEX);
    assert.equal(sMin.words[0].text.length, min);
    assert.ok(SMALL_INDEX[min].includes(sMin.words[0].text));
    const sMax = trySpawn(base, seqRng([0.999999, 0, 0]), SMALL_INDEX);
    assert.equal(sMax.words[0].text.length, max);
    assert.ok(SMALL_INDEX[max].includes(sMax.words[0].text));
  });
}

test('AC-2.3: length is uniform over the range (each length gets an equal rng slice)', () => {
  // Level 7: range 4-7 => 4 lengths, slices of 0.25.
  const base = makeState({ level: 7, elapsedSec: 185 });
  const expected = [[0.0, 4], [0.24, 4], [0.25, 5], [0.49, 5], [0.5, 6], [0.74, 6], [0.75, 7], [0.99, 7]];
  for (const [r, len] of expected) {
    const s = trySpawn(base, seqRng([r, 0, 0]), SMALL_INDEX);
    assert.equal(s.words[0].text.length, len, `r=${r}`);
  }
});

test('AC-2.3: the word is chosen by floor(rng * list.length) from the chosen length list', () => {
  const base = makeState();
  for (let i = 0; i < SMALL_INDEX[3].length; i++) {
    const s = trySpawn(base, seqRng([0, pick3(i), 0]), SMALL_INDEX);
    assert.equal(s.words[0].text, SMALL_INDEX[3][i]);
  }
  const last = trySpawn(base, seqRng([0, 0.999999, 0]), SMALL_INDEX);
  assert.equal(last.words[0].text, 'ant');
});

// ---- AC-2.4 duplicates ----

test('AC-2.4: a pick identical to an active word is retried', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], nextWordId: 2 });
  const rng = seqRng([0, pick3(0), pick3(2), 0]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.deepEqual(s1.words.map((w) => w.text), ['cat', 'dog']);
});

test('AC-2.4: success on the 10th attempt still spawns', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], nextWordId: 2 });
  const rng = seqRng([0, ...Array(9).fill(pick3(0)), pick3(2), 0]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.equal(s1.words.length, 2);
  assert.equal(s1.words[1].text, 'dog');
});

test('AC-2.4: 10 failed attempts skip the spawn (no x roll, no 11th attempt)', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], nextWordId: 2 });
  const rng = seqRng([0, ...Array(10).fill(pick3(0))]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.deepEqual(s1, s0);
});

test('AC-2.4: a new word is never identical to any active word', () => {
  const words = SMALL_INDEX[3].slice(0, 4).map((t, i) => makeWord(i + 1, t, 50 * i));
  const s0 = makeState({ words, nextWordId: 5 });
  // Try each of the 4 active words, then 'ant' (free).
  const rng = seqRng([0, pick3(0), pick3(1), pick3(2), pick3(3), pick3(4), 0]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(s1.words.at(-1).text, 'ant');
});

// ---- AC-2.5 first letter vs target / Q-1 / Q-2 ----

test('AC-2.5: a pick sharing the first letter with the target is rejected', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], targetId: 1, typed: 'c', nextWordId: 2 });
  const rng = seqRng([0, pick3(1) /* car */, pick3(3) /* cow */, pick3(2) /* dog */, 0]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.equal(s1.words.at(-1).text, 'dog');
});

test('AC-2.5: without a target, sharing a first letter with an active word is allowed', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], nextWordId: 2 });
  const rng = seqRng([0, pick3(1) /* car */, 0]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(s1.words.at(-1).text, 'car');
});

test('AC-2.5: the rule uses the target word, not other active words', () => {
  // target is 'dog'; 'cat' is active but not the target -> 'car' allowed.
  const s0 = makeState({
    words: [makeWord(1, 'cat', 200), makeWord(2, 'dog', 100)],
    targetId: 2,
    typed: 'd',
    nextWordId: 3,
  });
  const s1 = trySpawn(s0, seqRng([0, pick3(1), 0]), SMALL_INDEX);
  assert.equal(s1.words.at(-1).text, 'car');
});

test('AC-2.5 / Q-1: first-letter rejections use the 10-attempt budget (10 rejections -> skip)', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], targetId: 1, typed: 'c', nextWordId: 2 });
  const rng = seqRng([0, ...Array(10).fill(pick3(1)) /* car */]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.deepEqual(s1, s0);
});

test('Q-1: duplicate and first-letter rejections share one budget of 10', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200), makeWord(2, 'dog', 100)], targetId: 1, typed: 'c', nextWordId: 3 });
  const picks = [];
  for (let i = 0; i < 5; i++) picks.push(pick3(2) /* dog: duplicate */, pick3(1) /* car: first letter */);
  const rng = seqRng([0, ...picks]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.deepEqual(s1, s0);
});

test('Q-2: a retry re-picks only the word; the length is rolled once per spawn', () => {
  // Level 1 range 3-4. Length roll 0 -> 3. Retry rng value 0.999999 would mean length 4 if
  // the length were re-rolled, but as a word index it picks 'ant' from the 3-letter list.
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], nextWordId: 2 });
  const rng = seqRng([0, pick3(0) /* cat dup */, 0.999999 /* ant */, 0.3]);
  const s1 = trySpawn(s0, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.equal(s1.words.at(-1).text, 'ant');
  assert.equal(s1.words.at(-1).x, spawnX('ant', 0.3));
});

// ---- AC-2.6 cap ----

test('AC-2.6: with 10 active words the spawn is skipped with no rng calls', () => {
  const words = Array.from({ length: 10 }, (_, i) => makeWord(i + 1, `w${i}`, i * 10));
  const s0 = makeState({ words, nextWordId: 11 });
  const s1 = trySpawn(s0, noRng(), SMALL_INDEX);
  assert.deepEqual(s1, s0);
});

test('AC-2.6: with 9 active words a spawn still happens (10 is the cap)', () => {
  const words = Array.from({ length: 9 }, (_, i) => makeWord(i + 1, `w${i}`, i * 10));
  const s0 = makeState({ words, nextWordId: 10 });
  const s1 = trySpawn(s0, seqRng([0, 0, 0]), SMALL_INDEX);
  assert.equal(s1.words.length, 10);
});

// ---- purity ----

test('DESIGN 3: trySpawn does not mutate its input state', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 200)], nextWordId: 2 });
  const before = snapshot(s0);
  trySpawn(s0, seqRng([0, pick3(2), 0]), SMALL_INDEX);
  assert.deepEqual(s0, before);
});
