# Typing Defense - Product Requirements Document (MVP)

## 1. Overview

Typing Defense is a single-player browser typing game. Words fall from the top of a fixed-size playfield, and the player types each word to destroy it before it reaches the bottom. The player starts with 3 lives and loses 1 each time a word reaches the bottom. Points are scored for each destroyed word, and the game gets harder every 30 seconds: words spawn more often, fall faster, and get longer. The game is for casual players and typing learners (teens and adults) who want 2-5 minute sessions that test speed and accuracy. It is played with the keyboard only, runs in a modern desktop browser, and has no backend.

### Goals
- G-1: Deliver a complete game loop (start -> play -> game over -> restart) that one team can build and test in one day.
- G-2: Make every rule deterministic and expressed in numbers, so QA can write unit tests for scoring, input matching, and difficulty without reading the implementation.
- G-3: Make a typical first session last 90-300 seconds before game over, for a player typing 30-60 WPM.

### Target player
- Desktop or laptop user with a physical keyboard (US/QWERTY layout assumed).
- Typing speed 20-80 WPM.
- Needs no account, install, or tutorial. The start screen shows all required instructions in 3 lines of text or fewer.

---

## 2. User Stories

- **US-1 Start a game** - As a player, I want to start a game with one key press, so that I can begin playing right away.
- **US-2 Word spawning and falling** - As a player, I want words to appear at the top and move down at a predictable speed, so that I can tell which words are most urgent.
- **US-3 Typing and matching input** - As a player, I want my keystrokes to target one word and show my progress on it, so that I know which word I am typing and how much is left.
- **US-4 Destroying words** - As a player, I want a word to disappear as soon as I finish typing it, so that I get immediate feedback for success.
- **US-5 Lives and losing a life** - As a player, I want to lose a life when a word reaches the bottom, so that missing words has a clear cost.
- **US-6 Game over and restart** - As a player, I want to see my results when I run out of lives and restart with one key, so that I can try to beat my score.
- **US-7 Scoring** - As a player, I want longer words and higher levels to give more points, so that I am rewarded for taking on harder challenges.
- **US-8 Difficulty progression** - As a player, I want the game to get harder over time up to a limit, so that it stays challenging but is still possible to play.
- **US-9 HUD** - As a player, I want to see my score, lives, and level at all times, so that I always know where I stand.
- **US-10 Auto-pause** - As a player, I want the game to pause automatically when I switch away from the tab or window, so that I don't lose lives while I'm not looking.
- **US-11 Fit to window** - As a player in a small browser window, I want the whole game to shrink to fit the window, so that I never lose a life to a word I couldn't see.

---

## 3. Acceptance Criteria

Definitions used below:
- **Playfield**: a logical area 800 px wide x 600 px high. All positions and speeds are in logical px. The playfield may be scaled for display, but game logic uses logical units.
- **Word y-position**: the y coordinate of the word's baseline, where 0 is the top of the playfield and 600 is the bottom.
- **Active word**: a word currently on the playfield (spawned, and not yet destroyed or missed).
- **Target**: the active word the player is currently typing. There is at most one target at a time.
- **Typed prefix**: the characters correctly typed so far on the target.
- **Elapsed time**: game time in seconds since the game started. It only advances while the state is PLAYING. It does not advance in PAUSED.
- **Game states**: START, PLAYING, PAUSED, GAME_OVER.
- **Focus loss**: either the document's `visibilitychange` event with `document.visibilityState === "hidden"`, or the window's `blur` event.

### US-1 Start a game
- **AC-1.1** When the page loads, the game is in START state. It shows the title "Typing Defense", the text "Press Enter to start", and a 1-line instruction ("Type the falling words before they reach the bottom"). No words are on the playfield.
- **AC-1.2** In START state, pressing Enter changes the state to PLAYING. Any other key does nothing (no state change, no score change).
- **AC-1.3** When PLAYING begins: score = 0, lives = 3, level = 1, elapsed time = 0, active words = 0, target = none, words destroyed = 0, typos = 0.
- **AC-1.4** The first word spawns within 500 ms (elapsed time) of entering PLAYING.

