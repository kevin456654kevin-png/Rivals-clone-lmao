import { useState } from 'react';
import { MAPS } from '../data/maps';
import { WEAPONS } from '../data/weapons';
import type { WeaponCategory } from '../types';

const CATEGORY_ORDER: WeaponCategory[] = ['primary', 'secondary', 'melee', 'misc'];
const CATEGORY_LABELS: Record<WeaponCategory, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  melee: 'Melee',
  misc: 'Misc',
};

export default function HostSetup({
  onBack,
  onCreate,
  status,
}: {
  onBack: () => void;
  onCreate: (mapId: string, banned: string[]) => void;
  status: 'idle' | 'creating' | 'error';
}) {
  const [mapId, setMapId] = useState(MAPS[0].id);
  const [banned, setBanned] = useState<string[]>([]);

  function toggleBan(id: string) {
    setBanned((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  // Ensure at least one weapon per category remains available
  function categoryFullyBanned(cat: WeaponCategory) {
    return WEAPONS.filter((w) => w.category === cat).every((w) => banned.includes(w.id));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-white md:p-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-sm text-white/50 hover:text-white">
            ← Back
          </button>
          <h1 className="text-2xl font-black">Create Room</h1>
          <div className="w-12" />
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">Select Map</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {MAPS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMapId(m.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  mapId === m.id
                    ? 'border-amber-400 bg-amber-400/10 ring-1 ring-amber-400'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div
                  className="mb-3 h-20 w-full rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${m.skyColor}, ${m.floorColor})` }}
                />
                <div className="font-bold">{m.name}</div>
                <div className="mt-1 text-xs text-white/50">{m.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
            Ban Weapons <span className="text-white/30">(banned weapons can't be picked by either player)</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CATEGORY_ORDER.map((cat) => (
              <div key={cat} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white/80">{CATEGORY_LABELS[cat]}</h3>
                  {categoryFullyBanned(cat) && (
                    <span className="text-xs font-semibold text-red-400">⚠ all banned</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {WEAPONS.filter((w) => w.category === cat).map((w) => (
                    <label
                      key={w.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                        banned.includes(w.id)
                          ? 'border-red-500/40 bg-red-500/10 text-red-300 line-through'
                          : 'border-white/10 bg-black/20 hover:bg-black/30'
                      }`}
                    >
                      <span>
                        {w.name}
                        <span className="ml-2 text-xs text-white/40">
                          dmg {w.damage} · rng {w.range}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-red-500"
                        checked={banned.includes(w.id)}
                        onChange={() => toggleBan(w.id)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {status === 'error' && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Failed to create room. Check your connection and try again.
          </div>
        )}

        <button
          disabled={CATEGORY_ORDER.some(categoryFullyBanned) || status === 'creating'}
          onClick={() => onCreate(mapId, banned)}
          className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'creating' ? 'Creating room…' : 'Create Room & Get Code'}
        </button>
      </div>
    </div>
  );
}
