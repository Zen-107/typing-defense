// Test helpers for Typing Defense (see DESIGN.md Section 9 "Fixtures").
import { startGame } from '../src/game-logic.js';

/**
 * Scripted rng: returns values in order, throws if the sequence runs out
 * (so tests catch unexpected rng calls). `rng.used` = number of calls made,
 * `rng.remaining` = number of unused values.
 */
export function seqRng(values) {
  let i = 0;
  const rng = () => {
    if (i >= values.length) {
      throw new Error(`seqRng: sequence exhausted after ${values.length} calls`);
    }
    return values[i++];
  };
  Object.defineProperty(rng, 'used', { get: () => i });
  Object.defineProperty(rng, 'remaining', { get: () => values.length - i });
  return rng;
}

/** An rng that must never be called. */
export function noRng() {
  return seqRng([]);
}

/** Deterministic pseudo-random rng in [0, 1) (LCG), never runs out. */
export function lcgRng(seed = 12345) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A PLAYING state with skipNextDt off, plus overrides. */
export function makeState(overrides = {}) {
  return { ...startGame(), skipNextDt: false, ...overrides };
}

export function makeWord(id, text, y, x = 100) {
  return { id, text, x, y };
}

/** Small, predictable word index. Lengths 3..8 all present. */
export const SMALL_INDEX = Object.freeze({
  3: ['cat', 'car', 'dog', 'cow', 'ant'],
  4: ['tree', 'toad', 'bird', 'fish'],
  5: ['apple', 'house', 'zebra'],
  6: ['planet', 'banana', 'rocket'],
  7: ['monster', 'kitchen', 'giraffe'],
  8: ['keyboard', 'elephant', 'dinosaur'],
});

/** Deep clone for immutability checks. */
export function snapshot(state) {
  return structuredClone(state);
}
