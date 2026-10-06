# Typing Defense - Code Review

Rounds are listed newest first. Earlier rounds are kept unchanged as history.

---

## Round 2

- **Date:** 2026-10-06
- **Commit reviewed:** `e874d16` (HEAD, "Review round 1") plus uncommitted changes:
  - Code: `src/game-logic.js`, `src/renderer.js`, `src/style.css`.
  - Tests: `tests/difficulty.test.js`, `tests/update.test.js`.
  - Docs and config, not reviewed as code: `docs/TEST_REPORT.md` (Round 2), `.claude/agents/*.md` (test command), `experiment-log.md`.
  - `package.json`, `src/main.js`, `src/words.js`, `src/index.html` and the other test files are unchanged.
- **Reviewed against:** `docs/PRD.md` Revision 2, `docs/DESIGN.md` Revision 2, `docs/TEST_REPORT.md` Round 2, and Round 1 of this review.
- **Test result:** `npm test` (`node --test "tests/**/*.test.js"`, Node v24.13.1) gives 245 tests, 245 passed, 0 failed, 0 skipped.

### Verdict: APPROVE WITH CHANGES (sign-off depends on the N-1 decision)

All four fixes from Round 1 are correct and covered as well as they can be. No blocker or major code defect is left in the code the developer changed. One item gates final sign-off, and it is a **user decision, not a developer defect**: N-1 / R-06.
- **What:** the small-window clipping added by the R-04 fix hides words just before they reach the miss line, which goes against AC-9.3.
- **What I recommend:** below.
- **Once the user decides:** the follow-up is either a small CSS change or a one-line PRD/DESIGN note. Neither needs another full review. The manual checks listed at the end still have to pass before release.

### Fix verification (Round 1 findings)

| ID | Status | Where | Notes |
|---|---|---|---|
| R-01 flash at game over | **Resolved** | `src/game-logic.js:259` | `s.flashMs = 0` is set in step 6 before the early return, which matches DESIGN rev 2 6.1 step 6. A non-final miss still gets 300 (`:248`). Covered by 2 new tests: `update.test.js` "AC-5.5 / Q-7 ..." (final miss, and final miss while an earlier flash is still running), plus the existing 300 ms test. |
| R-02 accuracy half up | **Resolved** | `src/game-logic.js:107` | Now `Math.round((correct * 100) / total)`. 0/0 still returns 0 (`:105`). Covered by 4 new tests in `difficulty.test.js`, including an exhaustive sweep over every exact .5 tie up to 400 keystrokes. DESIGN 5.2 still shows the old formula (TEST_REPORT OI-6, a doc fix for the architect). |
| R-03 banner over words | **Resolved** (one follow-up, R-07) | `src/renderer.js:155-158` (PLAYING), `:162-165` (PAUSED), `:20`, `:109` | `drawBanner` now runs before `drawWords` in both branches, so the banner can never hide word glyphs. The banner colour is no longer target yellow. Remaining issue: contrast where a word crosses a banner stroke (N-3, see R-07). |
| R-04 canvas sizing / NFR-8 | **Partially resolved** | `src/renderer.js:37-49`, `src/style.css:15-29` | Sharpness is fixed: the backing store follows the displayed size times DPR, and it re-checks every frame for resizes and zoom/DPR changes. The 20 px floor is guaranteed for short windows. It is **not guaranteed for narrow windows** (R-08). It also brought in the clipping trade-off (R-06 / N-1). |
| R-05 `normalizeKey('İ')` | **Deferred by user** | `src/game-logic.js:178-181` | Unchanged and accepted (TEST_REPORT OI-7). No test was added, which is correct. |

### Review of the new code

