import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  levelForElapsed,
  spawnIntervalMs,
  fallSpeed,
  lengthRange,
  pointsFor,
  accuracyPercent,
  clampDt,
} from '../src/game-logic.js';

// PRD Section 4.3 table
const TABLE = [
  { level: 1, start: 0, spawn: 2000, speed: 40, range: [3, 4] },
  { level: 2, start: 30, spawn: 1850, speed: 50, range: [3, 4] },
  { level: 3, start: 60, spawn: 1700, speed: 60, range: [3, 5] },
  { level: 4, start: 90, spawn: 1550, speed: 70, range: [3, 5] },
  { level: 5, start: 120, spawn: 1400, speed: 80, range: [4, 6] },
  { level: 6, start: 150, spawn: 1250, speed: 90, range: [4, 6] },
  { level: 7, start: 180, spawn: 1100, speed: 100, range: [4, 7] },
  { level: 8, start: 210, spawn: 950, speed: 110, range: [5, 7] },
  { level: 9, start: 240, spawn: 800, speed: 120, range: [5, 8] },
  { level: 10, start: 270, spawn: 650, speed: 130, range: [5, 8] },
];

// ---- CONFIG (PRD 4.1) ----

test('PRD 4.1: CONFIG core values match the PRD', () => {
  assert.equal(CONFIG.FIELD_WIDTH, 800);
  assert.equal(CONFIG.FIELD_HEIGHT, 600);
  assert.equal(CONFIG.START_LIVES, 3);
  assert.equal(CONFIG.MAX_ACTIVE_WORDS, 10);
  assert.equal(CONFIG.SPAWN_Y, 0);
  assert.equal(CONFIG.MARGIN_X, 10);
  assert.equal(CONFIG.MAX_DT_SEC, 0.1);
  assert.equal(CONFIG.LEVEL_DURATION_SEC, 30);
  assert.equal(CONFIG.MAX_LEVEL, 10);
  assert.equal(CONFIG.MAX_PICK_ATTEMPTS, 10);
  assert.equal(CONFIG.FLASH_MS, 300);
  assert.equal(CONFIG.BANNER_MS, 1000);
  assert.equal(CONFIG.GAME_OVER_GUARD_MS, 500);
  assert.equal(CONFIG.POINTS_PER_CHAR, 10);
});

test('Q-8: CONFIG.FIRST_SPAWN_DELAY_MS is 0 (first word at elapsed 0)', () => {
  assert.equal(CONFIG.FIRST_SPAWN_DELAY_MS, 0);
});

test('PRD 4.1: CONFIG is frozen', () => {
  assert.ok(Object.isFrozen(CONFIG));
});

// ---- AC-8.1 level ----

test('AC-8.1: PRD examples (0 -> 1, 29.9 -> 1, 30.0 -> 2, 270 -> 10, 600 -> 10)', () => {
  assert.equal(levelForElapsed(0), 1);
  assert.equal(levelForElapsed(29.9), 1);
  assert.equal(levelForElapsed(30.0), 2);
  assert.equal(levelForElapsed(270), 10);
  assert.equal(levelForElapsed(600), 10);
});

for (const row of TABLE) {
  test(`AC-8.1: level ${row.level} starts exactly at ${row.start} s`, () => {
    assert.equal(levelForElapsed(row.start), row.level);
    if (row.start > 0) {
      assert.equal(levelForElapsed(row.start - 0.001), row.level - 1, 'just before the boundary');
    }
    if (row.level < 10) {
      assert.equal(levelForElapsed(row.start + 29.999), row.level, 'end of the band');
    }
  });
}

test('AC-8.1: level is capped at 10 (299.999, 300, 1e6)', () => {
  assert.equal(levelForElapsed(299.999), 10);
  assert.equal(levelForElapsed(300), 10);
  assert.equal(levelForElapsed(1e6), 10);
});

test('AC-8.1: level is always an integer', () => {
  for (let t = 0; t <= 400; t += 7.3) {
    assert.ok(Number.isInteger(levelForElapsed(t)), `t=${t}`);
  }
});

// ---- AC-8.2 spawn interval ----

for (const row of TABLE) {
  test(`AC-8.2: spawn interval at level ${row.level} is ${row.spawn} ms`, () => {
    assert.equal(spawnIntervalMs(row.level), row.spawn);
  });
}

test('AC-8.2: spawn interval never goes below 650 ms (floor at level 10)', () => {
  assert.equal(spawnIntervalMs(10), 650);
  assert.equal(spawnIntervalMs(11), 650);
  assert.equal(spawnIntervalMs(20), 650);
});

