// Typing Defense - pure game logic.
// No DOM, no timers, no Math.random. Time enters only as dtSec, randomness only as rng().
// Functions never mutate their inputs.

export const CONFIG = Object.freeze({
  FIELD_WIDTH: 800,
  FIELD_HEIGHT: 600,
  START_LIVES: 3,
  MAX_ACTIVE_WORDS: 10,
  SPAWN_Y: 0,
  MARGIN_X: 10,
  MAX_DT_SEC: 0.1,
  LEVEL_DURATION_SEC: 30,
  MAX_LEVEL: 10,
  BASE_SPAWN_MS: 2000,
  SPAWN_STEP_MS: 150,
  MIN_SPAWN_MS: 650,
  BASE_SPEED: 40,
  SPEED_STEP: 10,
  MAX_SPEED: 130,
  LENGTH_RANGES: Object.freeze({
    1: Object.freeze([3, 4]),
    2: Object.freeze([3, 4]),
    3: Object.freeze([3, 5]),
    4: Object.freeze([3, 5]),
    5: Object.freeze([4, 6]),
    6: Object.freeze([4, 6]),
    7: Object.freeze([4, 7]),
    8: Object.freeze([5, 7]),
    9: Object.freeze([5, 8]),
    10: Object.freeze([5, 8]),
  }),
  POINTS_PER_CHAR: 10,
  FIRST_SPAWN_DELAY_MS: 0,
  MAX_PICK_ATTEMPTS: 10,
  FLASH_MS: 300,
  BANNER_MS: 1000,
  GAME_OVER_GUARD_MS: 500,
  FONT_SIZE_PX: 24,
  CHAR_WIDTH_PX: 15,
});

// ---------------------------------------------------------------------------
// State lifecycle
// ---------------------------------------------------------------------------

export function createInitialState() {
  return {
    status: 'START',
    score: 0,
    lives: CONFIG.START_LIVES,
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
  };
}

export function startGame() {
  return {
    ...createInitialState(),
    status: 'PLAYING',
    spawnTimerMs: CONFIG.FIRST_SPAWN_DELAY_MS,
    skipNextDt: true,
  };
}

// ---------------------------------------------------------------------------
// Difficulty and scoring
// ---------------------------------------------------------------------------

export function levelForElapsed(elapsedSec) {
  return Math.min(CONFIG.MAX_LEVEL, 1 + Math.floor(elapsedSec / CONFIG.LEVEL_DURATION_SEC));
}

export function spawnIntervalMs(level) {
  return Math.max(CONFIG.MIN_SPAWN_MS, CONFIG.BASE_SPAWN_MS - CONFIG.SPAWN_STEP_MS * (level - 1));
}

export function fallSpeed(level) {
  return Math.min(CONFIG.MAX_SPEED, CONFIG.BASE_SPEED + CONFIG.SPEED_STEP * (level - 1));
}

export function lengthRange(level) {
  const r = CONFIG.LENGTH_RANGES[level];
  return [r[0], r[1]];
}

export function pointsFor(wordLength, level) {
  return CONFIG.POINTS_PER_CHAR * wordLength * level;
}

