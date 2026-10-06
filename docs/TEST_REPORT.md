# Typing Defense - Test Report

Rounds are listed newest first. Earlier rounds are kept unchanged as history.

---

## Round 2

- **Date:** 2026-10-06
- **Node version:** v24.13.1
- **Command run:** `npm test` (from the repo root). `package.json` maps it to `node --test "tests/**/*.test.js"`. I got the per-file counts by running `node --test <file>` on each file separately.
- **What changed since Round 1:** the developer fixed REVIEW.md findings R-01 to R-04. The user chose to skip R-05. QA added 7 tests for R-01, R-02 and AC-2.1.

### Summary

| Test file | Tests | Pass | Fail | Skipped | Todo | Change from Round 1 |
|---|---|---|---|---|---|---|
| `tests/difficulty.test.js` | 65 | 65 | 0 | 0 | 0 | +4 (R-02) |
| `tests/input.test.js` | 45 | 45 | 0 | 0 | 0 | 0 |
| `tests/spawn.test.js` | 34 | 34 | 0 | 0 | 0 | 0 |
| `tests/update.test.js` | 45 | 45 | 0 | 0 | 0 | +3 (R-01 x2, AC-2.1 x1) |
| `tests/pause.test.js` | 22 | 22 | 0 | 0 | 0 | 0 |
| `tests/state.test.js` | 21 | 21 | 0 | 0 | 0 | 0 |
| `tests/words.test.js` | 13 | 13 | 0 | 0 | 0 | 0 |
| **Total** | **245** | **245** | **0** | **0** | **0** | **+7 (238 -> 245)** |

Raw totals from `npm test`: `tests 245, suites 0, pass 245, fail 0, cancelled 0, skipped 0, todo 0` (about 650 ms).

**New tests since Round 1.** I wrote these from REVIEW.md and DESIGN Revision 2, not from `src/`:

| File | Test | For | Result on Round 1 code | Round 2 |
|---|---|---|---|---|
| `difficulty.test.js` | `Q-4 / AC-6.3: decimal .5 ties round half up even when not exact in binary (23 correct, 17 typos = 57.5% -> 58)` | R-02 | Fail (57 vs 58) | Pass |
| `difficulty.test.js` | `Q-4 / AC-6.3: 29 correct out of 200 total (14.5%) rounds half up to 15` | R-02 | Fail (14 vs 15) | Pass |
| `difficulty.test.js` | `Q-4 / AC-6.3: more decimal ties round half up (57/200 = 28.5% -> 29, 113/200 = 56.5% -> 57, 46/80 = 57.5% -> 58)` | R-02 | Fail (28 vs 29) | Pass |
| `difficulty.test.js` | `Q-4 / AC-6.3: every exact .5 tie with up to 400 keystrokes rounds half up` | R-02 | Fail (16 wrong ties) | Pass |
| `update.test.js` | `AC-5.5 / Q-7: losing the final life gives a GAME_OVER state with flashMs === 0` | R-01 | Fail (300 vs 0) | Pass |
| `update.test.js` | `AC-5.5 / Q-7: final life lost while an earlier flash is still running also clears it` | R-01 | Fail (300 vs 0) | Pass |
| `update.test.js` | `AC-2.1: DESIGN 6.2 example - spawns at 28.0 s, 30.0 s (on the level-up frame), then the gap is 1850 ms` | AC-2.1 (confirmed reading) | Pass | Pass |

All 238 Round 1 tests still pass. No test was weakened or removed.

### Failures

None.

### Fix verification