### US-2 Word spawning and falling
- **AC-2.1** New words spawn on a repeating timer. The gap between spawns is the spawn interval for the current level (see Section 4.3). A level change takes effect at the next scheduled spawn.
- **AC-2.2** A spawned word starts at y = 0. Its x-position is chosen at random so the whole rendered word stays inside the playfield, with at least 10 px margin from the left and right edges.
- **AC-2.3** Each word's length is chosen at random (uniform distribution) from the length range for the current level (Section 4.3). The word is then chosen at random from the word list entries of that length.
- **AC-2.4** A new word is never identical to an active word. If the chosen word is already active, another is picked (up to 10 attempts). If all 10 attempts fail, that spawn is skipped.
- **AC-2.5** A new word never starts with the same first letter as the current target. This ensures the target cannot become ambiguous.
- **AC-2.6** If there are already 10 active words, the spawn is skipped and the timer continues as normal.
- **AC-2.7** Every active word moves down at the fall speed for the current level, using y += speed x dt (dt in seconds). Example: at level 1 (40 px/s), a word reaches y = 600 after 15.0 s.
- **AC-2.8** For movement and timers, dt is capped at 100 ms per frame. A frame with a 2-second gap moves a word at most 0.1 s x speed. The cap is only a safety net for slow frames (e.g. garbage collection pauses, or a focus-loss event that fires late). Normal tab switches are handled by auto-pause (US-10).
- **AC-2.9** All active words move at the current-level fall speed. When the level goes up, words already on screen also speed up.

### US-3 Typing and matching input
- **AC-3.1** Only the letters a-z are game input. Input is case-insensitive ("A" is treated as "a"). Backspace and Escape have the special behavior described below. All other keys (digits, space, punctuation, arrow keys, modifier keys alone) are ignored and change nothing.
- **AC-3.2** Target selection: when there is no target and the player types letter L, the target becomes the active word whose first letter is L. If more than one active word starts with L, the target is the one with the largest y (closest to the bottom). If two words have the same y, the target is the one that spawned first. The typed prefix becomes L.
- **AC-3.3** Shared prefixes: once a target is set, it stays locked. Later keystrokes are checked only against the target, even if another active word shares the same prefix. Example: target "cat" with typed prefix "ca", another active word "car", player types "r" -> this is a typo on "cat". It does not switch to "car".
- **AC-3.4** Correct keystroke: if a target is set and the typed letter equals the target's next untyped character, that letter is added to the typed prefix.
- **AC-3.5** Typo with a target: if a target is set and the typed letter does not equal the next untyped character, the typed prefix stays the same, the target stays the same, and the typo counter goes up by 1. Lives and score do not change.
- **AC-3.6** Typo without a target: if there is no target and no active word starts with the typed letter, the typo counter goes up by 1 and nothing else changes.
- **AC-3.7** Backspace: if a target is set, Backspace removes the last character of the typed prefix. If the prefix becomes empty, the target is cleared (target = none). If there is no target, Backspace does nothing. Backspace never changes the typo counter or score.
- **AC-3.8** Escape: clears the target and its typed prefix (target = none). The word stays active at the same position. Typos and score do not change.
- **AC-3.9** Visual feedback: the target is drawn differently from non-target words (different color and/or underline). Its typed prefix characters are drawn in a different color from its untyped characters. Non-target words never show typed progress.
- **AC-3.10** Input is ignored in START, PAUSED, and GAME_OVER states, except for Enter (AC-1.2, AC-6.4, AC-10.6). In PLAYING, Enter does nothing.
- **AC-3.11** Holding a key down and relying on OS key-repeat counts as repeated keystrokes. Each repeat is handled under AC-3.4 to AC-3.6.

### US-4 Destroying words
- **AC-4.1** When the typed prefix length equals the target word's length, the word is destroyed in the same input event. It is removed from the active words, target becomes none, and words destroyed goes up by 1.
- **AC-4.2** Points for the destroyed word (Section 4.2) are added to the score in the same input event.
- **AC-4.3** A destroyed word is never counted as missed, even if it was at y >= 600 - 1 px when destroyed.
- **AC-4.4** After a word is destroyed, the next letter typed selects a new target using AC-3.2.

