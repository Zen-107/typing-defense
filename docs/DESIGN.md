# Typing Defense - Technical Design (MVP)

Source of truth: `docs/PRD.md` (Revision 2, including US-10 Auto-pause). This document does not change any requirement. Where the PRD is unclear, the design picks a default and lists it under Section 11 "Questions for PO".

---

## 1. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Language | Plain JavaScript (ES2020+), ES modules (`import` / `export`) | Runs natively in all target browsers (NFR-1) and in Node. No transpiling. |
| Build | None | Nothing to install or configure. The files in `src/` are what the browser loads. |
| Rendering | One `<canvas>` element, 2D context | 10 words + HUD is cheap to redraw every frame (NFR-2). One draw path, full control over per-character colors (AC-3.9). |
| Font | System monospace stack (`"Courier New", Consolas, monospace`), 24 px | Fixed character width lets the pure logic compute word width without the DOM (AC-2.2). No web font, so no network request (NFR-1). 24 px >= 20 px (NFR-8). |
| Game loop | `requestAnimationFrame` in `main.js` | Frame-rate-independent `dt` comes from the rAF timestamp (NFR-3). |
| Unit tests | Node built-in test runner (`node:test`) + `node:assert/strict` | No test library needed. Node 21 or newer (glob arguments, see R-1); Node 24 in use. |
| Dependencies | None (no npm packages for game or tests) | `package.json` exists only to set `"type": "module"` and a `test` script. |

### Commands

Run the game (any static server; ES modules do not load from `file://`):
- VS Code Live Server: right-click `src/index.html` -> "Open with Live Server".
- Or from the repo root: `python -m http.server 8000` then open `http://localhost:8000/src/index.html`.
- Or: `npx http-server . -p 8000` (dev convenience only, not a project dependency).

Run the tests (from the repo root):
- `node --test "tests/**/*.test.js"` (quoted, so Node expands the glob, not the shell; works the same in PowerShell, cmd and bash)
- Same thing via npm: `npm test`
- Do not use the folder form `node --test tests/`: it fails on Node 24 (see Risk R-1).

---

## 2. File Structure

```
package.json                 # { "type": "module", "private": true, "scripts": { "test": "node --test \"tests/**/*.test.js\"" } } - no dependencies
src/
  index.html                 # page shell: <canvas id="game">, loads main.js as type="module"
  style.css                  # page layout, canvas scaling, dark background
  game-logic.js              # ALL game rules, pure functions, constants
  words.js                   # static word list (export const WORDS)
  renderer.js                # draws a state onto the canvas; no rules
  main.js                    # boot, rAF loop, keyboard + focus-loss listeners
tests/
  fixtures.js                # test helpers: seqRng(), makeState(), makeWord(), small word index
  difficulty.test.js         # level, spawn interval, fall speed, length range, points, accuracy
  input.test.js              # handleKey: target selection, locking, typos, Backspace, Escape, destroy, Enter per state
  spawn.test.js              # trySpawn: length band, duplicates, first-letter rule, 10-word cap, x range, rng order
  update.test.js             # update: movement, dt cap, misses, lives, game over, spawn timer, banner/flash timers
  pause.test.js              # handleFocusLoss + resume: freezing, dt=0 on resume, target kept, AC-10.x
  state.test.js              # createInitialState, startGame, state machine transitions, game-over Enter guard
  words.test.js              # word list content rules (Section 4.5)
```

All paths inside `src/` import each other with relative paths (`./game-logic.js`), so the game works whether the server root is the repo root or `src/`.

---

## 3. Modules

### `src/game-logic.js` (pure)
Owns every rule in the PRD: the state machine, scoring, difficulty formulas, word spawning and selection, falling, misses, lives, input matching, accuracy, pause/resume, the dt cap, timers for the flash and banner, and the game-over Enter guard.

Purity rules (hard constraint):
- No `document`, `window`, `performance`, `Date`, `setTimeout`, `requestAnimationFrame`, `Math.random`.
- Time comes in only as the `dtSec` argument of `update`.
- Randomness comes in only as an `rng` function argument (`() => number` in `[0, 1)`). Given the same state, dt, and rng sequence, the result is always the same.
- Functions never mutate their input. Every state-changing function returns a new state object (and a new `words` array when words change). With at most 10 words, copying is cheap.
- Imports nothing. The word list is passed in as a parameter, so tests can use a tiny list.

### `src/words.js`
Exports `WORDS`: a frozen array of lowercase a-z strings, at least 40 per length 3..8 (Section 7). Data only, no logic.

### `src/renderer.js`
Draws the current state. Reads state, never changes it. Knows layout, colors, fonts, and pixel offsets. Contains no game rules (it does not decide whether a word is missed, what the level is, etc.; it only reads fields).

