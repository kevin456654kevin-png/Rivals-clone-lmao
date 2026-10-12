import { useState } from 'react';

export default function JoinScreen({
  onBack,
  onJoin,
  status,
  errorMsg,
}: {
  onBack: () => void;
  onJoin: (code: string) => void;
  status: 'idle' | 'joining' | 'error';
  errorMsg?: string;
}) {
  const [code, setCode] = useState('');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-white">
      <div className="w-full max-w-sm space-y-6">
        <button onClick={onBack} className="text-sm text-white/50 hover:text-white">
          ← Back
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-black">Join Room</h1>
          <p className="mt-1 text-sm text-white/50">Enter the 5-letter code from your opponent</p>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 5))}
          placeholder="ABCDE"
          className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-4 text-center text-3xl font-black tracking-[0.5em] text-amber-400 outline-none focus:border-amber-400"
          maxLength={5}
          autoFocus
        />
        {status === 'error' && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300">
            {errorMsg ?? 'Could not connect. Double-check the code.'}
          </div>
        )}
        <button
          disabled={code.length < 5 || status === 'joining'}
          onClick={() => onJoin(code)}
          className="w-full rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'joining' ? 'Connecting…' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}
