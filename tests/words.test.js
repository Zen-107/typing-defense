import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from '../src/words.js';
import { buildWordIndex } from '../src/game-logic.js';

test('PRD 4.5: WORDS is a non-empty array', () => {
  assert.ok(Array.isArray(WORDS));
  assert.ok(WORDS.length > 0);
});

test('PRD 4.5: WORDS is frozen (DESIGN 7)', () => {
  assert.ok(Object.isFrozen(WORDS));
});

test('PRD 4.5: every word is a lowercase a-z string', () => {
  const bad = WORDS.filter((w) => typeof w !== 'string' || !/^[a-z]+$/.test(w));
  assert.deepEqual(bad, []);
});

test('PRD 4.5: no duplicate words', () => {
  const seen = new Set();
  const dups = [];
  for (const w of WORDS) {
    if (seen.has(w)) dups.push(w);
    seen.add(w);
  }
  assert.deepEqual(dups, []);
});

test('PRD 4.5 / DESIGN 7: every word has length 3 to 8', () => {
  const bad = WORDS.filter((w) => w.length < 3 || w.length > 8);
  assert.deepEqual(bad, []);
});

for (let len = 3; len <= 8; len++) {
  test(`PRD 4.5: at least 40 words of length ${len}`, () => {
    const n = WORDS.filter((w) => w.length === len).length;
    assert.ok(n >= 40, `only ${n} words of length ${len}`);
  });
}

test('PRD 4.5: at least 240 words in total', () => {
  assert.ok(WORDS.length >= 240);
});

test('AC-2.3: buildWordIndex(WORDS) has >= 40 entries for each length 3-8, each of the right length', () => {
  const idx = buildWordIndex(WORDS);
  for (let len = 3; len <= 8; len++) {
    assert.ok(Array.isArray(idx[len]), `length ${len} missing`);
    assert.ok(idx[len].length >= 40, `length ${len}: ${idx[len].length}`);
    assert.ok(idx[len].every((w) => w.length === len));
  }
  const total = [3, 4, 5, 6, 7, 8].reduce((n, len) => n + idx[len].length, 0);
  assert.equal(total, WORDS.length);
});