### `src/main.js`
Browser glue only:
- Creates the initial state, builds the word index once (`buildWordIndex(WORDS)`), creates the renderer.
- rAF loop: computes raw `dtSec` from timestamps, calls `update`, then `render`.
- `keydown` on `window`: filters/forwards `event.key` to `handleKey`, calls `preventDefault` for game keys.
- `visibilitychange` (hidden) and `window` `blur`: call `handleFocusLoss`.
- Passes `Math.random` as `rng`. This is the only place randomness and real time enter the game.

### `src/index.html` / `src/style.css`
Static shell. Canvas element with `tabindex="0"`, script `<script type="module" src="./main.js">`. CSS centers the canvas, scales it to fit the window while keeping aspect ratio, sets `overflow: hidden` on `body` (no scrolling).

---

## 4. Game State

### 4.1 Constants (exported from `game-logic.js` as frozen `CONFIG`)

| Name | Value | PRD |
|---|---|---|
| `FIELD_WIDTH` | 800 | 4.1 |
| `FIELD_HEIGHT` | 600 (miss line, y >= 600) | 4.1, AC-5.1 |
| `START_LIVES` | 3 | 4.1 |
| `MAX_ACTIVE_WORDS` | 10 | AC-2.6 |
| `SPAWN_Y` | 0 | AC-2.2 |
| `MARGIN_X` | 10 | AC-2.2 |
| `MAX_DT_SEC` | 0.1 | AC-2.8 |
| `LEVEL_DURATION_SEC` | 30 | AC-8.1 |
| `MAX_LEVEL` | 10 | AC-8.1 |
| `BASE_SPAWN_MS`, `SPAWN_STEP_MS`, `MIN_SPAWN_MS` | 2000, 150, 650 | AC-8.2 |
| `BASE_SPEED`, `SPEED_STEP`, `MAX_SPEED` | 40, 10, 130 | AC-8.3 |
| `LENGTH_RANGES` | `{1:[3,4],2:[3,4],3:[3,5],4:[3,5],5:[4,6],6:[4,6],7:[4,7],8:[5,7],9:[5,8],10:[5,8]}` | 4.3 |
| `POINTS_PER_CHAR` | 10 | AC-7.1 |
| `FIRST_SPAWN_DELAY_MS` | 0 | AC-1.4 |
| `MAX_PICK_ATTEMPTS` | 10 | AC-2.4 |
| `FLASH_MS` | 300 | AC-5.5 |
| `BANNER_MS` | 1000 | AC-9.4 |
| `GAME_OVER_GUARD_MS` | 500 | AC-6.5 |
| `FONT_SIZE_PX` | 24 | NFR-8 |
| `CHAR_WIDTH_PX` | 15 | AC-2.2 (upper bound of monospace advance at 24 px, about 0.6 em = 14.4 px) |

Tuning after playtest (PRD 4.3 note) only changes these constants.

### 4.2 State object

```js
// type Status = 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'
// type Word   = { id: number, text: string, x: number, y: number }
{
  status: 'START',          // Status
  score: 0,                 // integer >= 0
  lives: 3,                 // integer 0..3
  level: 1,                 // integer 1..10, always == levelForElapsed(elapsedSec) while PLAYING/PAUSED
  elapsedSec: 0,            // game time, advances only in PLAYING
  words: [],                // Word[] active words, in spawn order (ascending id)
  nextWordId: 1,            // id for the next spawned word; ids grow monotonically => "spawned first" = smaller id
  targetId: null,           // number | null, id of the target word
  typed: '',                // typed prefix of the target ('' when targetId is null)
  wordsDestroyed: 0,        // integer
  typos: 0,                 // integer
  correctKeystrokes: 0,     // integer, for accuracy (AC-6.3)
  spawnTimerMs: 0,          // ms of game time remaining until the next scheduled spawn
  flashMs: 0,               // ms remaining of the life-lost flash (0 = off); always 0 in GAME_OVER
  bannerMs: 0,              // ms remaining of the "Level N" banner (0 = off); banner shows state.level
  gameOverMs: 0,            // ms spent in GAME_OVER (for the Enter guard)
  skipNextDt: false         // true => the next update() uses dt = 0 (after start / resume)
}
```

Word `x` is the left edge of the text in logical px. Word `y` is the baseline in logical px (PRD definition). Word width is `text.length * CHAR_WIDTH_PX`.

`createInitialState()` returns exactly the object above (START). `startGame()` returns the same values but `status: 'PLAYING'`, `spawnTimerMs: FIRST_SPAWN_DELAY_MS`, `skipNextDt: true` (AC-1.3, AC-6.4).

### 4.3 State machine

