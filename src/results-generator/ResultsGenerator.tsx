import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CARD_BASE_WIDTH,
  cardHeight,
  drawResultCard,
  type ResultCardOptions,
} from './drawResultCard';

/** Real result pages on typelesonline.nl, with their exact titles. */
const PRESETS = [
  { id: 'letters', title: 'Oefening met letters - resultaat' },
  { id: 'text', title: 'Oefening met voorbeeldtekst - resultaat' },
  { id: 'mytext', title: 'Oefening met eigen tekst - resultaat' },
  { id: 'test', title: 'Resultaat van de typetest' },
] as const;

function parseTimeToSeconds(value: string): number {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function toInt(value: string, max = 999999): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

const inputCls =
  'w-full rounded-lg border border-[#2c4166] bg-[#0d1728] px-3 py-2 text-sm text-white ' +
  'outline-none placeholder:text-slate-500 focus:border-[#4f7ab5]';
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400';
const btnCls =
  'rounded-lg border border-[#5b8abf] bg-gradient-to-b from-[#3a6ba3] to-[#27507f] ' +
  'px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40';
const ghostBtnCls =
  'rounded-lg border border-[#2c4166] bg-[#13233c] px-3 py-2 text-sm font-medium text-slate-200 ' +
  'transition hover:border-[#4f7ab5] active:scale-[0.98]';

export default function ResultsGenerator() {
  const [presetId, setPresetId] = useState<string>('letters');
  const [title, setTitle] = useState<string>(PRESETS[0].title);
  const [total, setTotal] = useState('312');
  const [errors, setErrors] = useState('7');
  const [speed, setSpeed] = useState('156');
  const [time, setTime] = useState('02:00');
  const [showTitle, setShowTitle] = useState(true);
  const [showButtons, setShowButtons] = useState(true);
  const [exportScale, setExportScale] = useState(2);
  const [status, setStatus] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const opts: ResultCardOptions = useMemo(
    () => ({
      title: title.trim() || 'Oefening met letters - resultaat',
      total: toInt(total),
      errors: toInt(errors),
      speed: toInt(speed),
      time: /^\d{1,3}:[0-5]\d$/.test(time.trim()) ? time.trim() : '00:00',
      showTitle,
      showButtons,
    }),
    [title, total, errors, speed, time, showTitle, showButtons],
  );

  // Live preview at fixed 2x for crisp rendering.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const previewScale = 2;
    c.width = CARD_BASE_WIDTH * previewScale;
    c.height = cardHeight(opts) * previewScale;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawResultCard(ctx, opts, previewScale);
  }, [opts]);

  const errorPct =
    opts.total > 0 ? ((opts.errors / opts.total) * 100).toFixed(1) : null;

  function computeSpeed() {
    const secs = parseTimeToSeconds(time);
    if (secs <= 0) {
      setStatus('Vul eerst een geldige tijd (mm:ss) in.');
      return;
    }
    setSpeed(String(Math.round(opts.total / (secs / 60))));
    setStatus('Snelheid berekend uit totaal en tijd.');
  }

  function computeTime() {
    if (opts.speed <= 0) {
      setStatus('Vul eerst een snelheid groter dan 0 in.');
      return;
    }
    setTime(formatSeconds(opts.total / opts.speed));
    setStatus('Tijd berekend uit totaal en snelheid.');
  }

  function rollRealistic() {
    const t = 150 + Math.floor(Math.random() * 500); // 150-650 tekens
    const errRate = Math.random() * 0.045; // 0-4.5%
    const cpm = 90 + Math.floor(Math.random() * 130); // 90-220 tekens/min
    setTotal(String(t));
    setErrors(String(Math.max(0, Math.round(t * errRate))));
    setTime(formatSeconds(t / cpm));
    setSpeed(String(cpm));
    setStatus('Realistische waarden gegenereerd.');
  }

  function renderPng(scale: number): HTMLCanvasElement {
    const off = document.createElement('canvas');
    off.width = CARD_BASE_WIDTH * scale;
    off.height = cardHeight(opts) * scale;
    const ctx = off.getContext('2d')!;
    drawResultCard(ctx, opts, scale);
    return off;
  }

  function downloadPng() {
    const off = renderPng(exportScale);
    const url = off.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `typelesonline-resultaat-${Date.now()}.png`;
    a.click();
    setStatus(`PNG gedownload (${CARD_BASE_WIDTH * exportScale}×${cardHeight(opts) * exportScale}).`);
  }

  async function copyPng() {
    try {
      const off = renderPng(exportScale);
      const blob = await new Promise<Blob | null>((res) => off.toBlob(res, 'image/png'));
      if (!blob) throw new Error('toBlob');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('Afbeelding gekopieerd naar klembord.');
    } catch {
      setStatus('Kopiëren niet ondersteund in deze browser — gebruik Download.');
    }
  }

  return (
    <div className="min-h-screen bg-[#070c15] bg-[radial-gradient(ellipse_at_top,#0e1a2f_0%,#070c15_60%)] px-4 py-8 text-slate-200">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            TypelesOnline <span className="text-[#ffd24a]">resultaat-generator</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Maak een plaatje van een resultaatpagina van typelesonline.nl — alleen de
            statistieken en de knoppen, in het lijstje. Vul de waarden in, exporteer als PNG.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
          {/* ---------------- controls ---------------- */}
          <section className="rounded-2xl border border-[#1d2f4d] bg-[#0c1626] p-5 shadow-xl">
            <div className="mb-4">
              <label className={labelCls} htmlFor="rg-preset">
                Resultaatpagina
              </label>
              <select
                id="rg-preset"
                className={inputCls}
                value={presetId}
                onChange={(e) => {
                  const id = e.target.value;
                  setPresetId(id);
                  const preset = PRESETS.find((p) => p.id === id);
                  if (preset) setTitle(preset.title);
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
                <option value="custom">Eigen titel…</option>
              </select>
              {presetId === 'custom' && (
                <input
                  className={`${inputCls} mt-2`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titel op de pagina"
                />
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="rg-total">
                  Totaal
                </label>
                <input
                  id="rg-total"
                  className={inputCls}
                  inputMode="numeric"
                  value={total}
                  onChange={(e) => setTotal(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rg-errors">
                  Fouten
                </label>
                <input
                  id="rg-errors"
                  className={inputCls}
                  inputMode="numeric"
                  value={errors}
                  onChange={(e) => setErrors(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rg-speed">
                  Snelheid
                </label>
                <input
                  id="rg-speed"
                  className={inputCls}
                  inputMode="numeric"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value.replace(/[^\d]/g, ''))}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="rg-time">
                  Tijd (mm:ss)
                </label>
                <input
                  id="rg-time"
                  className={inputCls}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="02:00"
                />
              </div>
            </div>

            {errorPct !== null && (
              <p className="mb-4 text-xs text-slate-400">
                Foutpercentage: <span className={Number(errorPct) <= 5 ? 'text-emerald-400' : 'text-amber-400'}>{errorPct}%</span>{' '}
                <span className="text-slate-500">(site zegt: herhaal tot ≤ 5%)</span>
              </p>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
              <button type="button" className={ghostBtnCls} onClick={computeSpeed}>
                Bereken snelheid
              </button>
              <button type="button" className={ghostBtnCls} onClick={computeTime}>
                Bereken tijd
              </button>
              <button type="button" className={ghostBtnCls} onClick={rollRealistic}>
                Realistisch voorbeeld
              </button>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[#3a6ba3]"
                  checked={showTitle}
                  onChange={(e) => setShowTitle(e.target.checked)}
                />
                Titel tonen
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-[#3a6ba3]"
                  checked={showButtons}
                  onChange={(e) => setShowButtons(e.target.checked)}
                />
                Knoppen tonen (Terug / Herhaal / Verder)
              </label>
            </div>

            <div className="mb-4">
              <label className={labelCls} htmlFor="rg-scale">
                Exportformaat
              </label>
              <select
                id="rg-scale"
                className={inputCls}
                value={exportScale}
                onChange={(e) => setExportScale(Number(e.target.value))}
              >
                <option value={1}>1× — 600 px breed</option>
                <option value={2}>2× — 1200 px breed</option>
                <option value={3}>3× — 1800 px breed</option>
                <option value={4}>4× — 2400 px breed</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnCls} onClick={downloadPng}>
                Download PNG
              </button>
              <button type="button" className={ghostBtnCls} onClick={copyPng}>
                Kopieer naar klembord
              </button>
            </div>

            {status && <p className="mt-3 text-xs text-slate-400">{status}</p>}
          </section>

          {/* ---------------- preview ---------------- */}
          <section className="flex flex-col items-center rounded-2xl border border-[#1d2f4d] bg-[#0c1626] p-5 shadow-xl">
            <h2 className="mb-4 self-start text-sm font-semibold uppercase tracking-wide text-slate-400">
              Voorbeeld
            </h2>
            <canvas
              ref={canvasRef}
              className="h-auto w-full max-w-[560px]"
              style={{ imageRendering: 'auto' }}
              aria-label="Voorbeeld van het gegenereerde resultaat"
            />
            <p className="mt-4 text-center text-xs text-slate-500">
              De hoeken buiten het kader zijn transparant in de export.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
