# Typing Defense - Test Report

---

## Round 1

- **Date:** 2026-10-06
- **Node version:** v24.13.1
- **Command run:** `npm test` (from the repo root). `package.json` maps it to `node --test "tests/**/*.test.js"`.
- **Sources under test:** `src/game-logic.js` and `src/words.js` (unit tests). I also read `src/main.js`, `src/renderer.js`, `src/index.html` and `src/style.css` to check behaviour the unit tests can't reach.

### Summary

| Test file | Tests | Pass | Fail | Skipped | Todo |
|---|---|---|---|---|---|
| `tests/difficulty.test.js` | 61 | 61 | 0 | 0 | 0 |
| `tests/input.test.js` | 45 | 45 | 0 | 0 | 0 |
| `tests/spawn.test.js` | 34 | 34 | 0 | 0 | 0 |
| `tests/update.test.js` | 42 | 42 | 0 | 0 | 0 |
| `tests/pause.test.js` | 22 | 22 | 0 | 0 | 0 |
| `tests/state.test.js` | 21 | 21 | 0 | 0 | 0 |
| `tests/words.test.js` | 13 | 13 | 0 | 0 | 0 |
| **Total** | **238** | **238** | **0** | **0** | **0** |

Raw totals from `npm test`: `tests 238, suites 0, pass 238, fail 0, cancelled 0, skipped 0, todo 0` (about 670 ms). I got the per-file counts by running `node --test <file>` on each file separately.

### Failures

None.

### Findings from reading `src/` (not covered by automated tests)

| ID | Where | Finding | Severity |
|---|---|---|---|
| F-1 | `renderer.js` `drawBanner` | The "Level N" banner (bold, 48 px, yellow) is drawn on top of the words at the middle of the playfield, around y = 300, for 1 s. A word passing through that band can be partly hidden. AC-9.3 only restricts the HUD, but it also says "Words are always fully visible from y = 0 to y = 600". I'm recording this as a spec question, not a defect. It should be confirmed during manual check M-6. | Low |
| F-2 | `main.js` `onKeyDown` | Tab is not in `GAME_KEYS`, so `preventDefault` is not called for it. Pressing Tab moves browser focus. Game input keeps working, because the listener is on `window`, but repeated Tabs can move focus to the browser UI, which fires `blur` and pauses the game. This matches AC-10.1 behaviour and is not a defect. Testers should expect it, as with R-5. | Info |
| F-3 | `update()` step 5 | `flashMs` is set to 300 even when the last life is lost, so the GAME_OVER state still has `flashMs = 300`. `renderer.js` does not draw the flash in GAME_OVER (it has a comment citing Q-7), so Q-7 is met by the renderer only. See open issue OI-1. | Info |

These match the design:
- **Q-5:** `main.js` returns early for `ctrlKey`, `metaKey`, `altKey` and `isComposing` before calling `handleKey` or `preventDefault`. Shift+letter is forwarded.
- **Q-3:** `renderer.js` has `TOP_PAD = 28` (playfield y = 0 is at canvas y = 68) and a 12 px bottom pad, giving an 800 x 680 canvas.
- **Q-7:** the GAME_OVER branch draws only the results screen: no words, banner or flash.
- **AC-9.5:** the pause overlay starts below the 40 px HUD strip, so the HUD stays visible while paused.
- **R-3:** the renderer warns in the console if `measureText('m')` is wider than `CHAR_WIDTH_PX` (15).
- **AC-3.11:** `event.repeat` is not filtered.
- **NFR-6:** the listener is on `window` and `canvas.focus()` is called at load. `preventDefault` is called for letters, Enter, Backspace, Escape and Space.
- **AC-10.8:** there is no focus-gain listener, so regaining focus never resumes the game.

### AC coverage