```
            Enter                    lives reach 0 (in update)
  START  ---------->  PLAYING  ------------------------------>  GAME_OVER
                       |   ^                                      |
          focus loss   |   | Enter (no guard)                     | Enter, only if gameOverMs >= 500
          (handleFocusLoss)| (handleKey)                          | -> startGame() (fresh state, PLAYING)
                       v   |                                      |
                      PAUSED                     PLAYING <--------+
```

| From | Event | To | Notes |
|---|---|---|---|
| START | Enter | PLAYING | `startGame()`; all other keys ignored (AC-1.2) |
| START | focus loss | START | no-op (AC-10.2) |
| PLAYING | lives become 0 in `update` | GAME_OVER | same update call; no spawn after (AC-6.1); `gameOverMs = 0`, `flashMs = 0`, target cleared |
| PLAYING | focus loss | PAUSED | synchronous in the event handler (AC-10.1) |
| PLAYING | Enter | PLAYING | no-op (AC-3.10) |
| PAUSED | Enter | PLAYING | sets `skipNextDt = true`, keeps target/typed (AC-10.6, AC-10.7) |
| PAUSED | any other key, focus loss, focus gain | PAUSED | no-op (AC-10.5, AC-10.2, AC-10.8) |
| GAME_OVER | Enter with `gameOverMs < 500` | GAME_OVER | ignored (AC-6.5) |
| GAME_OVER | Enter with `gameOverMs >= 500` | PLAYING | `startGame()` (AC-6.4) |
| GAME_OVER | focus loss / other keys | GAME_OVER | no-op |

There is no transition back to START after the first game.

---

## 5. Function Signatures (`src/game-logic.js`)

All functions are named exports. "Returns new state" means the input is not mutated.

### 5.1 State lifecycle

| Function | Returns | ACs |
|---|---|---|
| `createInitialState()` | START state (Section 4.2) | AC-1.1 |
| `startGame()` | fresh PLAYING state: score 0, lives 3, level 1, elapsed 0, no words, no target, counters 0, `spawnTimerMs = 0`, `skipNextDt = true` | AC-1.3, AC-1.4, AC-6.4 |
| `update(state, dtSec, rng, wordsByLength)` | new state after one frame | AC-1.4, AC-2.1-2.9, AC-5.1-5.5, AC-6.1, AC-6.5 (timer), AC-8.x, AC-9.2, AC-9.4, AC-10.3, AC-10.6 |
| `handleKey(state, key)` | new state after one keydown. `key` is `KeyboardEvent.key` (e.g. `'a'`, `'A'`, `'Enter'`, `'Backspace'`, `'Escape'`, `'1'`, `' '`, `'ArrowUp'`, `'Shift'`) | AC-1.2, AC-3.1-3.8, AC-3.10, AC-3.11, AC-4.1-4.4, AC-6.4, AC-6.5, AC-7.x, AC-10.5-10.8 |
| `handleFocusLoss(state)` | PAUSED copy if `status === 'PLAYING'`, otherwise the same state unchanged | AC-10.1, AC-10.2, AC-10.9 |

```js
export function update(state, dtSec, rng, wordsByLength) { /* ... */ }
// rng: () => number in [0, 1)
// wordsByLength: { [len: number]: string[] } from buildWordIndex()
```

### 5.2 Difficulty and scoring (pure number functions)

| Function | Returns | ACs |
|---|---|---|
| `levelForElapsed(elapsedSec)` | `min(10, 1 + floor(elapsedSec / 30))` | AC-8.1, AC-8.5 |
| `spawnIntervalMs(level)` | `max(650, 2000 - 150*(level-1))` | AC-8.2, AC-8.5 |
| `fallSpeed(level)` | px/s, `min(130, 40 + 10*(level-1))` | AC-8.3, AC-8.5 |
| `lengthRange(level)` | `[min, max]` from `LENGTH_RANGES` | AC-8.4, 4.3 |
| `pointsFor(wordLength, level)` | `10 * wordLength * level` | AC-7.1, AC-7.2 |
| `accuracyPercent(correct, typos)` | integer 0..100; `Math.round(correct / (correct + typos) * 100)`; 0 when both are 0 | AC-6.3 |
| `clampDt(dtSec)` | `min(max(dtSec, 0), MAX_DT_SEC)` (negative/NaN -> 0) | AC-2.8 |

### 5.3 Words and spawning

| Function | Returns | ACs |
|---|---|---|
| `buildWordIndex(words)` | `{ 3: [...], 4: [...], ..., 8: [...] }` grouping by length | AC-2.3 |
| `wordWidth(text)` | `text.length * CHAR_WIDTH_PX` | AC-2.2 |
| `spawnX(text, r)` | `MARGIN_X + r * (FIELD_WIDTH - 2*MARGIN_X - wordWidth(text))`, with `r` in `[0,1)` | AC-2.2 |
| `trySpawn(state, rng, wordsByLength)` | new state with one more word, or the same state if the spawn is skipped. Does NOT touch `spawnTimerMs` (the caller `update` reschedules). | AC-2.2-2.6, AC-8.4 |