### US-5 Lives and losing a life
- **AC-5.1** A word is missed when its y-position is >= 600. A missed word is removed from the active words, and lives go down by 1.
- **AC-5.2** If the missed word was the target, the target is cleared (target = none, typed prefix empty).
- **AC-5.3** If several words are missed in the same frame, each one costs 1 life. Lives never go below 0.
- **AC-5.4** Missing a word does not change the score.
- **AC-5.5** When a life is lost, the playfield shows a red flash or border for 300 ms (+/- 50 ms). The game does not pause.

### US-6 Game over and restart
- **AC-6.1** When lives reach 0, the state changes to GAME_OVER in that same frame. Word movement, spawning, and elapsed time all stop. The remaining active words are no longer drawn.
- **AC-6.2** The GAME_OVER screen shows: "Game Over", final score, level reached, words destroyed, accuracy, and the text "Press Enter to play again".
- **AC-6.3** Accuracy = correct keystrokes / (correct keystrokes + typos) x 100, rounded to the nearest integer and shown with a "%" sign. Correct keystrokes include target-selecting keystrokes (AC-3.2) and AC-3.4 keystrokes. If there were no keystrokes, accuracy is shown as "0%".
- **AC-6.4** In GAME_OVER state, pressing Enter starts a new game directly in PLAYING state, with every value reset as in AC-1.3. Nothing from the previous game carries over.
- **AC-6.5** In GAME_OVER state, Enter is ignored for the first 500 ms. This prevents a key that was being typed when the game ended from skipping the results screen.

### US-7 Scoring
- **AC-7.1** Points for each destroyed word = 10 x word length x current level. Examples: "cat" at level 1 = 30; "planet" at level 4 = 240; "keyboard" at level 10 = 800.
- **AC-7.2** The level used is the level at the moment the word is destroyed, not the level when it spawned.
- **AC-7.3** Typos, Backspace, Escape, and missed words never change the score. The score is always a non-negative integer.

### US-8 Difficulty progression
- **AC-8.1** Level = min(10, 1 + floor(elapsed time / 30)). Examples: at 0 s the level is 1, at 29.9 s it is 1, at 30.0 s it is 2, at 270 s it is 10, and at 600 s it is still 10.
- **AC-8.2** Spawn interval (ms) = max(650, 2000 - 150 x (level - 1)). Level 1 = 2000 ms, level 5 = 1400 ms, level 10 = 650 ms.
- **AC-8.3** Fall speed (px/s) = min(130, 40 + 10 x (level - 1)). Level 1 = 40, level 5 = 80, level 10 = 130.
- **AC-8.4** The word length range for each level follows the table in Section 4.3. A spawned word is never shorter than the range minimum or longer than the range maximum.
- **AC-8.5** Nothing in the difficulty increases after level 10. The difficulty parameters at 600 s are the same as at 270 s.

### US-9 HUD
- **AC-9.1** In PLAYING state, the HUD always shows "Score: N", "Lives: N" (or N heart icons, where N = current lives), and "Level: N".
- **AC-9.2** The HUD shows the new values in the same rendered frame as the state change (score after a destroy, lives after a miss, level at each 30 s boundary).
- **AC-9.3** The HUD is outside the 800 x 600 word area, or on top of it but never covering any word text. Words are always fully visible on screen from y = 0 to y = 600, at every browser window size (see US-11). No part of a word is ever hidden by clipping, scrolling, or the window edge before it reaches the miss line.
- **AC-9.4** When the level goes up, the text "Level N" is shown in the center of the playfield for 1000 ms (+/- 100 ms) of game time. The game does not pause.
- **AC-9.5** In PAUSED state, the HUD stays visible and shows the same score, lives, and level as at the moment the pause began.

### US-10 Auto-pause
- **AC-10.1** In PLAYING state, a focus loss changes the state to PAUSED within the same event handler, before the next game update.
- **AC-10.2** Focus loss in START, GAME_OVER, or PAUSED does nothing (no state change, no reset).
- **AC-10.3** While PAUSED, all of these are frozen and do not advance:
  - word y-positions
  - elapsed time, and so the level
  - the spawn timer: the time remaining until the next spawn stays the same. Example: if 700 ms were left at pause, the next spawn happens 700 ms of game time after resume.
  - the life-lost flash (AC-5.5) and the level-up banner (AC-9.4)

  No word spawns, no word is missed, and no life is lost while PAUSED, however long the pause lasts (tested with a 60-second pause).