**`ensureSize` (`src/renderer.js:37-49`)**
- Calling it every frame is fine. It reads `clientWidth`, `clientHeight` and `devicePixelRatio` and compares them with the cached values, so the backing store is only reallocated when something changes.
- Reading `clientWidth` doesn't force a synchronous layout in a normal frame, because nothing writes to layout before it. The exception is the frame right after `canvas.width` changes. Writing `canvas.width` changes the canvas's natural size, and in a flex item that can affect layout (see R-08). That costs one extra layout per resize, which is acceptable.
- Reallocating the canvas resets the context state (font, fill, transform). This is harmless: `setTransform` runs every frame right after the check, and every draw helper sets its own font, fill style, alignment and baseline.
- DPR changes from zoom or a monitor move are picked up on the next frame. A fractional DPR (1.25, 1.5) is handled by `Math.round`.
- `clientWidth || CANVAS_W` falls back to 800 when the canvas isn't laid out yet (for example `display: none`). This is a reasonable default.
- **Non-uniform `setTransform` (`:48`):** the x and y scales come from two integers that are rounded separately, so the aspect ratio can be distorted by about 0.2% at most. That isn't visible. But `clientWidth`/`clientHeight` are themselves rounded from a fractional box (for example 1270.59 x 1080), so the backing store never quite matches the device pixels and there is slight resampling. See nit R-09.
- **Backing store size:** this is now unbounded. A maximized window on a 4K/5K display at DPR 2 can need a canvas of about 10 Mpx that is cleared and redrawn every frame. NFR-2 only covers a mid-range laptop, so this is not a finding, but check it during M-15 on the largest screen available.

**`src/style.css:11-29`**
- `body { display: flex }` with `#game { margin: auto }` centres the canvas. When the canvas is bigger than the viewport, the auto margins become 0, so it stays anchored top-left and is clipped at the right and bottom. That is the documented behaviour.
- With `align-items` removed, the default would be `stretch`. Auto margins on the cross axis disable stretching, though, so `height: auto` comes from `aspect-ratio`. That's correct.
- `aspect-ratio: 800 / 680` (without the `auto` keyword) overrides the canvas's natural ratio, so the per-frame backing-store resize can't feed back into the displayed shape. This only holds in browsers that support `aspect-ratio` (N-5).
- `width: max(667px, min(100vw, calc(100vh * 800 / 680)))` is right for "fit to window, but not below 667 px". The exception is flex shrinking in narrow windows (R-08).

**R-03 draw order and colour.** The order (HUD, banner, words, flash, then the overlay in PAUSED) meets AC-9.3 for glyph visibility. The GAME_OVER branch is unchanged (no banner, no flash). The only remaining issue is contrast (R-07).

**New tests.** All 7 are sound:
- **R-02 tests:** the sweep computes the expected value with integer arithmetic (`200 * correct`, odd `doubled`), so the oracle is independent of the implementation.
- **R-01 tests:** these use `noRng()` and `NO_SPAWN`, so a stray spawn would make them fail loudly. The second one covers an earlier flash still running at the final miss, which is a useful edge case.
- **AC-2.1 boundary test:** this depends on `DT = 0.0625`, which is exact in binary, so the 30.000 s boundary is reached exactly. That is deliberate and safe. DESIGN R-4 warns against exact boundary tests only for dts that aren't exact. If someone later changes `DT` in `update.test.js`, this test and the existing cadence tests would break together. A short comment next to `DT` would make that clear (optional).
- No test was weakened or removed. Total: 238 -> 245.

### Position on TEST_REPORT Round 2 findings

| QA ID | Agree? | My severity | Position |
|---|---|---|---|
| N-1 small-window clipping hides words near the miss line | **Agree** | **Major, decision pending** (tracked as R-06) | I checked the numbers. In a viewport under about 567 CSS px tall, the bottom of the playfield is cut off, and a word disappears before it is missed: you lose a life with no visible word. This isn't only an edge case. A 1920x1080 laptop at 150% scaling has a 1280x720 CSS screen, which leaves roughly 550-600 px of viewport after the taskbar and browser UI. That is right at the limit. **This is the user's decision, and it hasn't been made.** My recommendation is in R-06. |
| N-2 DESIGN 6.3 doesn't describe the sizing | Agree | Minor (doc, architect) | DESIGN 6.3 should describe the sizing rule (backing store = displayed size x DPR, logical 800 x 680 transform), the 667 x 567 minimum, and whichever N-1 option is chosen. Not a code issue. |
| N-3 banner contrast under words < 4.5:1 | Agree | Minor (tracked as R-07) | I measured the same ratios: on `#6b7785`, words 3.72:1, target 3.23:1, typed 2.48:1. QA's `#3a4450` works (typed 5.38:1), but the banner is then only 1.87:1 against the background and hard to see. I propose `#444e5a`, or a word halo (R-07). |
| N-4 per-frame size check reads layout | Agree | Info | No forced layout in normal frames; one extra layout per resize. The 0.2% aspect-ratio difference isn't visible. I add nit R-09 (rounding) and the backing-store size note above. Confirm in M-15. |
| N-5 CSS `min()`/`max()`/`aspect-ratio` support | Agree | Info | All current stable browsers support these (NFR-1 only requires the latest). Without `aspect-ratio`, the drawing would be stretched, so M-14 in the latest Safari is enough. |
| OI-4 DESIGN-detail tests | Agree | Accepted risk | Unchanged since Round 1. |
| OI-6 DESIGN 5.2 accuracy formula | Agree | Minor (doc, architect) | DESIGN 5.2 and Q-4 should say `Math.round(correct * 100 / (correct + typos))`, so the documented formula matches the code and the tests. |
| OI-7 / R-05 | - | Deferred by user | No action. |