`trySpawn` rng consumption order (fixed, so QA can script a fake rng):
1. If `words.length >= 10`: skip. No rng call.
2. `len = min + floor(rng() * (max - min + 1))` using `lengthRange(state.level)`. (1 call)
3. Up to 10 attempts: `text = list[floor(rng() * list.length)]` (1 call per attempt). Accept if no active word has the same text AND (no target OR `text[0] !== targetText[0]`). Otherwise try again.
4. If all 10 attempts fail: skip.
5. `x = spawnX(text, rng())` (1 call). Add `{ id: nextWordId, text, x, y: 0 }`, increment `nextWordId`.

### 5.4 Input helpers

| Function | Returns | ACs |
|---|---|---|
| `normalizeKey(key)` | `'a'..'z'` for single-character letters (lowercased), `'Enter'`, `'Backspace'`, `'Escape'`, or `null` for everything else | AC-3.1 |
| `findTargetFor(words, letter)` | the word starting with `letter` with the largest `y`, ties -> smallest `id`; or `null` | AC-3.2 |
| `getTarget(state)` | the target `Word` or `null` | AC-3.9 (used by renderer) |

### 5.5 Renderer and main (not unit-tested, listed for the Developer)

```js
// renderer.js
export function createRenderer(canvas) // -> { render(state) }
// main.js has no exports; it wires everything at load.
```

---

## 6. How Each PRD Rule Is Implemented

### 6.1 `update(state, dtSec, rng, wordsByLength)` order of operations

- `START`, `PAUSED`: return state unchanged. Nothing advances (AC-10.3).
- `GAME_OVER`: return copy with `gameOverMs += clampDt(dtSec) * 1000`. Nothing else changes (AC-6.1).
- `PLAYING`:
  1. `dt = state.skipNextDt ? 0 : clampDt(dtSec)`; set `skipNextDt = false` (AC-2.8, AC-10.6).
  2. Timers: `flashMs = max(0, flashMs - dt*1000)`, `bannerMs = max(0, bannerMs - dt*1000)` (game time, AC-5.5, AC-9.4).
  3. Time and level: `elapsedSec += dt`; `newLevel = levelForElapsed(elapsedSec)`; if `newLevel > level`: set `level`, `bannerMs = 1000` (AC-8.1, AC-9.4).
  4. Movement: every word `y += fallSpeed(level) * dt` (current level for all words, AC-2.7, AC-2.9).
  5. Misses: every word with `y >= 600` is removed; `lives = max(0, lives - 1)` per word; if it was the target, `targetId = null`, `typed = ''`; set `flashMs = 300` if any miss (AC-5.1-5.5). Score unchanged.
  6. Game over: if `lives === 0`: `status = 'GAME_OVER'`, `gameOverMs = 0`, `flashMs = 0`, `targetId = null`, `typed = ''`; return (no spawn in this frame, AC-6.1). Clearing `flashMs` overrides the `flashMs = 300` set by step 5 for the final miss, so a GAME_OVER state never carries an active flash (Q-7, resolved in logic).
  7. Spawn timer: `spawnTimerMs -= dt*1000`; if `spawnTimerMs <= 0`: `state = trySpawn(...)` and `spawnTimerMs += spawnIntervalMs(level)` whether or not the spawn was skipped (AC-2.1, AC-2.4, AC-2.6). Using `+=` (not `=`) keeps the cadence exact across frames. Because `MAX_DT_SEC` (100 ms) < `MIN_SPAWN_MS` (650 ms), at most one spawn per update. AC-2.1 reading (confirmed by the user, OI-3): `spawnIntervalMs(level)` is read only here, at reschedule time, using the level after step 3 of the same update. A countdown that is already running is never shortened or lengthened by a level-up; it finishes with the interval it was scheduled with, and the new level's interval applies from the next reschedule onward.

### 6.2 Specific rules