| Fix | Where | What I checked in `src/` | Automated coverage | Result |
|---|---|---|---|---|
| R-01: clear the flash at game over | `src/game-logic.js:259` | In `update` step 6, `s.flashMs = 0;` is set next to `s.gameOverMs = 0;`, before the early return. A non-final miss still sets `flashMs = CONFIG.FLASH_MS` in step 5. | Both new `AC-5.5 / Q-7` tests, plus the existing `AC-5.5: a lost life starts the 300 ms flash timer; the game keeps running` (non-final miss gives 300) | **Verified** |
| R-02: accuracy rounds half up | `src/game-logic.js:107` | It is now `Math.round((correct * 100) / total)`, and the 0/0 case still returns 0 (line 105). | The 4 new `Q-4` tests (including every exact tie up to 400 keystrokes) and the existing Q-4, AC-6.3 tests | **Verified** |
| R-03: banner drawn behind words | `src/renderer.js:157-158` (PLAYING) and `:163-164` (PAUSED) | `drawBanner` is now called before `drawWords` in both branches. The banner uses `COLORS.banner = '#6b7785'` (`:20`, `:109`). The GAME_OVER branch still draws no banner or flash. | None. This is render-only. | **Implemented as described.** It needs manual check M-6. See new finding N-3. |
| R-04: canvas sharp at any size | `src/renderer.js:37-49` (`ensureSize`), `src/style.css` `#game` | The backing store is sized from `clientWidth`/`clientHeight` x `devicePixelRatio`. It is checked every frame and only reallocated when the size or DPR changes. Drawing stays in the logical 800 x 680 space via `setTransform(canvas.width/800, 0, 0, canvas.height/680, 0, 0)`. CSS is `width: max(667px, min(100vw, calc(100vh * 800 / 680)))` with `aspect-ratio: 800 / 680`, `margin: auto` and `overflow: hidden`. The 667 px floor means words are drawn at 24 x 667/800 = 20.0 CSS px. | None. This is render-only. | **Implemented as described.** It needs manual checks M-12, M-16 and M-17. See new findings N-1, N-2 and N-4. |

### Round 1 findings and open issues: status

| ID | Round 1 issue | Round 2 status | Reason |
|---|---|---|---|
| F-1 | The level banner covers word text | **Resolved (pending manual M-6)** | R-03 draws the banner before the words, so word glyphs are always painted on top. Where a word crosses a banner stroke, contrast is lower (see N-3). |
| F-2 | Tab is not prevented, so focus can move to the browser UI and pause the game | **Still open (info, by design)** | `main.js` is unchanged. This is expected behaviour under AC-10.1 and is covered by M-9. |
| F-3 | The logic left `flashMs = 300` in GAME_OVER | **Resolved** | R-01 (`game-logic.js:259`), covered by 2 unit tests. |
| OI-1 | Q-7 depended on the renderer | **Resolved** | It is now enforced in the logic and unit-tested. The renderer still skips the flash in GAME_OVER as a second safeguard. M-5 stays as a visual check. |
| OI-2 | The DESIGN.md test command was wrong for Node 24 | **Resolved** | DESIGN Revision 2 (Changelog, Section 1, Section 2 and Section 9) now uses `node --test "tests/**/*.test.js"`, which matches `package.json`. |
| OI-3 | How to read AC-2.1 | **Resolved** | The user confirmed DESIGN's reading (DESIGN Revision 2, 6.1 step 7, the 6.2 worked example, Section 11). It is covered by the existing test and the new `AC-2.1: DESIGN 6.2 example ...` test. |
| OI-4 | Some tests check DESIGN-only details (brittle) | **Still open (accepted risk)** | Nothing has changed. These tests are fine while DESIGN is the contract. |
| OI-5 | The banner covers words | **Resolved (pending manual M-6)** | Same as F-1. |
| OI-6 (new) | **DESIGN.md Section 5.2 (line 207) still gives the accuracy formula as `Math.round(correct / (correct + typos) * 100)`.** Written that way it gives 57 for 23/17, which contradicts Q-4, the code (`game-logic.js:107`) and the tests. | **Open, for the architect** | Section 5.2 should say `Math.round(correct * 100 / (correct + typos))`, or state the rule as "round half up, computed exactly". The Q-4 entry in Section 11 also still says "(`Math.round`)" without the multiply-first note. |
| OI-7 (new) | **REVIEW R-05:** `normalizeKey('İ')` returns a two-character string, which breaks DESIGN 5.4's "a-z or null" contract | **Open, accepted (skipped by the user)** | This can't happen on the US/QWERTY layout the PRD assumes. No test was added, because adding one would make the suite fail on a fix the user chose to skip. |

### New findings (Round 2)

