# Typing Defense - Code Review

---

## Round 1

- **Date:** 2026-10-06
- **Commit reviewed:** `440dfed` (HEAD) plus uncommitted changes. The uncommitted changes are only docs: `docs/DESIGN.md` (Revision 2), `docs/TEST_REPORT.md` (new) and `experiment-log.md`. `src/`, `tests/` and `package.json` match HEAD.
- **Reviewed against:** `docs/PRD.md` Revision 2, `docs/DESIGN.md` Revision 2 (all 8 architect defaults Q-1 to Q-8 accepted by the user, AC-2.1 reading confirmed), `docs/TEST_REPORT.md` Round 1.
- **Test result:** `npm test` (`node --test "tests/**/*.test.js"`, Node v24.13.1) gives 238 tests, 238 passed, 0 failed, 0 skipped. I did not use `node --test tests/` because it fails on Node 24 (DESIGN R-1).

### Verdict: CHANGES REQUIRED

There are no blockers. The pure logic is correct for almost every PRD rule and is well tested. Three major issues still need fixing first. Each is a small change:
1. The code does not yet set `flashMs = 0` on game over, which DESIGN rev 2 requires (known gap).
2. Accuracy rounding does not round half up for some ties.
3. The level banner is drawn over word text.

After these are fixed and their tests are added, this can be approved without another full review.

---

### Findings

#### R-01 - Major - GAME_OVER still carries `flashMs = 300` (known gap against DESIGN rev 2)
- **Where:** `src/game-logic.js:254-261` (`update` step 6)
- **Relates to:** DESIGN 6.1 step 6, 4.2 (`flashMs` "always 0 in GAME_OVER"), 4.3 transition table, Q-7, AC-5.5. TEST_REPORT F-3 / OI-1.
- **What's wrong:** The code was written against DESIGN rev 1. Rev 2 requires step 6 to set `flashMs = 0` when the state becomes GAME_OVER. The code still leaves the `flashMs = 300` that step 5 sets for the final miss. I confirmed it: `lives: 1`, one word at `y: 599.9`, `update(s, 0.05, ...)` gives `status === 'GAME_OVER'` and `flashMs === 300`. This is the expected, already known gap, not a new finding. Players don't see it today because `renderer.js:155-158` skips the flash in GAME_OVER. But the logic contract in DESIGN does not hold, and no test covers it.
- **Fix:** In step 6 add `s.flashMs = 0;` next to `s.gameOverMs = 0;`. In `tests/update.test.js`, add the test that DESIGN 9 describes: `lives: 1`, one word at `y: 599.9`, `update(state, 0.05, ...)`, then assert `status === 'GAME_OVER'` and `flashMs === 0`. Keep the existing non-final-miss test (`flashMs === 300`).

#### R-02 - Major - `accuracyPercent` does not round half up on ties that are not exact in binary
- **Where:** `src/game-logic.js:106`
- **Relates to:** AC-6.3, DESIGN 5.2, Q-4 (round half up, accepted by the user).
- **What's wrong:** `Math.round((correct / total) * 100)` divides first, so floating-point error drops some exact .5 results just below .5. Examples:
  - 23 correct / 17 typos (57.5%) shows **57%** instead of 58%.
  - 29/200 (14.5%) shows 14%, and 57/200 (28.5%) shows 28%.

  A sweep over totals up to 2000 found 80 such tie cases. The existing Q-4 test only uses 1/8 and 3/8, which are exact in binary, so it passes. The results screen therefore shows an accuracy that does not match the agreed rule. QA checking by hand will see it, and it goes against PRD goal G-2 (every rule deterministic and checkable).
- **Fix:** Multiply before dividing, so the tie is exact: `return Math.round((correct * 100) / total);`. `correct * 100` is an integer, and an exact .5 quotient (total divides 200·correct) is exactly representable. Add test cases `accuracyPercent(23, 17) === 58` and `accuracyPercent(29, 171) === 15`.

#### R-03 - Major - The level-up banner covers word text
- **Where:** `src/renderer.js:142-147` (draw order in PLAYING), `src/renderer.js:95-99` (`drawBanner`). The same order applies in PAUSED at `:148-154`.
- **Relates to:** AC-9.3 ("Words are always fully visible from y = 0 to y = 600"), AC-9.4. TEST_REPORT F-1 / OI-5.
- **What's wrong:** `drawBanner` runs after `drawWords`. It paints opaque 48 px bold "Level N" text at playfield y ≈ 300. Any word in the band from about y = 265 to y = 310 is partly hidden for the full 1000 ms. At level 2 (50 px/s) a word moves only about 50 px in that time, so it can stay hidden for most of the banner. The banner also uses the same yellow (`#ffd54a`) as the target word, so a target behind it is hard to read. AC-9.4 asks for the banner but doesn't allow it to hide words, and AC-9.3 says words are *always* fully visible. Both ACs can be met at once, so this doesn't need a PO decision.
- **Fix:** Draw the banner first, then the words on top, so word text is never covered: in both the PLAYING and PAUSED branches, call `drawBanner(state)` before `drawWords(state)`. Also give the banner a color that can't be confused with the target, for example `COLORS.dim` or `rgba(255,213,74,0.35)`, so a word drawn over it stays readable. Re-check with manual item M-6.