| Rule | Implementation |
|---|---|
| First spawn <= 500 ms (AC-1.4) | `startGame` sets `spawnTimerMs = 0`, so the first PLAYING update (dt = 0 via `skipNextDt`) spawns the first word at elapsed 0. |
| Level change at next scheduled spawn (AC-2.1) | Confirmed by the user (OI-3). The interval is read only at the moment of rescheduling (step 7). The countdown already running when the level goes up keeps the old level's interval; the new level's interval applies from the next reschedule, i.e. to the gap after the next spawn. `spawnTimerMs` is never recomputed on level-up. Example: at level 1 a spawn at 28.0 s schedules the next at 30.0 s (2000 ms); the level becomes 2 at 30.0 s, the spawn at 30.0 s reschedules with 1850 ms, so the following spawn is at 31.85 s. |
| Fall speed / frame-rate independence (AC-2.7, NFR-3) | `y += speed * dt` with real `dt`. 15.0 s at 40 px/s for any frame rate, up to float error. |
| Length bands (AC-2.3, AC-8.4) | `lengthRange(level)` + uniform `floor(rng()*(n))` index; the word is then picked from `wordsByLength[len]` only. |
| No duplicates (AC-2.4) | Step 3 of `trySpawn`; 10 attempts, then skip. |
| No shared first letter with target (AC-2.5) | Same check as duplicates, in the same attempt loop (see Q-1). Uses the target at the moment of the spawn. |
| Max 10 active (AC-2.6) | Checked first in `trySpawn`; timer still rescheduled. |
| x inside field (AC-2.2) | `spawnX`; with max word length 8 the width is 120 px, so the range is `[10, 670)`. Renderer uses `textAlign = 'left'` and the same monospace font so the drawn width <= `wordWidth`. |
| dt cap (AC-2.8) | `clampDt` inside `update` (logic, so testable). `main.js` passes the raw dt. |
| Target selection (AC-3.2) | `handleKey`, no target: `findTargetFor(words, letter)`. If found: `targetId = word.id`, `typed = letter`, `correctKeystrokes++`. If the word has length 1 it would be destroyed immediately (cannot happen: min length 3). If not found: `typos++` (AC-3.6). |
| Target lock (AC-3.3) | With a target, the letter is compared only with `target.text[typed.length]`. Other words are never consulted. |
| Correct key (AC-3.4) | `typed += letter`, `correctKeystrokes++`; then if `typed.length === text.length` -> destroy. |
| Typo with target (AC-3.5) | `typos++` only. |
| Destroy (AC-4.1-4.3) | In the same `handleKey` call: remove word, `score += pointsFor(len, state.level)` (current level, AC-7.2), `wordsDestroyed++`, `targetId = null`, `typed = ''`. Misses are only detected in `update`, so a word destroyed by a key is never also missed. |
| Backspace (AC-3.7) | With target: `typed = typed.slice(0, -1)`; if empty, `targetId = null`. Without target: no-op. Never touches counters. |
| Escape (AC-3.8) | `targetId = null`, `typed = ''`. Word unchanged. |
| Ignored keys (AC-3.1, AC-3.10) | `normalizeKey` returns `null` -> state returned unchanged. In START/PAUSED/GAME_OVER only `'Enter'` is handled. In PLAYING, `'Enter'` is a no-op. |
| Key repeat (AC-3.11) | `main.js` does NOT filter `event.repeat`; every keydown is forwarded. |
| Modifier combos | `main.js` does not forward keydowns with `ctrlKey`, `metaKey` or `altKey` (so browser shortcuts like Ctrl+R still work), nor events with `isComposing`. Shift+letter is forwarded (case-insensitive). See Q-5. |
| Game-over Enter guard (AC-6.5) | `gameOverMs` is accumulated by `update` while in GAME_OVER (real frame time, capped). `handleKey` accepts Enter only when `gameOverMs >= 500`. |
| Accuracy (AC-6.3) | `accuracyPercent(correctKeystrokes, typos)`, computed by the renderer at display time from state fields. |
| Life-lost flash (AC-5.5) | `flashMs` set to 300 in update; renderer draws a red border while `flashMs > 0`. Frozen while PAUSED because `update` does nothing there. On the final miss, step 6 resets `flashMs` to 0 when entering GAME_OVER, so no flash is carried into the results screen (Q-7). The renderer may still skip the flash in GAME_OVER as a second safeguard. |
| Level banner (AC-9.4) | `bannerMs` set to 1000 on level up; renderer shows "Level N" (N = `state.level`) while `bannerMs > 0`. |
| Focus loss (AC-10.1) | `main.js`: `document.addEventListener('visibilitychange', ...)` when `document.visibilityState === 'hidden'`, and `window.addEventListener('blur', ...)`; both call `state = handleFocusLoss(state)` synchronously. Both may fire for one tab switch; the second is a no-op (AC-10.2). |
| Pause freezing (AC-10.3) | `update` returns PAUSED state unchanged, so y, elapsed, level, spawn timer, flash, banner are all frozen for any pause length. |
| Resume (AC-10.6, AC-10.8) | Only `handleKey(state, 'Enter')` in PAUSED resumes: `status = 'PLAYING'`, `skipNextDt = true`. Focus gain has no listener. `main.js` also resets its `lastTimestamp` on resume (belt and braces), but the logic flag alone guarantees dt = 0. |
| Pause keeps target (AC-10.7) | `handleFocusLoss` only changes `status`. |
| GAME_OVER vs focus loss (AC-10.9) | JS runs event handlers and rAF callbacks one at a time. If `update` already set GAME_OVER, a later focus loss is a no-op. If the focus loss is handled first, the game pauses before the life is lost, and no life is lost while paused. Both outcomes satisfy the AC. |
| NFR-6 focus/defaults | Listen for `keydown` on `window` (no click needed); `canvas.focus()` at load. `preventDefault()` for letters, Backspace, Escape, Enter and Space when no ctrl/meta/alt modifier is held. |

