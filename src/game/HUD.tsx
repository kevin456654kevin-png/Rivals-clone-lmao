import type { WeaponDef } from '../types';

export interface HudState {
  hp: number;
  ammo: number;
  magSize: number;
  reloading: boolean;
  weapon: WeaponDef | undefined;
  slots: { key: string; label: string; weapon: WeaponDef | undefined; active: boolean }[];
  sliding: boolean;
  crouching: boolean;
  speed: number;
  medkitUsed: boolean;
  connectionLost: boolean;
  damageDealt: number;
  damageTaken: number;
  hits: number;
  score: { wins: number; losses: number };
}

export function HUD({ state }: { state: HudState }) {
  const hpPct = Math.max(0, Math.min(100, state.hp));
  return (
    <div className="pointer-events-none absolute inset-0 select-none font-sans">
      {/* Crosshair */}
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-1/2 top-1/2 h-0.5 w-3 -translate-x-1/2 -translate-y-1/2 bg-white/80 shadow" />
        <div className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/80 shadow" />
      </div>

      {state.connectionLost && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-md bg-red-600/90 px-4 py-1.5 text-sm font-semibold text-white shadow-lg">
          Connection lost
        </div>
      )}

      {/* Score */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-black/45 px-4 py-1.5 font-mono text-sm font-bold text-white shadow">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">You</span>
        <span className="text-emerald-300">{state.score.wins}</span>
        <span className="text-white/40">–</span>
        <span className="text-red-300">{state.score.losses}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Opp</span>
      </div>

      {/* Your health */}
      <div className="absolute bottom-6 left-6 w-56 space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/70">You</div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-white/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-150"
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <div className="text-sm font-bold text-white">{Math.max(0, Math.round(state.hp))} HP</div>
      </div>

      {/* Damage counter */}
      <div className="absolute bottom-6 right-6 w-56 space-y-1 rounded-lg bg-black/40 p-3 text-right font-mono text-xs text-white/80">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Match damage</div>
        <div className="flex justify-between">
          <span className="text-white/60">Dealt</span>
          <span className="font-bold text-amber-300">{Math.round(state.damageDealt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Taken</span>
          <span className="font-bold text-red-300">{Math.round(state.damageTaken)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Hits</span>
          <span className="font-bold text-white">{state.hits}</span>
        </div>
      </div>

      {/* Weapon / ammo */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
        <div className="text-sm font-semibold text-white/80">{state.weapon?.name ?? ''}</div>
        {state.weapon && state.weapon.magSize > 0 && (
          <div className="text-2xl font-bold text-white">
            {state.reloading ? (
              <span className="text-amber-400">Reloading…</span>
            ) : (
              <>
                {state.ammo}
                <span className="text-base text-white/50"> / {state.magSize}</span>
              </>
            )}
          </div>
        )}
        {state.weapon && state.weapon.magSize === 0 && state.weapon.id === 'medkit' && (
          <div className="text-lg font-bold text-white">{state.medkitUsed ? 'Used' : 'Ready'}</div>
        )}
      </div>

      {/* Weapon slots */}
      <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-2">
        {state.slots.map((s) => (
          <div
            key={s.key}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold shadow ${
              s.active
                ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                : 'border-white/20 bg-black/40 text-white/60'
            } ${!s.weapon ? 'opacity-30' : ''}`}
          >
            <div className="text-[10px] uppercase tracking-wide">{s.label}</div>
            <div>{s.weapon?.name ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Movement status */}
      {(state.sliding || state.crouching) && (
        <div className="absolute bottom-24 right-6 rounded bg-black/50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-300">
          {state.sliding ? 'Sliding' : 'Crouching'}
        </div>
      )}

      {/* Speed readout — CS:GO style, bottom center */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[11px] text-white/50">
        {Math.round(state.speed)} u/s
      </div>
    </div>
  );
}