#### R-04 - Minor - The canvas backing store doesn't follow the displayed size: blurry when scaled up, and text can drop below 20 px when scaled down
- **Where:** `src/renderer.js:30-38` (`ensureSize`), `src/style.css:33-35`
- **Relates to:** DESIGN 6.3 (backing store scaled by DPR, CSS scales to fit), NFR-8 (word text >= 20 px at 100% zoom).
- **What's wrong:**
  - The backing store is always `800·dpr x 680·dpr`, while the CSS stretches the element to fill the window. On a 1920x1080 window at DPR 1 the canvas shows at about 1270x1080 CSS px, so the browser upscales the bitmap by about 1.6x and the text looks soft.
  - In the other direction, any viewport shorter than about 567 px (680 x 20/24) shrinks the 24 px word font below 20 px. A small laptop window with browser chrome can be that short.
  - `ensureSize` reacts only to DPR changes, not to window resizes.

  This follows the letter of DESIGN 6.3, so it's minor.
- **Fix:**
  - Size the backing store from the displayed size: `const w = canvas.clientWidth * dpr; canvas.width = Math.round(w); canvas.height = Math.round(w * 680 / 800);` and `ctx.setTransform(w / 800, 0, 0, w / 800, 0, 0)`. Re-check this when `clientWidth` or DPR changes.
  - To guarantee NFR-8, either set a CSS `min-height` / `min-width` so the canvas never scales below 20/24, or accept the risk and note it under manual check M-16.

#### R-05 - Nit - `normalizeKey` can return a two-character "letter"
- **Where:** `src/game-logic.js:178-181`
- **Relates to:** AC-3.1, DESIGN 5.4 (returns `'a'..'z'` or `null`).
- **What's wrong:** The function checks `key.length === 1` before lowercasing and then only does a range compare. `'İ'` (U+0130) lowercases to `'i̇'` (2 code units), which passes `>= 'a' && <= 'z'`, so `normalizeKey('İ')` returns `'i̇'`. In PLAYING this counts as a typo and `main.js` calls `preventDefault` on it. It can't happen on the US/QWERTY layouts the PRD assumes, but it breaks the documented return contract.
- **Fix:** Check the result, not the input: `return /^[a-z]$/.test(lower) ? lower : null;`. Optionally add `normalizeKey('İ') === null` and `normalizeKey('é') === null` to `input.test.js`.

---

### Design conformance

- **Purity (DESIGN 3):** `game-logic.js` imports nothing and uses no `document`, `window`, `performance`, `Date`, timers or `Math.random`. Time comes in only as `dtSec` and randomness only as `rng`. No function mutates its input:
  - `update` copies the state once, rebuilds `words` with `map`/`filter`, and only changes its local copy `s`.
  - `trySpawn`, `handleKey`, `destroyTarget` and `handleFocusLoss` all return spreads.
  - Unchanged cases return the same object, which DESIGN allows.

  Tests with a `structuredClone` snapshot cover `update` (including the miss-target path and a level-up), `handleKey` (every branch type), `trySpawn` and `handleFocusLoss`.