| AC | Automated (test file) | Manual |
|---|---|---|
| AC-1.1 | Initial state and no words (`state`, `update`) | Screen text (M-1) |
| AC-1.2, AC-1.3 | `state`, `input` | - |
| AC-1.4 | `update`, `state` (Q-8) | - |
| AC-2.1 | `update` | - |
| AC-2.2 | `spawn`, `update` (logic width) | Real font width (M-12) |
| AC-2.3 to AC-2.6 | `spawn`, `update` (Q-1, Q-2) | - |
| AC-2.7 to AC-2.9 | `update`, `difficulty` | - |
| AC-3.1 to AC-3.8, AC-3.10, AC-3.11 | `input`, `pause`, `state` | Q-5 modifier combos (M-10) |
| AC-3.9 | - | M-3 |
| AC-4.1 to AC-4.4 | `input` | - |
| AC-5.1 to AC-5.4 | `update` | - |
| AC-5.5 | Timer only (`update`, `pause`) | Visual and duration (M-4), Q-7 (M-5) |
| AC-6.1 | `update`, `state` | Words not drawn on the results screen (M-2) |
| AC-6.2 | - | M-2 |
| AC-6.3 | `difficulty`, `input`, `pause` (Q-4) | "%" display (M-2) |
| AC-6.4, AC-6.5 | `state`, `update`, `pause` (Q-6) | - |
| AC-7.1 to AC-7.3 | `difficulty`, `input`, `state` | - |
| AC-8.1 to AC-8.5 | `difficulty`, `spawn`, `update` | - |
| AC-9.1 to AC-9.3, AC-9.5 | - (state fields only) | M-7 |
| AC-9.4 | Timer only (`update`, `pause`) | Visual and duration (M-6) |
| AC-10.1 | `pause` (logic) | Real tab switch and blur (M-8) |
| AC-10.2, AC-10.3, AC-10.5 to AC-10.7, AC-10.9, AC-10.10 | `pause`, `state` | - |
| AC-10.4 | - | M-8 |
| AC-10.8 | `pause` (Enter only, no guard) | Focus regain does not resume (M-8) |
| PRD 4.5 word list | `words` | - |
| NFR-3 | `update` (30 and 144 fps) | - |
| NFR-1, 2, 4, 6, 8 | - | M-13 to M-16 |
| Q-3 | - | M-11 |
| R-5 | - | M-9 |

### Manual Test Checklist

**Launch:** from the repo root run `python -m http.server 8000`, then open http://localhost:8000/src/index.html. Do not open the file with a double-click, because ES modules do not load from `file://`. Keep the browser devtools closed unless a step asks for them, because clicking into devtools pauses the game (R-5).

- [ ] **M-1 (AC-1.1) Start screen text**
  1. Load the page.
  2. Do not press any key.
  - **Expected:** the title "Typing Defense", the text "Press Enter to start" and the line "Type the falling words before they reach the bottom" are shown. No words and no HUD are on screen. Pressing letters, Space or Escape does nothing. Pressing Enter starts the game.

- [ ] **M-2 (AC-6.2, AC-6.3, AC-6.1) Results screen**
  1. Start a game. Destroy 2 or 3 words and make a few typos on purpose.
  2. Let 3 words reach the bottom.
  - **Expected:** the screen shows "Game Over", "Score: N", "Level reached: N", "Words destroyed: N", "Accuracy: N%" (an integer followed by "%") and "Press Enter to play again". No falling words are drawn.
  3. Press Enter immediately, then again after about 1 s.
  - **Expected:** an Enter pressed in the first 0.5 s is ignored. A later Enter starts a new game with Score 0, Lives 3 and Level 1.
  4. Start a game, press no letters, and let it end.
  - **Expected:** the results screen shows "Accuracy: 0%".

- [ ] **M-3 (AC-3.9) Target and prefix colours**
  1. Start a game and wait until 2 or more words are on screen.
  2. Type the first 2 letters of one word.
  - **Expected:** the target word is drawn differently from the others (yellow with an underline). The typed letters are green and the untyped letters are yellow. Other words are plain light grey and show no typed progress.
  3. Press Escape.
  - **Expected:** the word goes back to plain style.