### New findings (Round 2)

#### R-06 - Major (user decision pending) - Clipping in small windows hides words before they are missed
- **Where:** `src/style.css:24` (`max(667px, ...)`), together with `:19` (`margin: auto`) and `:7` (`overflow: hidden`).
- **Relates to:** AC-9.3 ("Words are always fully visible from y = 0 to y = 600"), AC-5.1, NFR-8. TEST_REPORT N-1. Not covered by DESIGN 6.3 (N-2).
- **What's wrong:** to keep words at least 20 px tall (NFR-8), the canvas no longer shrinks below 667 x 567 CSS px. In a smaller viewport, the bottom and right edges are clipped with no way to scroll. In a 500 px tall viewport, a level-1 word is invisible for about the last 1.7 s of its fall, and the player loses a life to a word they couldn't see. The PRD rules out neither option: NFR-8 and AC-9.3 conflict when the window is small, and the developer chose NFR-8 without recording it.
- **Recommendation (for the user to decide):** never clip the playfield. AC-9.3 protects the core game loop (losing a life to a hidden word feels like a bug). NFR-8's 20 px is a readability target, and 17-19 px text in a slightly undersized window is still playable.
  - In CSS, drop the floor: go back to `width: min(100vw, calc(100vh * 800 / 680))`.
  - Optionally, have the renderer show a small, non-blocking hint ("Enlarge the window for best readability") when `canvas.clientWidth < 667`.
  - Record in the PRD or DESIGN that NFR-8 applies when the viewport is at least 667 x 567 CSS px.
  - Alternative, if the user prefers to keep text at 20 px or more: keep the floor, but when the viewport is below it, show a "Window too small" screen and treat it as a focus loss (auto-pause), so no life can be lost unseen. This needs a `resize` listener in `main.js`, so it costs more.
  - Either way, record the decision in DESIGN 6.3 (N-2).

#### R-07 - Minor - Words that cross the banner fall below 4.5:1 contrast
- **Where:** `src/renderer.js:20` (`COLORS.banner = '#6b7785'`), `:109`.
- **Relates to:** NFR-8, AC-3.9, AC-9.4. TEST_REPORT N-3.
- **What's wrong:** words are now drawn on top of the bold 48 px banner. Where a glyph overlaps a banner stroke, the contrast is 3.72:1 for plain words, 3.23:1 for the target and 2.48:1 for typed letters. It lasts at most 1 s per level-up, so it is minor. It is still an NFR-8 miss, and it's worst for the typed prefix, which the player is looking at.
- **Fix (either option):**
  - (a) **Preferred:** give words a dark halo, so any banner colour works. In `drawWords`, before each `fillText`, call `ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = COLORS.bg; ctx.strokeText(...)` with the same text and position. The banner can then stay `#6b7785`, which is 4.05:1 against the background and clearly visible.
  - (b) Use `COLORS.banner = '#444e5a'`. That is the brightest slate I found that keeps every word colour at or above 4.5:1 on it: plain 6.90, target 5.99, typed 4.60. The banner itself is then 2.19:1 against the background, which is subtle but visible at 48 px bold. QA's `#3a4450` also passes, but the banner is fainter (1.87:1).

