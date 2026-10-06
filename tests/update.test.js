import test from 'node:test';
import assert from 'node:assert/strict';
import { update, startGame, handleKey, spawnX } from '../src/game-logic.js';
import { makeState, makeWord, seqRng, noRng, SMALL_INDEX } from './fixtures.js';

// 1/16 s: exact in binary floating point, so time sums stay exact.
const DT = 0.0625;
const NO_SPAWN = 1e9; // spawnTimerMs value that keeps the spawn timer from firing

function run(state, frames, dt, rng = noRng()) {
  let s = state;
  for (let i = 0; i < frames; i++) s = update(s, dt, rng, SMALL_INDEX);
  return s;
}

// ---- AC-1.4 / Q-8 first spawn ----

test('AC-1.4 / Q-8: the first update after startGame spawns the first word at elapsed 0', () => {
  const s0 = startGame();
  const rng = seqRng([0, 0, 0]);
  const s1 = update(s0, 0.016, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.equal(s1.words.length, 1);
  assert.equal(s1.words[0].y, 0);
  assert.equal(s1.elapsedSec, 0, 'first update after start uses dt = 0');
  assert.equal(s1.skipNextDt, false);
  assert.equal(s1.spawnTimerMs, 2000, 'next spawn scheduled one level-1 interval later');
});

test('AC-1.4: first word exists within 500 ms of game time after entering PLAYING', () => {
  let s = startGame();
  const rng = seqRng(Array(30).fill(0));
  let firstAt = null;
  for (let i = 0; i < 10 && firstAt === null; i++) {
    s = update(s, DT, rng, SMALL_INDEX);
    if (s.words.length > 0) firstAt = s.elapsedSec;
  }
  assert.notEqual(firstAt, null);
  assert.ok(firstAt <= 0.5);
});

// ---- AC-2.1 spawn cadence ----

test('AC-2.1: at level 1 the next spawn happens exactly 2000 ms after the previous one', () => {
  let s = update(startGame(), DT, seqRng([0, 0, 0]), SMALL_INDEX);
  assert.equal(s.words.length, 1);
  s = run(s, 31, DT); // 1937.5 ms: no spawn, no rng calls
  assert.equal(s.words.length, 1);
  assert.equal(s.spawnTimerMs, 62.5);
  const rng = seqRng([0, 0.5, 0]);
  s = update(s, DT, rng, SMALL_INDEX); // 2000 ms
  assert.equal(rng.remaining, 0);
  assert.equal(s.words.length, 2);
  assert.equal(s.spawnTimerMs, 2000);
});

test('AC-2.1: the spawn timer is rescheduled with += (cadence stays exact when overshooting)', () => {
  const s0 = makeState({ spawnTimerMs: 30 });
  const s1 = update(s0, 0.05, seqRng([0, 0, 0]), SMALL_INDEX);
  assert.equal(s1.words.length, 1);
  assert.equal(s1.spawnTimerMs, 1980); // 30 - 50 + 2000
});

test('AC-2.1: a level change does not alter the gap already counting down', () => {
  // Spawn at elapsed 29.0 (level 1) schedules +2000 ms, even though level 2 begins at 30.0.
  let s = makeState({ elapsedSec: 28.9375, spawnTimerMs: 62.5 });
  s = update(s, DT, seqRng([0, 0, 0]), SMALL_INDEX);
  assert.equal(s.elapsedSec, 29);
  assert.equal(s.words.length, 1);
  assert.equal(s.spawnTimerMs, 2000);
  s = run(s, 31, DT); // elapsed 30.9375, level 2 already
  assert.equal(s.level, 2);
  assert.equal(s.words.length, 1);
  s = update(s, DT, seqRng([0, 0.5, 0]), SMALL_INDEX); // elapsed 31.0
  assert.equal(s.words.length, 2);
  assert.equal(s.spawnTimerMs, 1850, 'level-2 interval applies from this spawn on');
});

test('AC-2.1: when the timer fires after a level-up, the new interval is used', () => {
  let s = makeState({ elapsedSec: 29.5, spawnTimerMs: 1000 });
  s = run(s, 16, DT, seqRng([0, 0, 0])); // to elapsed 30.5, timer hits 0
  assert.equal(s.level, 2);
  assert.equal(s.words.length, 1);
  assert.equal(s.spawnTimerMs, 1850);
});

test('AC-2.1: DESIGN 6.2 example - spawns at 28.0 s, 30.0 s (on the level-up frame), then the gap is 1850 ms', () => {
  let s = makeState({ elapsedSec: 27.9375, spawnTimerMs: 62.5 });
  s = update(s, DT, seqRng([0, 0, 0]), SMALL_INDEX); // elapsed 28.0
  assert.equal(s.elapsedSec, 28);
  assert.equal(s.words.length, 1);
  assert.equal(s.spawnTimerMs, 2000, 'scheduled with the level-1 interval');
  s = run(s, 31, DT); // elapsed 29.9375
  assert.equal(s.level, 1);
  assert.equal(s.words.length, 1);
  assert.equal(s.spawnTimerMs, 62.5);
  s = update(s, DT, seqRng([0, 0.5, 0]), SMALL_INDEX); // elapsed 30.0: level 2 and the timer fires
  assert.equal(s.elapsedSec, 30);
  assert.equal(s.level, 2);
  assert.equal(s.words.length, 2, 'the countdown finished on the old 2000 ms interval');
  assert.equal(s.spawnTimerMs, 1850, 'the reschedule uses the level-2 interval (next spawn at 31.85 s)');
});

test('AC-2.6: when 10 words are active the spawn is skipped but the timer is still rescheduled', () => {
  const words = Array.from({ length: 10 }, (_, i) => makeWord(i + 1, `w${i}`, i * 10));
  const s0 = makeState({ words, nextWordId: 11, spawnTimerMs: 50 });
  const s1 = update(s0, 0.05, noRng(), SMALL_INDEX);
  assert.equal(s1.words.length, 10);
  assert.equal(s1.nextWordId, 11);
  assert.equal(s1.spawnTimerMs, 2000);
});

test('AC-2.4: a skipped spawn (10 failed picks) still reschedules the timer', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], nextWordId: 2, spawnTimerMs: 50 });
  const rng = seqRng([0, ...Array(10).fill(0.01) /* 'cat' every time */]);
  const s1 = update(s0, 0.05, rng, SMALL_INDEX);
  assert.equal(rng.remaining, 0);
  assert.equal(s1.words.length, 1);
  assert.equal(s1.spawnTimerMs, 2000);
});