| ID | Where | Finding | Severity |
|---|---|---|---|
| N-1 | `src/style.css` `#game` width `max(667px, ...)` | **Small windows hide the most urgent words.** Below 667 x 567 CSS px the canvas keeps its minimum size and is clipped at the right and bottom edges. The bottom matters most. The miss line (canvas y = 668 logical) is drawn at about 557 CSS px. For example, in a 500 px tall viewport, everything below about playfield y = 532 is cut off, so a word is invisible for its last ~68 px of fall: ~1.7 s at level 1 and ~0.5 s at level 10. That goes against AC-9.3 ("Words are always fully visible from y = 0 to y = 600"). The right edge is less serious: words reach logical x = 790, which is about 659 CSS px, so they are only clipped in windows narrower than about 659 px. In those windows the right-aligned "Level: N" in the HUD is clipped too. This is a deliberate trade-off between NFR-8 (20 px text) and AC-9.3, made in the developer's fix, but neither the PRD nor the DESIGN records it. **Suggest** the PO or architect decide, and record the decision in DESIGN 6.3. One option is to show a "window too small" notice instead of clipping. | Medium |
| N-2 | `docs/DESIGN.md` 6.3 | DESIGN 6.3 still describes only "backing store scaled by DPR; CSS scales to fit". It doesn't mention sizing from the displayed size, the 667 x 567 minimum, or clipping instead of scrolling. This is a doc gap for the architect. | Low |
| N-3 | `src/renderer.js:20` banner colour | Words are now drawn on top of the banner. Where a word overlaps a banner stroke (the bold 48 px glyphs), local contrast falls below NFR-8's 4.5:1: plain word `#e8e8e8` on `#6b7785` is 3.72:1, target yellow `#ffd54a` 3.23:1, and typed green `#4cd964` 2.48:1. It lasts at most 1 s per level-up and affects only the pixels under the strokes, so it is much better than Round 1. The banner itself on the background is 4.05:1 (it's decorative, so NFR-8 doesn't strictly apply). Check readability during M-6. A darker banner colour (for example `#3a4450`) would keep word contrast above 4.5:1. | Low |
| N-4 | `src/renderer.js:37-49` | **The per-frame size check is cheap but reads layout.** `clientWidth` and `clientHeight` are read every frame. Since nothing else in the frame writes to the DOM layout, this shouldn't force a layout recalculation, and the backing store is only reallocated when something changes. I expect no impact on NFR-2; confirm in M-15. Two minor points: (a) the x and y scales are computed separately from rounded integer sizes, so the aspect ratio can be distorted by up to about 0.2%, which isn't visible; (b) reallocating the canvas resets the context state, which is harmless because every draw call sets its own font, fill and alignment. | Info |
| N-5 | `src/style.css` | **Browser support.** CSS `min()`/`max()` need Chrome 79+, Firefox 75+ and Safari 11.1+. `aspect-ratio` needs Chrome 88+, Firefox 89+ and Safari 15+. All current stable versions qualify (NFR-1 only requires the latest). On older Safari without `aspect-ratio`, `height: auto` would fall back to the canvas's backing-store ratio (initially 300 x 150), and the per-frame resize would then keep that wrong ratio, stretching the drawing. This is out of scope for NFR-1. Check it in M-14 with the actual latest Safari. | Info |

### AC coverage (changes from Round 1)

Same as Round 1, with these changes:
- **Q-7 / AC-5.5 (final life):** now automated (`update.test.js`). M-5 stays as a visual check.
- **Q-4 / AC-6.3:** decimal .5 ties are now automated (`difficulty.test.js`).
- **AC-2.1:** the confirmed reading is now also covered at the exact 30.0 s boundary (`update.test.js`).
- **AC-9.3, AC-9.4 (banner vs words), NFR-8 and the R-04 sizing:** these stay manual-only (M-6, M-7, M-12, M-16, M-17).

### Manual Test Checklist (Round 2)

**Launch:** from the repo root run `python -m http.server 8000`, then open http://localhost:8000/src/index.html. Do not open the file with a double-click, because ES modules do not load from `file://`. Keep the browser devtools closed unless a step asks for them, because clicking into devtools pauses the game (R-5). Nobody has run these checks yet.

- [ ] **M-1 (AC-1.1) Start screen text**
  1. Load the page.
  2. Do not press any key.
  - **Expected:** the title "Typing Defense", the text "Press Enter to start" and the line "Type the falling words before they reach the bottom" are shown. No words and no HUD are on screen. Pressing letters, Space or Escape does nothing. Pressing Enter starts the game.

