import type { GameResult, MatchStats } from '../types';

interface Props {
  result: GameResult;
  stats: MatchStats;
  score: { wins: number; losses: number };
  rematchLocal: boolean;
  rematchRemote: boolean;
  onRematch: () => void;
  onChangeLoadout: () => void;
  onMenu: () => void;
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{label}</div>
      <div className={`text-2xl font-black ${tone}`}>{Math.round(value)}</div>
    </div>
  );
}

export default function GameOver({
  result,
  stats,
  score,
  rematchLocal,
  rematchRemote,
  onRematch,
  onChangeLoadout,
  onMenu,
}: Props) {
  const title = result === 'win' ? 'Victory!' : result === 'lose' ? 'Defeat' : 'Opponent disconnected';
  const color = result === 'win' ? 'text-emerald-400' : result === 'lose' ? 'text-red-400' : 'text-amber-400';
  const canRematch = result !== 'disconnected';

  let rematchLabel = 'Rematch';
  if (rematchLocal) rematchLabel = 'Waiting for opponent…';
  else if (rematchRemote) rematchLabel = 'Accept rematch';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-center text-white">
      <div className="text-7xl">{result === 'win' ? '🏆' : result === 'lose' ? '💀' : '🔌'}</div>
      <h1 className={`mt-4 text-5xl font-black ${color}`}>{title}</h1>

      <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-black/30 px-6 py-3 font-mono text-lg font-bold">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">You</span>
        <span className="text-emerald-300">{score.wins}</span>
        <span className="text-white/40">–</span>
        <span className="text-red-300">{score.losses}</span>
        <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Opponent</span>
      </div>

      <div className="mt-4 grid w-full max-w-md grid-cols-3 gap-3">
        <StatTile label="Damage dealt" value={stats.damageDealt} tone="text-amber-300" />
        <StatTile label="Damage taken" value={stats.damageTaken} tone="text-red-300" />
        <StatTile label="Hits" value={stats.hits} tone="text-white" />
      </div>

      {canRematch && rematchRemote && !rematchLocal && (
        <p className="mt-6 text-sm font-semibold text-amber-300">Your opponent wants a rematch</p>
      )}

      <div className="mt-8 flex w-full max-w-md flex-col gap-3">
        {canRematch && (
          <button
            onClick={onRematch}
            disabled={rematchLocal}
            className="w-full rounded-xl bg-amber-500 px-8 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rematchLabel}
          </button>
        )}
        {canRematch && (
          <button
            onClick={onChangeLoadout}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-8 py-3 font-bold text-white transition hover:bg-white/10"
          >
            Change loadout &amp; rematch
          </button>
        )}
        <button
          onClick={onMenu}
          className="w-full rounded-xl border border-white/10 px-8 py-3 font-semibold text-white/70 transition hover:bg-white/5"
        >
          Back to Menu
        </button>
      </div>
    </div>
  );
}