test('AC-2.2: a spawn from update places the word at y = 0 with spawnX', () => {
  const s0 = makeState({ spawnTimerMs: 50 });
  const s1 = update(s0, 0.05, seqRng([0, 0.41 /* dog */, 0.7]), SMALL_INDEX);
  assert.deepEqual(s1.words, [{ id: 1, text: 'dog', x: spawnX('dog', 0.7), y: 0 }]);
});

// ---- AC-2.7 / AC-2.9 / NFR-3 movement ----

test('AC-2.7: a word moves y += speed x dt (level 1, 40 px/s)', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.words[0].y, 102.5);
  assert.equal(s1.words[0].x, 100, 'x does not change');
});

test('AC-2.7: at level 1 a word reaches y = 600 after exactly 15.0 s', () => {
  let s = makeState({ words: [makeWord(1, 'cat', 0)], spawnTimerMs: NO_SPAWN });
  s = run(s, 239, DT); // 14.9375 s
  assert.equal(s.words.length, 1);
  assert.equal(s.words[0].y, 597.5);
  assert.equal(s.lives, 3);
  s = update(s, DT, noRng(), SMALL_INDEX); // 15.0 s -> y = 600 -> missed
  assert.equal(s.words.length, 0);
  assert.equal(s.lives, 2);
});

for (const fps of [30, 144]) {
  test(`NFR-3 / AC-2.7: at ${fps} fps a level-1 word reaches y = 600 after 15.0 s (+/- 0.1 s)`, () => {
    let s = makeState({ words: [makeWord(1, 'cat', 0)], spawnTimerMs: NO_SPAWN });
    const dt = 1 / fps;
    let t = 0;
    while (s.words.length > 0 && t < 20) {
      s = update(s, dt, noRng(), SMALL_INDEX);
      t += dt;
    }
    assert.equal(s.lives, 2);
    assert.ok(Math.abs(t - 15) <= 0.1, `missed at t=${t}`);
  });
}

for (const [level, speed] of [[1, 40], [5, 80], [10, 130]]) {
  test(`AC-2.7 / AC-8.3: words fall at ${speed} px/s at level ${level}`, () => {
    const s0 = makeState({ level, elapsedSec: (level - 1) * 30 + 5, words: [makeWord(1, 'cat', 0)], spawnTimerMs: NO_SPAWN });
    const s1 = update(s0, DT, noRng(), SMALL_INDEX);
    assert.equal(s1.words[0].y, speed * DT);
  });
}

test('AC-2.9: all active words move at the same current-level speed', () => {
  const s0 = makeState({
    words: [makeWord(1, 'cat', 0), makeWord(2, 'dog', 250), makeWord(3, 'cow', 500)],
    spawnTimerMs: NO_SPAWN,
  });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.deepEqual(s1.words.map((w) => w.y), [2.5, 252.5, 502.5]);
});