- **AC-10.4** While PAUSED, the playfield shows the overlay text "Paused - press Enter to resume". Active words stay drawn at their frozen positions behind the overlay.
- **AC-10.5** While PAUSED, a-z letters, Backspace, Escape, and all other non-Enter keys are ignored. They do not change the typed prefix, the target, the typo counter, or the score, and they do not count toward accuracy.
- **AC-10.6** In PAUSED state, pressing Enter changes the state to PLAYING. The first game update after resume uses dt = 0, so no word moves further than it would have moved without the pause. Example: a word at y = 300.0 when paused is still at y = 300.0 in the first frame after resume.
- **AC-10.7** The pause keeps the target and its typed prefix. After resume, the next correct letter continues the same word.
- **AC-10.8** Regaining focus never resumes the game automatically. Only Enter resumes it. There is no Enter guard on resume, so Enter is accepted as soon as the PAUSED state begins.
- **AC-10.9** The 500 ms game-over Enter guard (AC-6.5) is not affected by pause, because pause can only start from PLAYING. If the player loses the last life and a focus loss happens in the same frame, GAME_OVER wins and the state does not become PAUSED.
- **AC-10.10** Score, lives, level, words destroyed, typo counter, and accuracy after a pause-and-resume are the same as if the pause never happened.

### US-11 Fit to window
"Game display" means the full displayed game: the 800 x 600 playfield plus the HUD. "Window" means the browser viewport in CSS px. "Reference size" means 667 x 567 CSS px.
- **AC-11.1** When the window is smaller than the reference size in either width or height, the game display scales down to fit inside the window. It uses one scale factor for both width and height, so the displayed width/height ratio matches the unscaled ratio within +/- 1%. Example test sizes: 640 x 480, 500 x 400, 400 x 300, 320 x 240.
- **AC-11.2** At every window size, including all sizes in AC-11.1 and every size at or above the reference size, the game display's bounding box is fully inside the window. Every edge is within the window bounds within 1 CSS px. No part of the game display is clipped.
- **AC-11.3** At every window size, the page shows no horizontal or vertical scrollbar. The page's scroll width and scroll height are no larger than the window's width and height.
- **AC-11.4** At every window size, the whole playfield from y = 0 to y = 600 (including the miss line at y = 600), the full HUD (score, lives, level), and all overlay text (start, paused, game over, level banner) are inside the visible area.
- **AC-11.5** Resizing the window during any state (START, PLAYING, PAUSED, GAME_OVER) rescales the game display to meet AC-11.1 to AC-11.4 by the next rendered frame after the resize event. A resize never changes the game state, score, lives, level, elapsed time, spawn timer, word positions, target, or typed prefix. A resize does not cause a pause by itself; only focus loss does (AC-10.1).
- **AC-11.6** Display size never affects gameplay. All game logic uses logical playfield coordinates (800 x 600). These all stay the same for every window size: spawn x range, fall speed in logical px/s, the miss line at logical y = 600, and the time a word takes to reach it (15.0 s at level 1). Example: a full level-1 fall takes 15.0 s (+/- 0.1 s) both at 1280 x 720 and at 400 x 300.
- **AC-11.7** When the window is at least the reference size in both width and height, word text is at least 20 CSS px tall (NFR-8). Below the reference size, text may be smaller than 20 CSS px, scaled by the same factor as the rest of the game display.

---

## 4. Game Rules & Numbers

### 4.1 Core values
| Parameter | Value |
|---|---|
| Playfield (logical) | 800 x 600 px |
| Starting lives | 3 |
| Max lives | 3 (no way to gain lives) |
| Max active words | 10 |
| Word spawn y | 0 |
| Miss line | y >= 600 |
| Horizontal margin | 10 px each side |
| Max dt per frame | 100 ms |
| Level duration | 30 s of elapsed time |
| Max level | 10 (reached at 270 s) |
| Auto-pause trigger | Focus loss (tab hidden or window blur) while PLAYING |
| Resume key | Enter (no guard delay) |
| Game-over Enter guard | 500 ms |