### 6.3 Rendering layout

- Canvas logical size: 800 x 680. Top 40 px: HUD strip ("Score: N", "Lives: N", "Level: N"), outside the word area (AC-9.1, AC-9.3).
- Playfield origin at canvas y = 40 + 28 = 68: the 28 px pad keeps the glyphs of a word with baseline y = 0 fully visible (text sits above its baseline). 12 px pad below y = 600 for descenders. Canvas height = 40 + 28 + 600 + 12 = 680.
- Canvas backing store is scaled by `devicePixelRatio`; CSS scales the element to fit the window, keeping aspect ratio (PRD: playfield may be scaled for display).
- Colors (dark theme): background `#101418`, words `#e8e8e8`, target untyped `#ffd54a` + underline, typed prefix `#4cd964`. All have contrast > 4.5:1 on the background (NFR-8). Life flash: 6 px red border `#ff3b30`.
- Per state: START -> title, "Press Enter to start", instruction line, no words (AC-1.1). PLAYING -> HUD, words, banner, flash. PAUSED -> HUD + frozen words + semi-transparent overlay with "Paused - press Enter to resume" (AC-10.4, AC-9.5). GAME_OVER -> "Game Over", score, level, words destroyed, accuracy "N%", "Press Enter to play again"; active words are not drawn (AC-6.1, AC-6.2).
- The renderer draws every rAF frame after `update`, so any keydown-handled change appears in the next frame (AC-9.2, NFR-5).

---

## 7. Word List Source and Format

- File: `src/words.js`, loaded as an ES module import by `main.js` at page load (no `fetch`, no request after load; NFR-1, PRD 4.5).
- Format:
  ```js
  export const WORDS = Object.freeze([ 'cat', 'sun', /* ... */ 'keyboard' ]);
  ```
- Content (Developer writes it in-house from common English vocabulary): lowercase `a-z` only, no proper nouns, no profanity, no duplicates, at least 40 words for each length 3, 4, 5, 6, 7, 8 (>= 240 total). Words of other lengths are not allowed (they would never be used).
- Recommendation: aim for 50+ per length and spread first letters, so the no-duplicate / first-letter retry rarely fails.
- `tests/words.test.js` enforces all of the above automatically.

---

## 8. Traceability

| Story / ACs | Logic (`game-logic.js`) | Renderer / Main | Test file |
|---|---|---|---|
| US-1 AC-1.1-1.4 | `createInitialState`, `startGame`, `handleKey` (Enter in START), `update` (first spawn) | renderer START screen; main boot | `state.test.js`, `update.test.js` |
| US-2 AC-2.1-2.6 | `trySpawn`, `spawnX`, `wordWidth`, `buildWordIndex`, `update` step 7 | main passes `Math.random` | `spawn.test.js`, `update.test.js` |
| US-2 AC-2.7-2.9 | `update` steps 1, 3, 4; `clampDt`, `fallSpeed` | main computes raw dt | `update.test.js`, `difficulty.test.js` |
| US-3 AC-3.1-3.8, 3.10, 3.11 | `handleKey`, `normalizeKey`, `findTargetFor` | main keydown filter, `preventDefault`, no repeat filter | `input.test.js` |
| US-3 AC-3.9 | `getTarget` | renderer target / prefix colors | manual |
| US-4 AC-4.1-4.4 | `handleKey` destroy path | - | `input.test.js` |
| US-5 AC-5.1-5.4 | `update` step 5 | - | `update.test.js` |
| US-5 AC-5.5 | `flashMs` in `update` | renderer red border | `update.test.js` (timer), manual (visual) |
| US-6 AC-6.1, 6.4, 6.5 | `update` step 6 + GAME_OVER branch, `handleKey` Enter guard, `startGame` | renderer hides words | `state.test.js`, `update.test.js` |
| US-6 AC-6.2, 6.3 | `accuracyPercent` | renderer GAME_OVER screen | `difficulty.test.js`, manual |
| US-7 AC-7.1-7.3 | `pointsFor`, `handleKey` destroy path | - | `difficulty.test.js`, `input.test.js` |
| US-8 AC-8.1-8.5 | `levelForElapsed`, `spawnIntervalMs`, `fallSpeed`, `lengthRange`, `update` step 3 | - | `difficulty.test.js`, `spawn.test.js` |
| US-9 AC-9.1-9.3, 9.5 | state fields | renderer HUD strip, layout | manual |
| US-9 AC-9.4 | `bannerMs` in `update` | renderer banner | `update.test.js`, manual |
| US-10 AC-10.1-10.10 | `handleFocusLoss`, `handleKey` (PAUSED), `update` (PAUSED no-op, `skipNextDt`) | main focus listeners, overlay | `pause.test.js`, manual (real tab switch) |
| PRD 4.5 word list | `buildWordIndex` | `words.js` | `words.test.js` |
| NFR-2, 3, 6, 8 | `clampDt`, dt-based movement | renderer, main | `update.test.js` (NFR-3 at 30/144 fps), manual |