- **Update order (6.1):** dt with `skipNextDt`, then timers, then elapsed/level/banner, then movement at the new level, then misses (lives clamped, target cleared, flash), then game over with no spawn, then the spawn timer. This matches rev 1 exactly. The only rev 2 gap is R-01.
- **AC-2.1 (confirmed reading):** this matches. `spawnTimerMs` is never recomputed on level-up, and `spawnIntervalMs(s.level)` is read only at reschedule time (`:267`, `+=`). I confirmed it against the DESIGN 6.2 worked example: a spawn at 28.0 s is followed by spawns at 30.000 s and then 31.850 s.
- **trySpawn rng order (5.3):** this matches. It does the cap check with no rng call, then 1 length roll, then up to 10 picks from a shared budget for duplicates and the target's first letter (Q-1, Q-2), then 1 x roll only on success. It doesn't touch `spawnTimerMs`.
- **Target locking, Backspace, Escape, destroy (AC-3.x, AC-4.x):** these are correct. Points use `state.level` at the time of the destroy (AC-7.2). A destroy happens in the same `handleKey` call, so it can never also count as a miss.
- **Pause:** `update` returns PAUSED unchanged, so position, time, level, spawn timer, flash and banner are frozen. Enter resumes with `skipNextDt = true` and keeps the target and typed prefix. `main.js` also sets `lastTimestamp = null` on any transition into PLAYING, so the first frame after a resume moves nothing by two separate mechanisms. When the tab is hidden, rAF stops. The first frame after it becomes visible gets a large dt, but the state is PAUSED so nothing changes, and the next Enter resets the timestamp.
- **Game-over Enter guard (AC-6.5, Q-6):** `gameOverMs` builds up from capped frame time, and `handleKey` accepts Enter only when it is `>= 500`.
- **dt cap (AC-2.8):** `clampDt` is in the logic. NaN and negative values become 0, and it is applied to the spawn timer and the guard too.
- **main.js glue (DESIGN 3, 6.2):**
  - The `keydown` listener is on `window`.
  - Ctrl, Meta and Alt combos and `isComposing` are skipped before `preventDefault` (Q-5).
  - `preventDefault` is called for letters, Enter, Backspace, Escape and Space.
  - `event.repeat` is not filtered (AC-3.11).
  - There is a `blur` listener on `window` (`blur` doesn't bubble, so a canvas blur won't trigger it) and a `visibilitychange` listener for the hidden state. There is no focus-gain listener (AC-10.8).
  - `canvas.focus()` is called at load, and the canvas has `tabindex="0"`.
- **Names and signatures:** these match DESIGN 4.1 `CONFIG`, 4.2 state shape and Section 5 exports (`createRenderer(canvas) -> { render }`). I found no dead code worth flagging. The defensive branches (empty word list in `trySpawn`, unknown status in `update`) are harmless.

### What's good

- The logic module is small, readable, and closely follows DESIGN. Each step in `update` is labelled with the DESIGN step number.
- The tests are designed carefully. `DT = 0.0625` keeps float sums exact, so the cadence asserts are reliable. `seqRng` throws on any unexpected rng call, which locks the rng order. AC-10.10 runs a no-pause vs pause comparison. NFR-3 is checked at 30 and 144 fps.
- `main.js` is minimal and does exactly what DESIGN describes. Real time and `Math.random` enter only there.
- The renderer reads state only. It warns at boot if the font is wider than `CHAR_WIDTH_PX` (R-3). The 28 px top pad and 12 px bottom pad keep words at both ends of the field fully visible (Q-3).

### Test-suite notes

- **Missing:** a test that GAME_OVER has `flashMs === 0` after the final miss (needed for R-01, and listed in DESIGN 9).
- **Weak:** the Q-4 rounding test uses only ties that are exact in binary. Add 23/40 and 29/200 (R-02).
- **Brittle (already TEST_REPORT OI-4):** the exact state-shape, frozen `CONFIG`, `skipNextDt` and rng-order assertions test DESIGN details, not PRD behaviour. That is acceptable while DESIGN is the contract. If a refactor breaks them, update the tests rather than treating it as a product bug.
- **Not unit-testable by design:** `renderer.js` and `main.js` (R-03, R-04 and the listener wiring). They are covered by the manual checklist below.

### Needs a manual browser check

None of the TEST_REPORT manual items M-1 to M-16 has been run yet. All of them are still needed. These are the ones that matter most for this review:

- **M-6 (R-03):** after the draw-order fix, check that a word passing the centre during "Level 2" stays fully readable.
- **M-5 (R-01):** check that no red border shows on the Game Over screen (and add the unit test once the logic fix is in).
- **M-8:** a real tab switch and an Alt+Tab both pause the game, words don't jump on Enter, the typed prefix is kept, and regaining focus doesn't resume.
- **M-13 (NFR-6):** keys work on load without a click, Backspace doesn't navigate back, and Space doesn't scroll. Check in all four browsers, because `canvas.focus()` at load may not move document focus away from the address bar in every browser.
- **M-12 / M-16 (R-04, NFR-8):**
  - 8-letter words at the right edge stay inside the 10 px margin.
  - Word glyphs are at least 20 px tall at 100% zoom in a small window.
  - Text sharpness on a large or high-DPI display.
- **M-2:** results screen. If a game ends with 23 correct and 17 typos, it should show 58% after the R-02 fix.
- **M-14 / M-15:** run the full flow in all four browsers, and check performance at level 10 with 10 words.