test('AC-2.9: on level-up, words already on screen speed up in that same frame', () => {
  const s0 = makeState({ elapsedSec: 29.9375, words: [makeWord(1, 'cat', 100)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.level, 2);
  assert.equal(s1.words[0].y, 100 + 50 * DT);
  const s2 = update(s1, DT, noRng(), SMALL_INDEX);
  assert.equal(s2.words[0].y, 100 + 2 * 50 * DT);
});

// ---- AC-2.8 dt cap ----

test('AC-2.8: a 2-second frame moves a word at most 0.1 s x speed', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, 2.0, noRng(), SMALL_INDEX);
  assert.equal(s1.words[0].y, 104);
  assert.equal(s1.elapsedSec, 0.1);
});

test('AC-2.8: the dt cap also applies to the spawn timer', () => {
  const s0 = makeState({ spawnTimerMs: 1000 });
  const s1 = update(s0, 5.0, noRng(), SMALL_INDEX);
  assert.equal(s1.spawnTimerMs, 900);
  assert.equal(s1.words.length, 0);
});

test('AC-2.8: negative dt is treated as 0', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], spawnTimerMs: NO_SPAWN, elapsedSec: 10 });
  const s1 = update(s0, -1, noRng(), SMALL_INDEX);
  assert.equal(s1.words[0].y, 100);
  assert.equal(s1.elapsedSec, 10);
});

// ---- AC-8.1 elapsed / level through update ----

test('AC-8.1: elapsed time advances by dt and level becomes 2 when elapsed reaches 30.0', () => {
  let s = makeState({ elapsedSec: 29.875, spawnTimerMs: NO_SPAWN });
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.elapsedSec, 29.9375);
  assert.equal(s.level, 1);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.elapsedSec, 30);
  assert.equal(s.level, 2);
});

test('AC-8.1 / AC-8.5: level stays 10 past 270 s', () => {
  let s = makeState({ level: 10, elapsedSec: 599.9375, spawnTimerMs: NO_SPAWN });
  s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(s.level, 10);
  assert.equal(s.bannerMs, 0, 'no level-up banner after the cap');
});

test('AC-8.1: level 10 is reached at 270 s through update', () => {
  const s0 = makeState({ level: 9, elapsedSec: 269.9375, spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.level, 10);
});

// ---- AC-9.4 banner timer ----

test('AC-9.4: level-up sets the banner timer to 1000 ms', () => {
  const s0 = makeState({ elapsedSec: 29.9375, spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.bannerMs, 1000);
});

test('AC-9.4: the banner counts down in game time and ends after 1000 ms', () => {
  let s = makeState({ elapsedSec: 29.9375, spawnTimerMs: NO_SPAWN });
  s = update(s, DT, noRng(), SMALL_INDEX);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.bannerMs, 937.5);
  s = run(s, 14, DT); // total 15 frames after level-up = 937.5 ms
  assert.equal(s.bannerMs, 62.5);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.bannerMs, 0);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.bannerMs, 0, 'never negative');
});

test('AC-9.4: no banner without a level change', () => {
  const s0 = makeState({ elapsedSec: 10, spawnTimerMs: NO_SPAWN });
  assert.equal(update(s0, DT, noRng(), SMALL_INDEX).bannerMs, 0);
});

// ---- AC-5.x misses and lives ----

test('AC-5.1: a word reaching y >= 600 is removed and costs 1 life', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 100)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.deepEqual(s1.words.map((w) => w.id), [2]);
  assert.equal(s1.lives, 2);
  assert.equal(s1.status, 'PLAYING');
});

test('AC-5.1: a word at y just below 600 is not missed', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 597.4)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX); // -> 599.9
  assert.equal(s1.words.length, 1);
  assert.equal(s1.lives, 3);
});

test('AC-5.1: a word landing exactly on y = 600 is missed', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 597.5)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX); // -> 600.0
  assert.equal(s1.words.length, 0);
  assert.equal(s1.lives, 2);
});

test('AC-5.2: if the missed word was the target, the target is cleared', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 599), makeWord(2, 'cow', 10)], targetId: 1, typed: 'ca', spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.targetId, null);
  assert.equal(s1.typed, '');
  const s2 = handleKey(s1, 'c');
  assert.equal(s2.targetId, 2, 'next letter selects a new target');
});

test('AC-5.2: missing a non-target word keeps the target and prefix', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 10)], targetId: 2, typed: 'do', spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.targetId, 2);
  assert.equal(s1.typed, 'do');
});

test('AC-5.3: two words missed in the same frame cost 2 lives', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 599.5), makeWord(3, 'cow', 10)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.lives, 1);
  assert.deepEqual(s1.words.map((w) => w.id), [3]);
  assert.equal(s1.status, 'PLAYING');
});