export function accuracyPercent(correct, typos) {
  const total = correct + typos;
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function clampDt(dtSec) {
  if (!(dtSec > 0)) return 0; // negative, zero, NaN
  return Math.min(dtSec, CONFIG.MAX_DT_SEC);
}

// ---------------------------------------------------------------------------
// Words and spawning
// ---------------------------------------------------------------------------

export function buildWordIndex(words) {
  const index = {};
  for (let len = 3; len <= 8; len++) index[len] = [];
  for (const w of words) {
    if (!index[w.length]) index[w.length] = [];
    index[w.length].push(w);
  }
  return index;
}

export function wordWidth(text) {
  return text.length * CONFIG.CHAR_WIDTH_PX;
}

export function spawnX(text, r) {
  return CONFIG.MARGIN_X + r * (CONFIG.FIELD_WIDTH - 2 * CONFIG.MARGIN_X - wordWidth(text));
}

export function trySpawn(state, rng, wordsByLength) {
  // 1. Cap check, no rng call.
  if (state.words.length >= CONFIG.MAX_ACTIVE_WORDS) return state;

  // 2. Length (1 rng call).
  const [min, max] = lengthRange(state.level);
  const len = min + Math.floor(rng() * (max - min + 1));
  const list = (wordsByLength && wordsByLength[len]) || [];

  const target = getTarget(state);
  const targetFirst = target ? target.text[0] : null;

  // 3. Up to MAX_PICK_ATTEMPTS picks (1 rng call each), shared budget for both checks.
  let picked = null;
  for (let i = 0; i < CONFIG.MAX_PICK_ATTEMPTS; i++) {
    const text = list[Math.floor(rng() * list.length)];
    if (typeof text !== 'string' || text.length === 0) continue;
    if (state.words.some((w) => w.text === text)) continue;
    if (targetFirst !== null && text[0] === targetFirst) continue;
    picked = text;
    break;
  }

  // 4. All attempts failed: skip.
  if (picked === null) return state;

  // 5. x position (1 rng call).
  const x = spawnX(picked, rng());
  const word = { id: state.nextWordId, text: picked, x, y: CONFIG.SPAWN_Y };
  return {
    ...state,
    words: [...state.words, word],
    nextWordId: state.nextWordId + 1,
  };
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

export function normalizeKey(key) {
  if (key === 'Enter' || key === 'Backspace' || key === 'Escape') return key;
  if (typeof key === 'string' && key.length === 1) {
    const lower = key.toLowerCase();
    if (lower >= 'a' && lower <= 'z') return lower;
  }
  return null;
}

export function findTargetFor(words, letter) {
  let best = null;
  for (const w of words) {
    if (w.text[0] !== letter) continue;
    if (best === null || w.y > best.y || (w.y === best.y && w.id < best.id)) best = w;
  }
  return best;
}

export function getTarget(state) {
  if (state.targetId === null || state.targetId === undefined) return null;
  return state.words.find((w) => w.id === state.targetId) || null;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export function update(state, dtSec, rng, wordsByLength) {
  if (state.status === 'START' || state.status === 'PAUSED') return state;

  if (state.status === 'GAME_OVER') {
    return { ...state, gameOverMs: state.gameOverMs + clampDt(dtSec) * 1000 };
  }

  if (state.status !== 'PLAYING') return state;

  // 1. dt
  const dt = state.skipNextDt ? 0 : clampDt(dtSec);
  let s = { ...state, skipNextDt: false };

  // 2. Timers (game time)
  s.flashMs = Math.max(0, s.flashMs - dt * 1000);
  s.bannerMs = Math.max(0, s.bannerMs - dt * 1000);

  // 3. Time and level
  s.elapsedSec = s.elapsedSec + dt;
  const newLevel = levelForElapsed(s.elapsedSec);
  if (newLevel > s.level) {
    s.level = newLevel;
    s.bannerMs = CONFIG.BANNER_MS;
  }

  // 4. Movement
  const speed = fallSpeed(s.level);
  const moved = s.words.map((w) => ({ ...w, y: w.y + speed * dt }));

  // 5. Misses
  const kept = [];
  let misses = 0;
  let targetMissed = false;
  for (const w of moved) {
    if (w.y >= CONFIG.FIELD_HEIGHT) {
      misses++;
      if (w.id === s.targetId) targetMissed = true;
    } else {
      kept.push(w);
    }
  }
  s.words = kept;
  if (misses > 0) {
    s.lives = Math.max(0, s.lives - misses);
    s.flashMs = CONFIG.FLASH_MS;
    if (targetMissed) {
      s.targetId = null;
      s.typed = '';
    }
  }

  // 6. Game over
  if (s.lives === 0) {
    s.status = 'GAME_OVER';
    s.gameOverMs = 0;
    s.targetId = null;
    s.typed = '';
    return s;
  }

  // 7. Spawn timer
  s.spawnTimerMs = s.spawnTimerMs - dt * 1000;
  if (s.spawnTimerMs <= 0) {
    s = trySpawn(s, rng, wordsByLength);
    s = { ...s, spawnTimerMs: s.spawnTimerMs + spawnIntervalMs(s.level) };
  }

  return s;
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

export function handleKey(state, key) {
  const k = normalizeKey(key);
  if (k === null) return state;

  switch (state.status) {
    case 'START':
      return k === 'Enter' ? startGame() : state;
    case 'PAUSED':
      return k === 'Enter' ? { ...state, status: 'PLAYING', skipNextDt: true } : state;
    case 'GAME_OVER':
      if (k === 'Enter' && state.gameOverMs >= CONFIG.GAME_OVER_GUARD_MS) return startGame();
      return state;
    case 'PLAYING':
      return handlePlayingKey(state, k);
    default:
      return state;
  }
}

function handlePlayingKey(state, k) {
  if (k === 'Enter') return state;

  const target = getTarget(state);

  if (k === 'Escape') {
    if (state.targetId === null && state.typed === '') return state;
    return { ...state, targetId: null, typed: '' };
  }

  if (k === 'Backspace') {
    if (!target) return state;
    const typed = state.typed.slice(0, -1);
    return { ...state, typed, targetId: typed === '' ? null : state.targetId };
  }

  // Letter a-z
  if (!target) {
    const found = findTargetFor(state.words, k);
    if (!found) return { ...state, typos: state.typos + 1 };
    const s = {
      ...state,
      targetId: found.id,
      typed: k,
      correctKeystrokes: state.correctKeystrokes + 1,
    };
    return s.typed.length === found.text.length ? destroyTarget(s, found) : s;
  }

  if (target.text[state.typed.length] === k) {
    const s = {
      ...state,
      typed: state.typed + k,
      correctKeystrokes: state.correctKeystrokes + 1,
    };
    return s.typed.length === target.text.length ? destroyTarget(s, target) : s;
  }

  return { ...state, typos: state.typos + 1 };
}

function destroyTarget(state, word) {
  return {
    ...state,
    words: state.words.filter((w) => w.id !== word.id),
    score: state.score + pointsFor(word.text.length, state.level),
    wordsDestroyed: state.wordsDestroyed + 1,
    targetId: null,
    typed: '',
  };
}

// ---------------------------------------------------------------------------
// Focus loss
// ---------------------------------------------------------------------------

export function handleFocusLoss(state) {
  if (state.status !== 'PLAYING') return state;
  return { ...state, status: 'PAUSED' };
}