// ---- AC-8.3 fall speed ----

for (const row of TABLE) {
  test(`AC-8.3: fall speed at level ${row.level} is ${row.speed} px/s`, () => {
    assert.equal(fallSpeed(row.level), row.speed);
  });
}

test('AC-8.3: fall speed never exceeds 130 px/s', () => {
  assert.equal(fallSpeed(10), 130);
  assert.equal(fallSpeed(11), 130);
  assert.equal(fallSpeed(20), 130);
});

// ---- AC-8.4 length range ----

for (const row of TABLE) {
  test(`AC-8.4: length range at level ${row.level} is ${row.range[0]}-${row.range[1]}`, () => {
    assert.deepEqual(lengthRange(row.level), row.range);
  });
}

test('AC-8.4: CONFIG.LENGTH_RANGES matches the PRD 4.3 table', () => {
  for (const row of TABLE) {
    assert.deepEqual([...CONFIG.LENGTH_RANGES[row.level]], row.range, `level ${row.level}`);
  }
});

// ---- AC-8.5 nothing increases after level 10 ----

test('AC-8.5: difficulty at 600 s equals difficulty at 270 s', () => {
  const l270 = levelForElapsed(270);
  const l600 = levelForElapsed(600);
  assert.equal(l600, l270);
  assert.equal(spawnIntervalMs(l600), spawnIntervalMs(l270));
  assert.equal(fallSpeed(l600), fallSpeed(l270));
  assert.deepEqual(lengthRange(l600), lengthRange(l270));
});

// ---- AC-7.1 / AC-7.2 points ----

test('AC-7.1: PRD examples - "cat" at L1 = 30, "planet" at L4 = 240, "keyboard" at L10 = 800', () => {
  assert.equal(pointsFor(3, 1), 30);
  assert.equal(pointsFor(6, 4), 240);
  assert.equal(pointsFor(8, 10), 800);
});

test('AC-7.1: points = 10 x length x level for every length 3-8 and level 1-10', () => {
  for (let len = 3; len <= 8; len++) {
    for (let lvl = 1; lvl <= 10; lvl++) {
      const p = pointsFor(len, lvl);
      assert.equal(p, 10 * len * lvl);
      assert.ok(Number.isInteger(p) && p >= 0);
    }
  }
});

test('AC-7.2: points use the level passed in (level at destroy time)', () => {
  assert.equal(pointsFor(4, 2), 80);
  assert.equal(pointsFor(4, 3), 120);
});

// ---- AC-6.3 accuracy ----

test('AC-6.3: no keystrokes -> accuracy 0', () => {
  assert.equal(accuracyPercent(0, 0), 0);
});

test('AC-6.3: all correct -> 100, all typos -> 0', () => {
  assert.equal(accuracyPercent(10, 0), 100);
  assert.equal(accuracyPercent(0, 5), 0);
});

test('AC-6.3: rounds to nearest integer (2/3 -> 67, 1/3 -> 33, 9/10 -> 90)', () => {
  assert.equal(accuracyPercent(2, 1), 67);
  assert.equal(accuracyPercent(1, 2), 33);
  assert.equal(accuracyPercent(9, 1), 90);
});

test('AC-6.3 / Q-4: exact .5 rounds half up (1/8 = 12.5 -> 13, 3/8 = 37.5 -> 38)', () => {
  assert.equal(accuracyPercent(1, 7), 13);
  assert.equal(accuracyPercent(3, 5), 38);
});

test('AC-6.3: accuracy is always an integer in 0..100', () => {
  for (let c = 0; c <= 20; c++) {
    for (let t = 0; t <= 20; t++) {
      const a = accuracyPercent(c, t);
      assert.ok(Number.isInteger(a) && a >= 0 && a <= 100, `c=${c} t=${t} -> ${a}`);
    }
  }
});

// ---- AC-2.8 dt cap ----

test('AC-2.8: clampDt caps a 2-second gap to 0.1 s', () => {
  assert.equal(clampDt(2.0), 0.1);
});

test('AC-2.8: clampDt keeps values at or below 0.1 s', () => {
  assert.equal(clampDt(0.1), 0.1);
  assert.equal(clampDt(0.05), 0.05);
  assert.equal(clampDt(1 / 60), 1 / 60);
  assert.equal(clampDt(0), 0);
});

test('AC-2.8: clampDt turns negative and NaN into 0', () => {
  assert.equal(clampDt(-1), 0);
  assert.equal(clampDt(NaN), 0);
});
