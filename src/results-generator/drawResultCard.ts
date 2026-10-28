/**
 * Draws a replica of the typelesonline.nl results card (stats table + the
 * Terug / Herhaal / Verder buttons) onto a 2D canvas context.
 *
 * Pure drawing code — no DOM access — so the same module is reused by
 * check/drawCard.ts under node-canvas for visual verification.
 */

export interface ResultCardOptions {
  title: string;
  total: number;
  errors: number;
  speed: number;
  /** "mm:ss" */
  time: string;
  showTitle: boolean;
  showButtons: boolean;
}

export const THEME = {
  frameTop: '#17273f',
  frameBottom: '#0a1322',
  frameBorder: '#3b5c8f',
  text: '#ffffff',
  btnTop: '#3a6ba3',
  btnBottom: '#27507f',
  btnBorder: '#5b8abf',
  btnText: '#ffffff',
  btnShadow: 'rgba(0, 0, 0, 0.45)',
};

const FONT_STACK = 'Verdana, "DejaVu Sans", "Liberation Sans", Arial, sans-serif';

/** Logical (scale 1) card width in px. */
export const CARD_BASE_WIDTH = 600;

/** Logical card height for the given options. */
export function cardHeight(opts: ResultCardOptions): number {
  let h = 34; // top padding
  if (opts.showTitle) h += 26 + 24; // title line + gap
  h += 4 * 36; // stat rows
  if (opts.showButtons) h += 30 + 46; // gap + buttons
  return h + 36; // bottom padding
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
): void {
  ctx.save();
  ctx.shadowColor = THEME.btnShadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, THEME.btnTop);
  g.addColorStop(1, THEME.btnBottom);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = THEME.btnBorder;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, 9);
  ctx.stroke();

  ctx.font = `bold 18px ${FONT_STACK}`;
  ctx.fillStyle = THEME.btnText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

/**
 * Renders the card. `scale` multiplies every coordinate, so the same function
 * is used for the on-screen preview (2x) and the exported PNG (1x-4x).
 * Corners outside the rounded frame stay transparent.
 */
export function drawResultCard(
  ctx: CanvasRenderingContext2D,
  opts: ResultCardOptions,
  scale = 1,
): void {
  const w = CARD_BASE_WIDTH;
  const h = cardHeight(opts);

  ctx.save();
  ctx.scale(scale, scale);

  // Rounded frame with subtle vertical gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, THEME.frameTop);
  bg.addColorStop(1, THEME.frameBottom);
  ctx.fillStyle = bg;
  roundRectPath(ctx, 0, 0, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = THEME.frameBorder;
  ctx.lineWidth = 2;
  roundRectPath(ctx, 1, 1, w - 2, h - 2, 17);
  ctx.stroke();

  let y = 34;

  if (opts.showTitle) {
    ctx.font = `bold 26px ${FONT_STACK}`;
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.title, w / 2, y + 13);
    y += 26 + 24;
  }

  const rows: Array<[string, string]> = [
    ['Totaal', String(opts.total)],
    ['Fouten', String(opts.errors)],
    ['Snelheid', String(opts.speed)],
    ['Tijd', opts.time],
  ];
  const labelRight = 262;
  const colonX = 288;
  const valueX = 312;
  ctx.textBaseline = 'middle';
  for (const [label, value] of rows) {
    const cy = y + 18;
    ctx.font = `bold 21px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.text;
    ctx.fillText(label, labelRight, cy);

    ctx.font = `21px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(':', colonX, cy);

    ctx.textAlign = 'left';
    ctx.fillText(value, valueX, cy);
    y += 36;
  }

  if (opts.showButtons) {
    y += 30;
    const labels = ['Terug', 'Herhaal', 'Verder'];
    const bw = 150;
    const bh = 46;
    const gap = 30;
    let bx = (w - (labels.length * bw + (labels.length - 1) * gap)) / 2;
    for (const label of labels) {
      drawButton(ctx, bx, y, bw, bh, label);
      bx += bw + gap;
    }
  }

  ctx.restore();
}