- [ ] **M-2 (AC-6.2, AC-6.3, AC-6.1, Q-4 / R-02) Results screen**
  1. Start a game. Destroy 2 or 3 words and make a few typos on purpose.
  2. Let 3 words reach the bottom.
  - **Expected:** the screen shows "Game Over", "Score: N", "Level reached: N", "Words destroyed: N", "Accuracy: N%" (an integer followed by "%") and "Press Enter to play again". No falling words are drawn.
  3. Press Enter immediately, then again after about 1 s.
  - **Expected:** an Enter pressed in the first 0.5 s is ignored. A later Enter starts a new game with Score 0, Lives 3 and Level 1.
  4. Start a game, press no letters, and let it end.
  - **Expected:** "Accuracy: 0%".
  5. Rounding check (R-02): play a game with exactly 23 correct keystrokes and 17 typos. For example, type 23 correct letters (word selections count) and press a letter that matches no word 17 times. Then let the game end.
  - **Expected:** "Accuracy: 58%", not 57%.

- [ ] **M-3 (AC-3.9) Target and prefix colours**
  1. Start a game and wait until 2 or more words are on screen.
  2. Type the first 2 letters of one word.
  - **Expected:** the target word is yellow with an underline. The typed letters are green and the untyped letters are yellow. Other words are plain light grey and show no typed progress.
  3. Press Escape.
  - **Expected:** the word goes back to plain style.

- [ ] **M-4 (AC-5.5) Life-lost flash**
  1. Start a game and let one word reach the bottom while you still have 2 or more lives.
  - **Expected:** a red border appears around the playfield for about 300 ms (250-350 ms; use a screen recording). The game keeps running, and the HUD shows one fewer life in the same frame.

- [ ] **M-5 (Q-7 / R-01) No flash on the last life**
  1. Play until you have 1 life left, then let a word reach the bottom.
  - **Expected:** the game goes straight to the Game Over screen. No red border is visible on it at any point, including the first frame.
  2. Press Enter after 0.5 s.
  - **Expected:** the new game starts with no red border.

- [ ] **M-6 (AC-9.4, AC-9.3, R-03, N-3) Level banner behind the words**
  1. Start a game and survive to 30 s.
  - **Expected:** at 30 s the HUD shows "Level: 2", and "Level 2" appears in muted slate grey (not yellow) in the centre of the playfield for about 1 s (0.9-1.1 s). The game does not pause.
  2. Arrange for a word to pass through the middle of the playfield (y around 265-310) while the banner is showing. If possible, make it the target with 1 or 2 letters typed.
  - **Expected:** the word is drawn on top of the banner. Every letter of the word, including the green typed part and the yellow untyped part, stays readable, and the banner never hides any part of a word.
  3. Switch tabs while the banner is showing, then come back.
  - **Expected:** while paused, the banner stays behind the words and under the pause overlay. After Enter, it finishes its remaining time.

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
  - **Expected:** the game is paused. The overlay "Paused - press Enter to resume" is shown over the words, which stay frozen. No life was lost.
  3. Click the page and type letters, Backspace and Escape.
  - **Expected:** the game is still paused and nothing changes.
  4. Press Enter.
  - **Expected:** the game resumes immediately with no delay, and words continue from the same positions (no jump). The next correct letter continues the partly typed word.
  5. Repeat steps 2 to 4, but Alt+Tab to another application instead (window blur).
  - **Expected:** the results are the same as in steps 2 to 4.

- [ ] **M-9 (R-5, F-2) Address bar, devtools and Tab cause a pause**
  1. During play, click the browser address bar.
  - **Expected:** the game pauses, and only Enter resumes it.
  2. Open devtools (F12) and click inside them.
  - **Expected:** the game pauses.
  3. Click back on the page and press Tab several times.
  - **Expected:** if focus moves to the browser UI, the game pauses. Otherwise play continues normally.

- [ ] **M-10 (Q-5) Ctrl/Alt/Meta + letter is ignored, Shift + letter counts**
  1. With a word starting with "a" on screen, press Shift+A.
  - **Expected:** the word becomes the target, with "a" typed.
  2. Press Escape, then Ctrl+A (Cmd+A on Mac).
  - **Expected:** the game state does not change. No target is set and the typo count does not go up.
  3. Press Alt+a (Option+a on Mac).
  - **Expected:** the game state does not change.

