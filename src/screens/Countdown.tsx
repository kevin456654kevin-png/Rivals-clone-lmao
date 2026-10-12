import { useEffect, useState } from 'react';
import { getMap } from '../data/maps';

export default function Countdown({ startAt, mapId, onDone }: { startAt: number; mapId: string; onDone: () => void }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((startAt - Date.now()) / 1000)));
  const map = getMap(mapId);

  useEffect(() => {
    const interval = setInterval(() => {
      const r = Math.max(0, Math.ceil((startAt - Date.now()) / 1000));
      setRemaining(r);
      if (Date.now() >= startAt) {
        clearInterval(interval);
        onDone();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [startAt, onDone]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6 text-white"
      style={{ background: `radial-gradient(circle at center, ${map.skyColor}, #000 140%)` }}
    >
      <div className="text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/50">Loading into</div>
        <div className="mt-2 text-3xl font-black">{map.name}</div>
        <div
          key={remaining}
          className="mt-10 text-9xl font-black text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]"
          style={{ animation: 'pulse-scale 1s ease-out' }}
        >
          {remaining > 0 ? remaining : 'GO'}
        </div>
      </div>
      <style>{`
        @keyframes pulse-scale {
          0% { transform: scale(1.4); opacity: 0.3; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
