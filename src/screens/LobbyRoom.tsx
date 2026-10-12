import { getMap } from '../data/maps';
import { WEAPONS } from '../data/weapons';
import type { Role, RoomConfig } from '../types';

export default function LobbyRoom({
  role,
  roomCode,
  config,
  opponentConnected,
  onStart,
}: {
  role: Role;
  roomCode: string;
  config: RoomConfig;
  opponentConnected: boolean;
  onStart: () => void;
}) {
  const map = getMap(config.mapId);
  const bannedNames = config.bannedWeapons.map((id) => WEAPONS.find((w) => w.id === id)?.name ?? id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-white">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-black">Lobby</h1>
          <p className="mt-1 text-sm text-white/50">
            {role === 'host' ? 'Share this code with your opponent' : 'Waiting for the host to start the match'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/70">Room Code</div>
          <div className="mt-1 text-5xl font-black tracking-[0.3em] text-amber-300">{roomCode}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <div>
              <div className="text-sm font-bold">You</div>
              <div className="text-xs text-white/50">Connected</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className={`h-3 w-3 rounded-full ${opponentConnected ? 'bg-emerald-400' : 'bg-white/20 animate-pulse'}`} />
            <div>
              <div className="text-sm font-bold">Opponent</div>
              <div className="text-xs text-white/50">{opponentConnected ? 'Connected' : 'Waiting…'}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Map</span>
            <span className="font-bold">{map.name}</span>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-white/50">Banned weapons</span>
            <div className="mt-1 text-sm">
              {bannedNames.length > 0 ? (
                <span className="text-red-300">{bannedNames.join(', ')}</span>
              ) : (
                <span className="text-white/40">None</span>
              )}
            </div>
          </div>
        </div>

        {role === 'host' ? (
          <button
            disabled={!opponentConnected}
            onClick={onStart}
            className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {opponentConnected ? 'Start Match' : 'Waiting for opponent…'}
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-center text-white/60">
            {opponentConnected ? 'Waiting for host to start the match…' : 'Connecting…'}
          </div>
        )}
      </div>
    </div>
  );
}
