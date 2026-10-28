export default function MainMenu({
  onHost,
  onJoin,
  onPractice,
  onSettings,
}: {
  onHost: () => void;
  onJoin: () => void;
  onPractice: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-8 text-white">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-red-500 shadow-lg shadow-red-500/30">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">DUEL ARENA</h1>
          <p className="mt-2 text-sm text-white/50">A free, peer-to-peer 1v1 browser shooter</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={onHost}
            className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[0.98]"
          >
            Create Room
          </button>
          <button
            onClick={onJoin}
            className="w-full rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-lg font-bold text-white transition hover:bg-white/10 active:scale-[0.98]"
          >
            Join Room
          </button>
          <button
            onClick={onPractice}
            className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-3.5 text-lg font-bold text-emerald-200 transition hover:bg-emerald-500/20 active:scale-[0.98]"
          >
            Practice Range
            <span className="ml-2 text-xs font-semibold text-emerald-300/60">offline · bots + targets</span>
          </button>
          <button
            onClick={onSettings}
            className="w-full rounded-xl border border-white/10 px-6 py-3 font-semibold text-white/70 transition hover:bg-white/5 active:scale-[0.98]"
          >
            Settings
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-left text-xs leading-relaxed text-white/50">
          <p className="mb-1 font-semibold text-white/70">How it works</p>
          Host picks a map and bans weapons, then shares a 5-letter room code. Your opponent joins with
          that code — no servers, no sign-up, connection is made directly browser-to-browser. Matches start
          the moment both players lock in, and you can rematch straight from the results screen.
        </div>

        <a
          href="#/resultaat-generator"
          className="block text-center text-xs text-white/30 underline-offset-2 transition hover:text-white/60 hover:underline"
        >
          TypelesOnline resultaat-generator
        </a>
      </div>
    </div>
  );
}
