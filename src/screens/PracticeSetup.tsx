import { useState } from 'react';
import { MAPS } from '../data/maps';
import { DEFAULT_PRACTICE, type PracticeConfig } from '../types';

const PRACTICE_MAP_IDS = ['range', 'empty'];
const BOT_COUNTS = [0, 1, 2, 3, 4];

const SKILL_LABELS: [number, string, string][] = [
  [0.15, 'Rookie', 'Slow to react, sprays wide'],
  [0.5, 'Regular', 'Decent aim, punishes lazy peeks'],
  [0.8, 'Veteran', 'Fast reaction, tight groups'],
  [1, 'Cracked', 'Nearly instant, nearly always on target'],
];

function skillLabel(v: number) {
  let best = SKILL_LABELS[0];
  for (const s of SKILL_LABELS) if (Math.abs(s[0] - v) < Math.abs(best[0] - v)) best = s;
  return best;
}

function Card({
  active,
  onClick,
  title,
  hint,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-left transition ${
        active ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5'
      } ${onClick ? 'cursor-pointer hover:bg-white/10' : ''}`}
      onClick={onClick}
    >
      <div className="font-bold">{title}</div>
      {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
      {children}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-white/40">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? 'bg-amber-500' : 'bg-white/20'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            value ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function PracticeSetup({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (config: PracticeConfig) => void;
}) {
  const [cfg, setCfg] = useState<PracticeConfig>({ ...DEFAULT_PRACTICE });
  const set = (patch: Partial<PracticeConfig>) => setCfg((prev) => ({ ...prev, ...patch }));
  const maps = MAPS.filter((m) => PRACTICE_MAP_IDS.includes(m.id));
  const skill = skillLabel(cfg.botSkill);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-white/50 hover:text-white">
            ← Back
          </button>
          <h1 className="text-2xl font-black">Practice Range</h1>
          <div className="w-12" />
        </div>
        <p className="text-sm text-white/50">
          Offline, no opponent needed. Shoot plates, duel bots, and dial in your quickscope. Everything
          here is local — nothing is sent over the network.
        </p>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Map</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {maps.map((m) => (
              <Card
                key={m.id}
                active={cfg.mapId === m.id}
                onClick={() => set({ mapId: m.id })}
                title={m.name}
                hint={m.description}
              >
                <div
                  className="mt-3 h-16 w-full rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${m.skyColor}, ${m.floorColor})` }}
                />
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Bots</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card title="Number of bots" hint="They wander, take cover and shoot back">
              <div className="mt-3 flex gap-2">
                {BOT_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => set({ bots: n })}
                    className={`h-10 flex-1 rounded-lg border text-sm font-bold transition ${
                      cfg.bots === n
                        ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                        : 'border-white/20 bg-black/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {n === 0 ? 'Off' : n}
                  </button>
                ))}
              </div>
            </Card>
            <Card title="Bot skill" hint={cfg.bots === 0 ? 'No bots selected' : skill[2]}>
              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={cfg.botSkill}
                  disabled={cfg.bots === 0}
                  onChange={(e) => set({ botSkill: Number(e.target.value) })}
                  className="w-full accent-amber-500 disabled:opacity-40"
                />
                <div className="mt-1 text-right text-sm font-bold text-amber-300">{skill[1]}</div>
              </div>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Range options</h2>
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
            <Toggle
              label="Target plates"
              hint="Rows of plates at close, mid and long range, plus an elevated pair"
              value={cfg.targets}
              onChange={(v) => set({ targets: v })}
            />
            <Toggle
              label="Moving targets"
              hint="Some plates slide left and right"
              value={cfg.movingTargets}
              onChange={(v) => set({ movingTargets: v })}
            />
            <Toggle
              label="Infinite ammo"
              hint="Never run dry — no reloads needed while you work on aim"
              value={cfg.infiniteAmmo}
              onChange={(v) => set({ infiniteAmmo: v })}
            />
          </div>
        </section>

        <button
          onClick={() => onStart(cfg)}
          className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[0.99]"
        >
          Pick loadout →
        </button>
      </div>
    </div>
  );
}