- [ ] **M-11 (Q-3, AC-9.3) Top word fully visible**
  1. Start a game and watch the first word appear.
  - **Expected:** the whole word, including tall letters such as "b", "d", "k" and "l", is visible below the HUD strip from the moment it spawns.
  2. Watch a word reach the bottom (in a window at least 667 x 567 CSS px).
  - **Expected:** it is fully visible, including descenders such as "g", "p" and "y", until it is missed.

- [ ] **M-12 (AC-2.2, R-3, R-04) Long words fit the real font, in a normal-size window**
  1. Use a window larger than 667 x 567 CSS px. Open devtools and check the Console at page load.
  - **Expected:** there is no "monospace advance ... exceeds CHAR_WIDTH_PX" warning.
  2. Play to level 9 or 10, where 8-letter words appear, and watch words that spawn at the far right.
  - **Expected:** every word is fully inside the playfield, at least about 10 px (scaled) from the left and right edges, and nothing is clipped by the window edge.

- [ ] **M-13 (NFR-6) Focus on load without a click**
  1. Load the page and do not click anything.
  2. Press Enter, then type letters and Backspace.
  - **Expected:** the game starts and responds without a click. Backspace does not navigate back, Space does not scroll, and no scrollbars appear at any window size.
  3. Repeat in all four browsers.

- [ ] **M-14 (NFR-1, NFR-4, N-5) Browsers and keyboard-only play**
  1. In each of the latest Chrome, Firefox, Edge and Safari on desktop, run the full flow with only the keyboard: start, play, pause (switch tab), resume with Enter, game over, restart.
  - **Expected:** the flow completes without using the mouse. The canvas keeps its 800:680 shape (nothing stretched or squashed). The devtools Network tab shows no requests after the first load.

- [ ] **M-15 (NFR-2, N-4) Performance**
  1. On a mid-range laptop (4-core CPU, integrated GPU), play into level 10 with about 10 words on screen.
  2. Record 60 s with the devtools Performance panel.
  - **Expected:** average frame time is 16.7 ms or less, and no frame takes more than 50 ms. There are no repeated "Recalculate style" or "Layout" entries every frame from the size check.
  3. While recording, resize the window a few times.
  - **Expected:** no frame takes more than 50 ms during the resize.

- [ ] **M-16 (NFR-8, R-04) Readability, sharpness and the 20 px minimum**
  1. At 100% browser zoom, make the window as small as possible (smaller than 667 x 567 CSS px).
  - **Expected:** the canvas stops shrinking at 667 px wide. In devtools, inspect `#game`: its rendered width is at least 667 CSS px, so 24 px words are at least 20 CSS px tall (measure a capital-height word glyph against the 24 px line box if needed).
  2. Maximise the window on a large display (for example 1920 x 1080), then set browser zoom to 150% and 200%, and if possible move the window to a high-DPI (Retina/4K) screen.
  - **Expected:** in every case, word and HUD text is sharp (no blurry upscaling), and the canvas keeps its 800:680 shape.
  3. Check contrast with a contrast checker.
  - **Expected:** words (#e8e8e8), the target (#ffd54a) and typed letters (#4cd964) are at least 4.5:1 against the #101418 background.

- [ ] **M-17 (new; AC-9.3, N-1, R-04) Small-window clipping**
  1. Set the browser viewport to about 600 x 500 CSS px (use devtools device toolbar or resize the window).
  - **Expected (current behaviour):** the canvas is anchored top-left and does not scroll. The right edge and the bottom of the playfield are cut off.
  2. Play at level 1 and watch a word fall to the bottom.
  - **Expected:** record how much of the fall is hidden. Per N-1, the word should disappear about 68 px (about 1.7 s) before it is missed, and you lose a life with no visible word. Report this to the PO; it is the N-1 trade-off, not yet accepted.
  3. In the same small window, check whether the right-aligned "Level: N" in the HUD and words spawned at the far right are cut off.
  4. Resize back to a large window.
  - **Expected:** the canvas grows back, is centred, and is sharp. No game state is lost.

### Open items for other roles

- **Architect:** fix DESIGN 5.2 (line 207) and the Q-4 note (OI-6). Document the R-04 sizing and minimum size in DESIGN 6.3 (N-2).
- **PO / architect:** decide on N-1, small-window clipping versus AC-9.3.
- **Optional (developer):** use a darker banner colour so words keep at least 4.5:1 contrast where they overlap it (N-3).
- **Human tester:** M-1 to M-17. None have been run yet.

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