---

## 9. Testing Notes

### How to test
- `node --test "tests/**/*.test.js"` (or `npm test`) from the repo root. Test files import `../src/game-logic.js` and `../src/words.js` directly; no browser, no DOM (NFR-7).
- Do NOT import `renderer.js` or `main.js` in tests (they touch the DOM).

### Fixtures (`tests/fixtures.js`)
- `seqRng(values)`: returns `() => values[i++]`, throws if the sequence runs out (so tests catch unexpected rng calls).
- `makeState(overrides)`: `{ ...startGame(), skipNextDt: false, ...overrides }` to put the game into any situation without playing to it.
- `makeWord(id, text, y, x = 100)`.
- A tiny `wordsByLength` (e.g. `{3:['cat','car','dog'], 4:['tree','toad'], ...}`) to make picks predictable.

### What to test per module
- **Pure formulas**: every row of the 4.3 table for `levelForElapsed` (0, 29.9, 30, 270, 600), `spawnIntervalMs`, `fallSpeed`, `lengthRange` for levels 1-10; `pointsFor` PRD examples (30, 240, 800); `accuracyPercent` (0/0 -> 0, rounding); `clampDt` (2.0 -> 0.1, negative -> 0).
- **`handleKey`**: every AC-3.x and AC-4.x example, including the "cat"/"car" lock example, tie-break by y then id, uppercase letters, ignored keys (digits, space, arrows, `'Shift'`), Enter in each status, Enter guard at `gameOverMs` 499 vs 500, PAUSED ignoring letters/Backspace/Escape (state deep-equals input).
- **`trySpawn`**: scripted rng to hit each branch: duplicate retry, first-letter retry, 10 failed attempts -> skip, 10 active words -> skip with no rng calls, x bounds with r = 0 and r -> 1 (`0.999999`), length bounds per level, `id` increment.
- **`update`**: movement over N frames at 30 fps and 144 fps reaches y = 600 at 15.0 s +/- 0.1 s; dt cap; multiple misses in one frame; lives never < 0; GAME_OVER in same update, no spawn after; final miss -> GAME_OVER state has `flashMs === 0` (Q-7; e.g. `lives: 1`, one word at `y: 599.9`, `update(state, 0.05, ...)`, assert `status === 'GAME_OVER'` and `flashMs === 0`), while a non-final miss still sets `flashMs === 300`; spawn cadence (first spawn at t = 0, next at 2000 ms at level 1); AC-2.1 confirmed reading: a countdown running across the 30 s boundary still finishes on the old 2000 ms interval, and only the reschedule after that spawn uses 1850 ms (see the 6.2 example); banner/flash timers count down in game time.
- **Pause**: `handleFocusLoss` in each status; `update(paused, 60, ...)` changes nothing (60-second pause); resume -> first update with dt = 1.0 leaves y unchanged; spawn timer remaining 700 ms is still 700 ms after the pause; target and typed kept; counters identical to a no-pause run (AC-10.10: run the same input/rng script with and without a pause and compare).
- **Immutability**: after any call, the input state is deep-equal to a `structuredClone` taken before the call.
- **Word list**: lowercase a-z only, no duplicates, lengths only 3-8, >= 40 per length.

### Manual checks (cannot be unit-tested)
AC-3.9 colors, AC-5.5 flash duration, AC-9.1-9.4 HUD layout and banner, AC-10.4 overlay, real tab switch and window blur, NFR-2 performance, NFR-6 no scrolling / back navigation, NFR-8 font size and contrast, all four browsers.

---

## 10. Risks