### 4.2 Scoring formula
`points = 10 x wordLength x level` (level = the level when the word is destroyed).
There are no combo, accuracy, or time bonuses in the MVP. Typos and misses do not cost points.

### 4.3 Difficulty table
| Level | Starts at (s) | Spawn interval (ms) | Fall speed (px/s) | Time to fall 600 px (s) | Word length range |
|---|---|---|---|---|---|
| 1 | 0 | 2000 | 40 | 15.0 | 3-4 |
| 2 | 30 | 1850 | 50 | 12.0 | 3-4 |
| 3 | 60 | 1700 | 60 | 10.0 | 3-5 |
| 4 | 90 | 1550 | 70 | 8.6 | 3-5 |
| 5 | 120 | 1400 | 80 | 7.5 | 4-6 |
| 6 | 150 | 1250 | 90 | 6.7 | 4-6 |
| 7 | 180 | 1100 | 100 | 6.0 | 4-7 |
| 8 | 210 | 950 | 110 | 5.5 | 5-7 |
| 9 | 240 | 800 | 120 | 5.0 | 5-8 |
| 10 (cap) | 270 | 650 | 130 | 4.6 | 5-8 |

Formulas: spawn interval = max(650, 2000 - 150 x (level - 1)); fall speed = min(130, 40 + 10 x (level - 1)).

These pacing values are confirmed for the MVP. They may be tuned after the first playtest. If they are, only the constants change: the formula shapes in AC-8.1 to AC-8.3 stay the same.

### 4.4 Input-matching rules (summary)
1. Only a-z count as input, and case does not matter.
2. With no target, the first letter selects the matching active word with the largest y. Ties go to the word that spawned first.
3. Once set, the target is locked. A mismatched letter is a typo: it is not added and it never switches the target to another word. It costs no life and no points; it only lowers accuracy (AC-6.3).
4. Backspace removes 1 typed character. Removing the last one clears the target.
5. Escape clears the target. Escape and the Backspace path in rule 4 are the only ways to switch to a different word.
6. A new word never shares its first letter with the current target, and the same word never appears twice on screen at once.

### 4.5 Word list
- The word list is a static list of English words bundled with the game. It is loaded with no network request after the page loads.
- Content: lowercase a-z only. No proper nouns, no profanity, and no duplicates.
- Size: at least 40 words for each length from 3 to 8 (at least 240 words in total).
- Source: the team writes the list from common English vocabulary (e.g. high-frequency words). There are no licensing restrictions because the list is written in-house.

---

## 5. Non-Functional Requirements
- **NFR-1 Platform**: runs in the latest stable versions of Chrome, Firefox, Edge, and Safari on desktop. No backend, no login, no network requests after the first page load.
- **NFR-2 Performance**: targets 60 fps. With 10 active words on a mid-range laptop (4-core CPU, integrated GPU), average frame time is <= 16.7 ms and no frame takes more than 50 ms over a 60-second run at level 10.
- **NFR-3 Frame-rate independence**: word positions depend only on elapsed time, not on frame count. At 30 fps and at 144 fps, a word at level 1 reaches y = 600 after 15.0 s (+/- 0.1 s).
- **NFR-4 Keyboard-only**: the full flow (start, play, pause/resume, game over, restart) can be completed without a mouse. No mouse or touch input is required anywhere.
- **NFR-5 Input latency**: a keystroke's effect (typed prefix color, destroy, HUD update) appears in the next rendered frame (<= 17 ms at 60 fps).
- **NFR-6 Focus**: the game receives keystrokes as soon as the page loads, without the player clicking first. Letter and Backspace keys do not trigger browser default actions (e.g. scrolling, back navigation) while the game page is focused.
- **NFR-7 Testability**: the scoring, level, spawn-interval, fall-speed, length-range, and input-matching rules must be checkable with unit tests that do not need a rendered page.
- **NFR-8 Readability**:
  - At 100% browser zoom, in a window of at least 667 x 567 CSS px, word text is at least 20 CSS px tall.
  - In smaller windows, the game display scales down to fit (US-11), so text may be smaller than 20 CSS px. Fitting the whole game in the window takes priority over the minimum text size.
  - The contrast ratio between word text and background is at least 4.5:1 at every window size.