- [ ] **M-4 (AC-5.5) Life-lost flash**
  1. Start a game and let one word reach the bottom while you still have 2 or more lives.
  - **Expected:** a red border appears around the playfield for about 300 ms (250-350 ms; a screen recording helps to check this). The game keeps running, and the HUD shows one fewer life in the same frame.

- [ ] **M-5 (Q-7) No flash on the last life**
  1. Play until you have 1 life left, then let a word reach the bottom.
  - **Expected:** the game goes straight to the Game Over screen and no red border is visible on it.

- [ ] **M-6 (AC-9.4, F-1) Level banner**
  1. Start a game and keep playing (or survive) for 30 s.
  - **Expected:** at 30 s the HUD changes to "Level: 2", and "Level 2" appears in the centre of the playfield for about 1 s (0.9-1.1 s). The game does not pause.
  2. Note whether the banner hides a word that is near the middle of the playfield. Record this for F-1.

- [ ] **M-7 (AC-9.1, AC-9.2, AC-9.3, AC-9.5) HUD**
  1. During play, check the top strip.
  - **Expected:** "Score: N", "Lives: N" and "Level: N" are always visible in a strip above the word area. They update in the same frame as a destroy, a miss or a level-up.
  2. Watch a word from spawn to miss.
  - **Expected:** the HUD never covers any word text.
  3. Switch to another tab and come back.
  - **Expected:** while paused, the HUD is still visible with the same values as when the pause began.

- [ ] **M-8 (AC-10.1, AC-10.4, AC-10.8) Real auto-pause and resume**
  1. Start a game with words on screen. Type 1 or 2 letters of a word.
  2. Switch to another browser tab (Ctrl+Tab), wait 10 s or more, and switch back.
  - **Expected:** the game is paused. The overlay "Paused - press Enter to resume" is shown over the words, which stay frozen at their positions. No life was lost.
  3. Click the page and type letters, Backspace and Escape.
  - **Expected:** the game is still paused and nothing changes.
  4. Press Enter.
  - **Expected:** the game resumes immediately with no delay, and words continue from the same positions (no jump). The next correct letter continues the partly typed word.
  5. Repeat steps 2 to 4, but Alt+Tab to another application instead of switching tabs (window blur).
  - **Expected:** the results are the same as in steps 2 to 4.

- [ ] **M-9 (R-5, F-2) Address bar, devtools and Tab cause a pause**
  1. During play, click the browser address bar.
  - **Expected:** the game pauses (this is intended), and only Enter resumes it.
  2. Open devtools (F12) and click inside them.
  - **Expected:** the game pauses.
  3. Click back on the page and press Tab several times.
  - **Expected:** if focus moves to the browser UI, the game pauses. Otherwise play continues normally.

- [ ] **M-10 (Q-5) Ctrl/Alt/Meta + letter is ignored, Shift + letter counts**
  1. During play, with a word starting with "a" on screen, press Shift+A.
  - **Expected:** the word becomes the target, with "a" typed.
  2. Press Escape, then Ctrl+A (or Cmd+A on Mac).
  - **Expected:** the game state does not change. No target is set and the typo count does not go up. The browser's own shortcut behaviour is allowed.
  3. Press Alt+a (Option+a on Mac).
  - **Expected:** the game state does not change.

- [ ] **M-11 (Q-3, AC-9.3) Top word fully visible**
  1. Start a game and watch the first word appear at the very top.
  - **Expected:** the whole word, including tall letters such as "b", "d", "k" and "l", is visible below the HUD strip from the moment it spawns. Nothing is clipped.
  2. Watch a word reach the bottom.
  - **Expected:** it is fully visible, including descenders such as "g", "p" and "y", until it is missed.

