import { useState } from 'react';
import { weaponsByCategory } from '../data/weapons';
import type { Loadout, WeaponCategory } from '../types';

const CATEGORY_ORDER: WeaponCategory[] = ['primary', 'secondary', 'melee', 'misc'];
const LAST_LOADOUT_KEY = 'duel-arena-last-loadout';
const CATEGORY_LABELS: Record<WeaponCategory, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  melee: 'Melee',
  misc: 'Misc',
};

export default function LoadoutSelect({
  bannedWeapons,
  onConfirm,
  waitingOnOpponent,
}: {
  bannedWeapons: string[];
  onConfirm: (loadout: Loadout) => void;
  waitingOnOpponent: boolean;
}) {
  // Pre-fill with the last loadout used (minus anything now banned) so a rematch is one click.
  const [loadout, setLoadout] = useState<Loadout>(() => {
    const empty: Loadout = { primary: null, secondary: null, melee: null, misc: null };
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_LOADOUT_KEY) ?? 'null') as Partial<Loadout> | null;
      if (!saved) return empty;
      for (const cat of CATEGORY_ORDER) {
        const id = saved[cat];
        if (typeof id === 'string' && !bannedWeapons.includes(id) && weaponsByCategory(cat, bannedWeapons).some((w) => w.id === id)) {
          empty[cat] = id;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    return empty;
  });
  const [confirmed, setConfirmed] = useState(false);

  const ready = CATEGORY_ORDER.every((c) => loadout[c]);

  function select(cat: WeaponCategory, id: string) {
    if (confirmed) return;
    setLoadout((prev) => ({ ...prev, [cat]: id }));
  }

  function confirm() {
    if (!ready) return;
    try {
      localStorage.setItem(LAST_LOADOUT_KEY, JSON.stringify(loadout));
    } catch {
      /* storage unavailable */
    }
    setConfirmed(true);
    onConfirm(loadout);
  }

  if (confirmed || waitingOnOpponent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-center text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        <h2 className="mt-6 text-xl font-bold">Waiting for opponent to lock in their loadout…</h2>
        <p className="mt-2 text-sm text-white/50">The match begins the moment both of you are ready.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-black">Choose Your Loadout</h1>
          <p className="mt-1 text-sm text-white/50">Pick one weapon from each category</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CATEGORY_ORDER.map((cat) => {
            const options = weaponsByCategory(cat, bannedWeapons);
            return (
              <div key={cat} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/70">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="space-y-2">
                  {options.length === 0 && <div className="text-sm text-white/30">No weapons available</div>}
                  {options.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => select(cat, w.id)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        loadout[cat] === w.id
                          ? 'border-amber-400 bg-amber-400/10 ring-1 ring-amber-400'
                          : 'border-white/10 bg-black/20 hover:bg-black/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{w.name}</span>
                        <span
                          className="h-4 w-4 rounded-sm border border-white/30"
                          style={{ background: w.color }}
                        />
                      </div>
                      <div className="mt-1 text-xs text-white/50">{w.description}</div>
                      <div className="mt-1 flex gap-3 text-[11px] text-white/40">
                        <span>DMG {w.damage}</span>
                        {w.magSize > 0 && <span>MAG {w.magSize}</span>}
                        <span>RNG {w.range}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          disabled={!ready}
          onClick={confirm}
          className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Confirm Loadout
        </button>
      </div>
    </div>
  );
}