- **NFR-9 No clipping or scrolling**: at every window size, the whole game display (playfield, miss line, and HUD) is visible with no clipping and no page scrolling (AC-11.2 to AC-11.4).

---

## 6. Out of Scope (MVP)
- Saving high scores, leaderboards, or anything else stored between sessions (including localStorage).
- Accounts, backend, multiplayer, analytics.
- Sound effects and music.
- A manual pause key, a pause menu, and settings (difficulty selection, custom word lists, key remapping). The only pause is the auto-pause in US-10.
- Power-ups, bonus words, combos/streak multipliers, regaining lives.
- Mobile and touch play, on-screen keyboards, non-QWERTY or IME/non-Latin input, accented characters.
- Words containing capitals, digits, hyphens, apostrophes, or spaces.
- Localization (UI and words in English only).
- Animations beyond the life-lost flash (AC-5.5) and the level-up banner (AC-9.4). No particle effects on destroy.
- Tutorial mode, practice mode, levels beyond 10.
- A "please enlarge the window" hint or warning for small windows. Small windows are handled only by scaling down (US-11).

---

## 7. Open Questions
None remain. All earlier questions (OQ-1 to OQ-5) were answered on 2026-10-06. See the Changelog.

Possible follow-ups (they do not block the MVP):
- Should the player be able to pause manually with a key? Today this is out of scope, and Escape is already used to clear the target.
- Should a small-window hint be added later (e.g. "Text is small - enlarge the window for best play") when the window is below 667 x 567 CSS px? Today this is out of scope (Section 6).
- Is there a smallest window size we officially support for playability? AC-11.1 tests down to 320 x 240. Below that, the no-clip and no-scroll rules still apply, but text may be too small to read.

---

## 8. Changelog

### 2026-10-06 - Revision 3 (review finding R-06 / QA N-1)
- Decision: the game display scales down to fit small windows. It is never clipped and never scrolled, it keeps its aspect ratio, and the whole playfield and HUD are always visible. The 20 CSS px minimum text size applies only in windows of at least 667 x 567 CSS px; below that, text may be smaller.
- Reason: code review Round 2 (docs/REVIEW.md, R-06) and QA Round 2 (docs/TEST_REPORT.md, N-1) found that the canvas had a minimum display size of 667 x 567 CSS px. In smaller windows it was clipped on the right and bottom, so a word could disappear before the miss line and cost a life the player never saw. This broke AC-9.3.
- Changed: AC-9.3 (words are fully visible at every window size, with no clipping or scrolling), NFR-8 (the 20 px minimum only applies in windows of at least 667 x 567 CSS px; contrast applies at every size).
- Added: US-11 Fit to window with AC-11.1 to AC-11.7, and NFR-9 (no clipping or scrolling).
- Out of Scope: added the small-window hint.
- Open Questions: added two non-blocking follow-ups (a small-window hint, and the smallest supported window size).

### 2026-10-06 - Revision 2 (open questions answered by the user)
- OQ-1 -> YES: added auto-pause.
  - New user story US-10 with acceptance criteria AC-10.1 to AC-10.10.
  - New PAUSED game state and a "Focus loss" definition in Section 3.
  - AC-2.8: the 100 ms dt cap is now described only as a safety net for slow frames.
  - AC-3.10: input is now also ignored in PAUSED, and Enter does nothing in PLAYING.
  - AC-9.4: the level banner duration now counts in game time.
  - New AC-9.5: the HUD stays visible while paused.
  - Section 4.1: added rows for auto-pause and the resume key.
  - NFR-4: now includes pause/resume.
  - Out of Scope: now says the only pause is the auto-pause.
- OQ-2 -> NO: high scores and localStorage stay Out of Scope.
- OQ-3 -> NO: confirmed that typos cost no points and only lower accuracy (AC-3.5, AC-7.3, Section 4.4 rule 3).
- OQ-4 -> keep the current pacing (Section 4.3). Added a note that it may be tuned after playtest.
- OQ-5 -> NO: confirmed that a letter that doesn't match never switches the target (AC-3.3, Section 4.4 rules 3 and 5).
- Open Questions: removed OQ-1 to OQ-5. A manual pause key is listed as a possible follow-up.

### 2026-10-06 - Revision 1
- First version of the PRD.