test('AC-5.3: more misses than lives -> lives stop at 0, never negative', () => {
  const words = [1, 2, 3, 4, 5].map((i) => makeWord(i, `w${i}`, 599));
  const s0 = makeState({ words, lives: 3, spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.lives, 0);
  assert.equal(s1.status, 'GAME_OVER');
});

test('AC-5.4: missing a word does not change the score', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 599)], score: 120, spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.score, 120);
});

test('AC-5.5: a lost life starts the 300 ms flash timer; the game keeps running', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 10)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, DT, noRng(), SMALL_INDEX);
  assert.equal(s1.flashMs, 300);
  assert.equal(s1.status, 'PLAYING');
  const s2 = update(s1, DT, noRng(), SMALL_INDEX);
  assert.equal(s2.words[0].y, 10 + 2 * 2.5, 'words keep moving during the flash');
});

test('AC-5.5: the flash timer counts down in game time and ends after 300 ms', () => {
  let s = makeState({ words: [makeWord(1, 'cat', 599)], spawnTimerMs: NO_SPAWN });
  s = update(s, DT, noRng(), SMALL_INDEX);
  s = run(s, 4, DT); // 250 ms
  assert.equal(s.flashMs, 50);
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.flashMs, 0);
});

test('AC-5.5 / Q-7: losing the final life gives a GAME_OVER state with flashMs === 0', () => {
  const s0 = makeState({ lives: 1, words: [makeWord(1, 'cat', 599.9)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, 0.05, noRng(), SMALL_INDEX);
  assert.equal(s1.status, 'GAME_OVER');
  assert.equal(s1.flashMs, 0);
});

test('AC-5.5 / Q-7: final life lost while an earlier flash is still running also clears it', () => {
  const s0 = makeState({ lives: 1, flashMs: 200, words: [makeWord(1, 'cat', 599.9)], spawnTimerMs: NO_SPAWN });
  const s1 = update(s0, 0.05, noRng(), SMALL_INDEX);
  assert.equal(s1.status, 'GAME_OVER');
  assert.equal(s1.flashMs, 0);
});

test('AC-5.5: no flash when nothing is missed', () => {
  const s0 = makeState({ words: [makeWord(1, 'cat', 100)], spawnTimerMs: NO_SPAWN });
  assert.equal(update(s0, DT, noRng(), SMALL_INDEX).flashMs, 0);
});

// ---- AC-6.1 game over ----

test('AC-6.1: losing the last life switches to GAME_OVER in the same update, with no spawn', () => {
  const s0 = makeState({ lives: 1, words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 10)], targetId: 2, typed: 'd', spawnTimerMs: 0 });
  const s1 = update(s0, DT, noRng() /* a spawn would throw */, SMALL_INDEX);
  assert.equal(s1.lives, 0);
  assert.equal(s1.status, 'GAME_OVER');
  assert.equal(s1.gameOverMs, 0);
  assert.equal(s1.targetId, null);
  assert.equal(s1.typed, '');
});

test('AC-6.1: in GAME_OVER, movement, spawning, elapsed time and level stop', () => {
  let s = makeState({ lives: 1, elapsedSec: 29.5, words: [makeWord(1, 'cat', 599), makeWord(2, 'dog', 300)], spawnTimerMs: 0 });
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.status, 'GAME_OVER');
  const frozenWords = s.words;
  const frozenElapsed = s.elapsedSec;
  const frozenTimer = s.spawnTimerMs;
  s = run(s, 50, 0.1); // 5 s on the results screen; a spawn would throw
  assert.equal(s.status, 'GAME_OVER');
  assert.deepEqual(s.words, frozenWords);
  assert.equal(s.elapsedSec, frozenElapsed);
  assert.equal(s.level, 1);
  assert.equal(s.spawnTimerMs, frozenTimer);
  assert.equal(s.lives, 0);
  assert.equal(s.bannerMs, 0);
});

// ---- AC-6.5 / Q-6 guard timer ----

test('AC-6.5 / Q-6: gameOverMs accumulates real (capped) frame time in GAME_OVER', () => {
  let s = makeState({ status: 'GAME_OVER', lives: 0, gameOverMs: 0 });
  s = update(s, 0.1, noRng(), SMALL_INDEX);
  assert.equal(s.gameOverMs, 100);
  s = update(s, 2.0, noRng(), SMALL_INDEX);
  assert.equal(s.gameOverMs, 200, 'capped at 100 ms per frame');
  s = update(s, DT, noRng(), SMALL_INDEX);
  assert.equal(s.gameOverMs, 262.5);
});

// ---- START is inert ----

test('AC-1.1: update in START changes nothing and spawns no words', () => {
  const s0 = { ...startGame(), status: 'START', skipNextDt: false };
  const s1 = update(s0, 0.1, noRng(), SMALL_INDEX);
  assert.deepEqual(s1, s0);
});