#### R-08 - Minor (needs a browser check) - The 20 px floor may not hold in narrow windows, because the canvas is a flex item that can shrink
- **Where:** `src/style.css:15-29` (`#game` has no `flex-shrink` / `min-width`), together with `src/renderer.js:45`.
- **Relates to:** NFR-8, R-04.
- **What's wrong:** `#game` is a flex item with `flex-shrink: 1` and `min-width: auto`.
  - For a replaced element, the automatic minimum is `min(specified width, natural width)`. A canvas's natural width is its `width` attribute in CSS px: 300 before the first `ensureSize`, then `round(clientWidth * dpr)`.
  - In a viewport narrower than 667 px at DPR 1, the canvas can therefore shrink to the viewport width. `ensureSize` then sets `canvas.width` to that smaller width, so the shrunken size becomes stable.
  - At DPR >= 2 the floor recovers after one frame, because the natural width is then larger than 667.
  - Short-but-wide windows aren't affected: there the main-axis width is never under pressure.

  I couldn't confirm this in a browser (none is installed here), so treat it as a suspected issue and check it in M-16 / M-17. If the user adopts the R-06 recommendation and drops the floor, this finding no longer applies.
- **Fix:** add `flex: none;` (or `flex-shrink: 0;`) to `#game`. It is harmless in every case.

#### R-09 - Nit - The backing store is sized from rounded CSS sizes, with separate x and y scales
- **Where:** `src/renderer.js:39-48`.
- **Relates to:** R-04, DESIGN 6.3.
- **What's wrong:** `clientWidth` and `clientHeight` are integers, but the displayed box is usually fractional (for example 1270.59 x 1080). So the backing store is off by up to 1 CSS px, the browser resamples slightly, and `setTransform` uses x and y scales that differ by up to about 0.2%. Neither effect is visible in practice.
- **Fix:** read `const r = canvas.getBoundingClientRect()` and use `canvas.width = Math.round(r.width * dpr)`. Set `canvas.height = Math.round(canvas.width * CANVAS_H / CANVAS_W)` and use one uniform scale: `const k = canvas.width / CANVAS_W; ctx.setTransform(k, 0, 0, k, 0, 0)`.

Finding count, Round 2: 0 blocker, 1 major (R-06, user decision pending), 2 minor (R-07, R-08), 1 nit (R-09). Doc items for the architect (not counted as code findings): N-2 (DESIGN 6.3 sizing) and OI-6 (DESIGN 5.2 / Q-4 accuracy formula).

### What's good

- The fixes are minimal and well targeted. Each one carries a comment citing its R-ID and the DESIGN or AC reference. The pure logic still imports nothing and never mutates its inputs.
- The R-02 fix multiplies before dividing, the right exact-arithmetic fix rather than an epsilon hack. Its exhaustive tie sweep makes the rounding contract hard to break again.
- Using `margin: auto` instead of `justify-content` / `align-items: center` is a careful choice: oversized content stays reachable from the top-left instead of being pushed off-screen on both sides.

### Manual checks that matter most before sign-off

None of TEST_REPORT M-1 to M-17 has been run yet. Before release, at least these:
- **M-17 (R-06 / N-1):** in a viewport of about 600 x 500, see how much of the fall is hidden, then repeat after the user's N-1 decision is in place.
- **M-16 (R-04, R-08):** sharpness at 1920x1080, 150% / 200% zoom and high DPI. With DPR 1 and a viewport narrower than 667 px, inspect `#game`: its width should be at least 667 px (R-08). Check the contrast values.
- **M-6 (R-03, R-07):** the banner sits behind the words, a target word with typed letters stays readable across the banner, and the banner stays behind the pause overlay.
- **M-5 (R-01)** and **M-2 step 5 (R-02, 23 correct and 17 typos shows 58%)**.
- **M-8 (auto-pause and resume), M-13 (focus on load, no scrolling)** and **M-14 (all four browsers, including the 800:680 shape in Safari, N-5).**
- **M-15 (NFR-2):** at level 10, including a run with the window maximized on the largest display available, because of the backing-store size.

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