- [ ] **M-12 (AC-2.2, R-3) Long words fit the real font**
  1. Open devtools and check the Console at page load.
  - **Expected:** there is no "monospace advance ... exceeds CHAR_WIDTH_PX" warning.
  2. Play to level 9 or 10, where 8-letter words appear, and watch words that spawn at the far right.
  - **Expected:** every word is fully inside the playfield, at least about 10 px from the left and right edges.

- [ ] **M-13 (NFR-6) Focus on load without a click**
  1. Load the page and do not click anything.
  2. Press Enter, then type letters and Backspace.
  - **Expected:** the game starts and responds to keys without a click. Backspace does not navigate back, and Space does not scroll.

- [ ] **M-14 (NFR-1, NFR-4) Browsers and keyboard-only play**
  1. In each of the latest Chrome, Firefox, Edge and Safari on desktop, run the full flow with only the keyboard: start, play, pause (switch tab), resume with Enter, game over, restart.
  - **Expected:** the flow completes in every browser without using the mouse. The devtools Network tab shows no requests after the first page load.

- [ ] **M-15 (NFR-2) Performance**
  1. On a mid-range laptop (4-core CPU, integrated GPU), play into level 10 with about 10 words on screen.
  2. Record 60 s with the devtools Performance panel.
  - **Expected:** average frame time is 16.7 ms or less, and no frame takes more than 50 ms.

- [ ] **M-16 (NFR-8) Readability**
  1. Set the browser zoom to 100% and the window to about 800 x 680 (the canvas's logical size).
  - **Expected:** word text is at least 20 px tall. Words (#e8e8e8), the target (#ffd54a) and typed letters (#4cd964) have a contrast ratio of at least 4.5:1 against the #101418 background (check with a contrast checker).

### Open issues and risks

| ID | Issue | Status after Round 1 |
|---|---|---|
| OI-1 | **Q-7 depends on the renderer.** `update()` sets `flashMs = 300` on every miss, including the last life, so the GAME_OVER state still has `flashMs = 300`. No unit test enforces "no flash on the last life". | **Resolved in the renderer only.** The GAME_OVER branch of `renderer.js` never draws the flash. The logic still holds `flashMs = 300`, which has no visible effect because `startGame()` resets it. It still needs manual check M-5. If the team wants a unit test for it, `update()` step 6 should set `flashMs = 0`, which is a DESIGN change. |
| OI-2 | **The DESIGN.md test command is wrong for Node 24.** `node --test tests/` fails on Node v24.13.1 with "Cannot find module ...\tests" (R-1). | **Resolved in `package.json`**, whose `test` script uses `node --test "tests/**/*.test.js"`, so `npm test` works. **Not resolved in `docs/DESIGN.md`**: it still lists `node --test tests/` as the main command on lines 27 and 344, and a `package.json` script of `node --test tests/` on line 36. The architect should update it. The QA Mode 2 instruction "Run `node --test tests/`" has the same problem; this round used `npm test`. |
| OI-3 | **How to read AC-2.1.** "A level change takes effect at the next scheduled spawn" is tested using DESIGN's reading: a gap that is already counting down keeps the old interval, and the new interval is applied when the timer is next rescheduled. | **Implemented that way** (`update()` step 7 reads `spawnIntervalMs(s.level)` when rescheduling), and the tests pass. Still needs PO confirmation that this is the intended reading. If not, both the tests and the implementation would change. |
| OI-4 | **Some tests check DESIGN-only details.** Some tests assert things the PRD doesn't require: the exact `createInitialState()` object shape, `CONFIG` and `WORDS` being frozen, `gameOverMs` reset to 0, the `trySpawn` rng order, and `skipNextDt`. | **No conflict now** (all pass). This is a maintenance risk: a refactor that changes the state shape would break these tests even if PRD behaviour stays correct. If that happens, the tests should be updated to follow the DESIGN, not treated as product bugs. |
| OI-5 | **The level banner can cover words (F-1).** | New in Round 1. Needs a PO/design decision after M-6. |
