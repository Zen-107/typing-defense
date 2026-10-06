// Draws a game state onto a canvas. Reads state only; contains no game rules.
import { CONFIG, accuracyPercent, getTarget } from './game-logic.js';

const HUD_HEIGHT = 40;
const TOP_PAD = 28; // keeps glyphs of a word with baseline y = 0 visible (Q-3)
const BOTTOM_PAD = 12; // room for descenders below y = 600
const FIELD_TOP = HUD_HEIGHT + TOP_PAD; // canvas y of playfield y = 0
const CANVAS_W = CONFIG.FIELD_WIDTH;
const CANVAS_H = HUD_HEIGHT + TOP_PAD + CONFIG.FIELD_HEIGHT + BOTTOM_PAD; // 680

const COLORS = {
  bg: '#101418',
  hudBg: '#181e24',
  text: '#e8e8e8',
  word: '#e8e8e8',
  target: '#ffd54a',
  typed: '#4cd964',
  flash: '#ff3b30',
  dim: '#a0a8b0',
  banner: '#6b7785', // muted slate: readable at 48 px bold, clearly dimmer than words (#e8e8e8) and not target yellow
  overlay: 'rgba(0, 0, 0, 0.6)',
};

const FONT_FAMILY = '"Courier New", Consolas, monospace';
const WORD_FONT = `${CONFIG.FONT_SIZE_PX}px ${FONT_FAMILY}`;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let lastCssW = -1;
  let lastCssH = -1;
  let lastDpr = -1;

  // R-04: size the backing store from the displayed CSS size x devicePixelRatio,
  // so text is sharp at any window size. Checked every frame (cheap compare), which
  // covers window resizes and DPR changes (zoom, moving to another monitor).
  // Drawing always uses the logical 800 x 680 coordinate system via the transform.
  function ensureSize() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cssW = canvas.clientWidth || CANVAS_W;
    const cssH = canvas.clientHeight || CANVAS_H;
    if (cssW !== lastCssW || cssH !== lastCssH || dpr !== lastDpr) {
      lastCssW = cssW;
      lastCssH = cssH;
      lastDpr = dpr;
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
    }
    ctx.setTransform(canvas.width / CANVAS_W, 0, 0, canvas.height / CANVAS_H, 0, 0);
  }

  ensureSize();
  ctx.font = WORD_FONT;
  const mWidth = ctx.measureText('m').width;
  if (mWidth > CONFIG.CHAR_WIDTH_PX) {
    console.warn(`Typing Defense: monospace advance ${mWidth}px exceeds CHAR_WIDTH_PX ${CONFIG.CHAR_WIDTH_PX}px`);
  }

  function centerText(text, y, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, CANVAS_W / 2, y);
  }

  function drawHud(state) {
    ctx.fillStyle = COLORS.hudBg;
    ctx.fillRect(0, 0, CANVAS_W, HUD_HEIGHT);
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${state.score}`, 16, HUD_HEIGHT / 2);
    ctx.textAlign = 'center';
    ctx.fillText(`Lives: ${state.lives}`, CANVAS_W / 2, HUD_HEIGHT / 2);
    ctx.textAlign = 'right';
    ctx.fillText(`Level: ${state.level}`, CANVAS_W - 16, HUD_HEIGHT / 2);
    ctx.textBaseline = 'alphabetic';
  }

  function drawWords(state) {
    const target = getTarget(state);
    ctx.font = WORD_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (const w of state.words) {
      const baseY = FIELD_TOP + w.y;
      if (target && w.id === target.id) {
        const typed = state.typed;
        const rest = w.text.slice(typed.length);
        ctx.fillStyle = COLORS.typed;
        ctx.fillText(typed, w.x, baseY);
        const typedW = ctx.measureText(typed).width;
        ctx.fillStyle = COLORS.target;
        ctx.fillText(rest, w.x + typedW, baseY);
        const fullW = ctx.measureText(w.text).width;
        ctx.fillStyle = COLORS.target;
        ctx.fillRect(w.x, baseY + 4, fullW, 2);
      } else {
        ctx.fillStyle = COLORS.word;
        ctx.fillText(w.text, w.x, baseY);
      }
    }
  }

  function drawBanner(state) {
    if (state.bannerMs > 0) {
      // R-03: drawn behind the words (see render) in a muted colour distinct from the target yellow.
      centerText(`Level ${state.level}`, FIELD_TOP + CONFIG.FIELD_HEIGHT / 2, `bold 48px ${FONT_FAMILY}`, COLORS.banner);
    }
  }

  function drawFlash(state) {
    if (state.flashMs > 0) {
      const t = 6;
      ctx.strokeStyle = COLORS.flash;
      ctx.lineWidth = t;
      ctx.strokeRect(t / 2, HUD_HEIGHT + t / 2, CANVAS_W - t, CANVAS_H - HUD_HEIGHT - t);
    }
  }

  function drawStart() {
    centerText('Typing Defense', 260, `bold 56px ${FONT_FAMILY}`, COLORS.text);
    centerText('Press Enter to start', 340, `28px ${FONT_FAMILY}`, COLORS.target);
    centerText('Type the falling words before they reach the bottom', 400, `20px ${FONT_FAMILY}`, COLORS.dim);
  }

  function drawGameOver(state) {
    const acc = accuracyPercent(state.correctKeystrokes, state.typos);
    centerText('Game Over', 200, `bold 56px ${FONT_FAMILY}`, COLORS.flash);
    const font = `24px ${FONT_FAMILY}`;
    centerText(`Score: ${state.score}`, 280, font, COLORS.text);
    centerText(`Level reached: ${state.level}`, 320, font, COLORS.text);
    centerText(`Words destroyed: ${state.wordsDestroyed}`, 360, font, COLORS.text);
    centerText(`Accuracy: ${acc}%`, 400, font, COLORS.text);
    centerText('Press Enter to play again', 480, `28px ${FONT_FAMILY}`, COLORS.target);
  }

  function drawPausedOverlay() {
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, HUD_HEIGHT, CANVAS_W, CANVAS_H - HUD_HEIGHT);
    centerText('Paused - press Enter to resume', FIELD_TOP + CONFIG.FIELD_HEIGHT / 2, `28px ${FONT_FAMILY}`, COLORS.text);
  }

  function render(state) {
    ensureSize();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    switch (state.status) {
      case 'START':
        drawStart();
        break;
      case 'PLAYING':
        // R-03 / AC-9.3: banner first, words on top, so the banner never hides word text.
        drawHud(state);
        drawBanner(state);
        drawWords(state);
        drawFlash(state);
        break;
      case 'PAUSED':
        drawHud(state);
        drawBanner(state);
        drawWords(state);
        drawFlash(state);
        drawPausedOverlay();
        break;
      case 'GAME_OVER':
        // Q-7: no words, no banner, no life-lost flash on the results screen.
        drawGameOver(state);
        break;
      default:
        break;
    }
  }

  return { render };
}