- **R-1 Test command and Node versions.** Since Node 21 the test runner treats its arguments as glob patterns, and the folder form `node --test tests/` fails on the installed Node v24.13.1. The primary (and only documented) command is therefore `node --test "tests/**/*.test.js"`, which `package.json`'s `test` script already uses. The pattern must stay quoted so Node, not the shell, expands it. All test files must end in `.test.js`; `tests/fixtures.js` is deliberately not matched. Requires Node 21 or newer (glob support); Node 24 is the version in use.
- **R-2 ESM in Node.** Without `"type": "module"` in `package.json`, Node may load `src/*.js` as CommonJS (or warn). The root `package.json` (no dependencies) fixes this. The browser ignores it.
- **R-3 Text width.** AC-2.2 depends on rendered width, but the logic cannot measure text. The design assumes a monospace font with advance <= 15 px at 24 px. If a system font is wider, a word could exceed the right margin. Mitigation: renderer can check `ctx.measureText('m').width` at boot and log a warning; the constant is conservative (0.625 em).
- **R-4 Floating-point time.** `elapsedSec` is a sum of frame dts, so the 30 s boundary is crossed within one frame (<= 16.7 ms), not exactly at 30.000. Exact boundary tests should target `levelForElapsed`, not `update` sequences.
- **R-5 Spurious blur.** Clicking the browser address bar or devtools fires `blur` and pauses the game. This is intended (AC-10.1) but testers should expect it.
- **R-6 `file://` loading.** Opening `index.html` by double-click fails (ES modules need HTTP). Documented in Section 1.
- **R-7 Game-over guard while hidden.** The guard counts frame time; rAF stops in hidden tabs, so the guard can only take longer, never shorter. Acceptable.

---

## 11. Questions for PO

None of these block development; the design uses the stated default.

- **Q-1 AC-2.4 vs AC-2.5 retry budget.** Does a pick rejected for sharing the target's first letter use one of the 10 attempts from AC-2.4? Default: yes, one shared loop of 10 attempts for both checks; if all fail, the spawn is skipped.
- **Q-2 Length on retry.** When a pick is rejected, is the length re-rolled or only the word? Default: the length is chosen once per spawn; only the word is re-picked.
- **Q-3 Baseline at y = 0.** With the baseline at y = 0, a new word's glyphs are above the 600 px area, but AC-9.3 says words are fully visible from y = 0. Default: the renderer adds a 28 px pad above the playfield so the glyphs show; logic still uses baseline y from 0 to 600.
- **Q-4 Accuracy rounding.** "Nearest integer" for exact .5 cases (e.g. 66.5%). Default: round half up (`Math.round`).
- **Q-5 Modifier keys.** AC-3.1 ignores "modifier keys alone", but does Ctrl/Alt/Cmd + letter count as a letter? Default: no, these combos are ignored (and left to the browser). Shift + letter counts.
- **Q-6 AC-6.5 time base.** GAME_OVER has no game time. Default: the 500 ms guard uses real frame time (capped dt) spent on the GAME_OVER screen.
- **Q-7 Final-life flash.** When the last life is lost, the game goes straight to GAME_OVER; should the red flash (AC-5.5) still show on the results screen? Default: no. This is enforced in the logic: `update` sets `flashMs = 0` when it enters GAME_OVER (6.1 step 6), so it is unit-testable (assert `flashMs === 0` on the GAME_OVER state after the final miss). The renderer also skips the flash in GAME_OVER.
- **Q-8 First spawn timing.** AC-1.4 allows up to 500 ms. Default: the first word spawns at elapsed 0, and later spawns follow the interval from that moment.

### Confirmed readings (no longer open)

- **AC-2.1 level change and the spawn timer** (confirmed by the user, OI-3). The countdown already running keeps the old interval; the new level's interval applies from the next reschedule. See 6.1 step 7 and the AC-2.1 row in 6.2.

---

## 12. Changelog

### 2026-10-06 - Revision 2
- **Test command.** Replaced every `node --test tests/` with `node --test "tests/**/*.test.js"` (Section 1 commands and tech-stack row, Section 2 `package.json` line, Section 9 "How to test"). R-1 now states the glob is the primary command, not a fallback. Reason: the folder form fails with the Node 24 test runner (installed v24.13.1), which treats arguments as glob patterns.
- **Flash cleared at game over.** 6.1 step 6 now sets `flashMs = 0` when the state becomes GAME_OVER; updated the 4.2 state comment, the 4.3 transition table, the AC-5.5 row in 6.2, Q-7 and the `update` testing notes. Reason: Q-7 ("no red flash on the last life") now holds in the logic itself and is unit-testable, not only because the renderer skips it (TEST_REPORT Round 1, OI-1 / F-3).
- **AC-2.1 reading confirmed.** Made explicit in 6.1 step 7, the AC-2.1 row in 6.2 (with a worked example) and the `update` testing notes: a running countdown keeps the old interval, and the new level's interval applies from the next reschedule. Recorded under "Confirmed readings" in Section 11. Reason: the user confirmed the current design (OI-3).

### 2026-10-06 - Revision 1
- First version of the design.
