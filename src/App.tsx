import { useCallback, useRef, useState } from 'react';
import { Connection } from './net/Connection';
import type { Loadout, NetMessage, Role, RoomConfig } from './types';
import { getMap, MAPS } from './data/maps';
import MainMenu from './screens/MainMenu';
import HostSetup from './screens/HostSetup';
import JoinScreen from './screens/JoinScreen';
import LobbyRoom from './screens/LobbyRoom';
import Countdown from './screens/Countdown';
import LoadoutSelect from './screens/LoadoutSelect';
import GameCanvas from './game/GameCanvas';

type Stage = 'menu' | 'host-setup' | 'join' | 'lobby' | 'countdown' | 'loadout' | 'game' | 'gameover';

export default function App() {
  const [stage, setStage] = useState<Stage>('menu');
  const connRef = useRef<Connection | null>(null);
  const roleRef = useRef<Role>('host');
  const configRef = useRef<RoomConfig>({ mapId: MAPS[0].id, bannedWeapons: [] });
  const localLoadoutRef = useRef<Loadout | null>(null);
  const remoteLoadoutRef = useRef<Loadout | null>(null);
  const handlersAttached = useRef(false);

  const [roomCode, setRoomCode] = useState('');
  const [config, setConfig] = useState<RoomConfig>(configRef.current);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [hostStatus, setHostStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [joinError, setJoinError] = useState('');
  const [countdownStartAt, setCountdownStartAt] = useState<number>(Date.now());
  const [gameResult, setGameResult] = useState<'win' | 'lose' | 'disconnected' | null>(null);

  const checkBothLoadoutsReady = useCallback(() => {
    if (localLoadoutRef.current && remoteLoadoutRef.current) {
      setStage('game');
    }
  }, []);

  const getConn = useCallback(() => {
    if (!connRef.current) connRef.current = new Connection();
    return connRef.current;
  }, []);

  const attachHandlers = useCallback(
    (conn: Connection) => {
      if (handlersAttached.current) return;
      handlersAttached.current = true;
      conn.onOpen(() => {
        setOpponentConnected(true);
        if (roleRef.current === 'host') {
          conn.send({ type: 'config', config: configRef.current, hostName: 'Host' });
        }
      });
      conn.onClose(() => {
        setOpponentConnected(false);
      });
      conn.onMessage((msg: NetMessage) => {
        if (msg.type === 'config') {
          configRef.current = msg.config;
          setConfig(msg.config);
          setStage('lobby');
        } else if (msg.type === 'start-countdown') {
          setCountdownStartAt(msg.startAt);
          setStage('countdown');
        } else if (msg.type === 'loadout') {
          remoteLoadoutRef.current = msg.loadout;
          checkBothLoadoutsReady();
        }
      });
    },
    [checkBothLoadoutsReady],
  );

  function resetToMenu() {
    connRef.current?.destroy();
    connRef.current = null;
    handlersAttached.current = false;
    localLoadoutRef.current = null;
    remoteLoadoutRef.current = null;
    setOpponentConnected(false);
    setHostStatus('idle');
    setJoinStatus('idle');
    setJoinError('');
    setGameResult(null);
    setStage('menu');
  }

  // ---------- Menu ----------
  if (stage === 'menu') {
    return (
      <MainMenu
        onHost={() => {
          roleRef.current = 'host';
          const conn = getConn();
          attachHandlers(conn);
          setStage('host-setup');
        }}
        onJoin={() => {
          roleRef.current = 'client';
          const conn = getConn();
          attachHandlers(conn);
          setStage('join');
        }}
      />
    );
  }

  // ---------- Host setup ----------
  if (stage === 'host-setup') {
    return (
      <HostSetup
        status={hostStatus}
        onBack={resetToMenu}
        onCreate={(mapId, banned) => {
          setHostStatus('creating');
          const conn = getConn();
          conn
            .hostRoom()
            .then((code) => {
              configRef.current = { mapId, bannedWeapons: banned };
              setConfig(configRef.current);
              setRoomCode(code);
              setHostStatus('idle');
              setStage('lobby');
            })
            .catch(() => setHostStatus('error'));
        }}
      />
    );
  }

  // ---------- Join ----------
  if (stage === 'join') {
    return (
      <JoinScreen
        status={joinStatus}
        errorMsg={joinError}
        onBack={resetToMenu}
        onJoin={(code) => {
          setJoinStatus('joining');
          setJoinError('');
          const conn = getConn();
          conn
            .joinRoom(code)
            .then(() => {
              setRoomCode(conn.roomCode);
              setJoinStatus('idle');
              // stage transitions to 'lobby' once the 'config' message arrives
            })
            .catch((err: Error) => {
              setJoinStatus('error');
              setJoinError(err?.message || 'Could not connect. Double-check the code.');
            });
        }}
      />
    );
  }

  // ---------- Lobby ----------
  if (stage === 'lobby') {
    return (
      <LobbyRoom
        role={roleRef.current}
        roomCode={roomCode}
        config={config}
        opponentConnected={opponentConnected}
        onStart={() => {
          const startAt = Date.now() + 5000;
          getConn().send({ type: 'start-countdown', startAt });
          setCountdownStartAt(startAt);
          setStage('countdown');
        }}
      />
    );
  }

  // ---------- Countdown ----------
  if (stage === 'countdown') {
    return <Countdown startAt={countdownStartAt} mapId={config.mapId} onDone={() => setStage('loadout')} />;
  }

  // ---------- Loadout ----------
  if (stage === 'loadout') {
    return (
      <LoadoutSelect
        bannedWeapons={config.bannedWeapons}
        waitingOnOpponent={false}
        onConfirm={(loadout) => {
          localLoadoutRef.current = loadout;
          getConn().send({ type: 'loadout', loadout });
          checkBothLoadoutsReady();
        }}
      />
    );
  }

  // ---------- Game ----------
  if (stage === 'game' && localLoadoutRef.current) {
    return (
      <GameCanvas
        connection={getConn()}
        role={roleRef.current}
        map={getMap(config.mapId)}
        localLoadout={localLoadoutRef.current}
        onGameOver={(result) => {
          setGameResult(result);
          setStage('gameover');
        }}
      />
    );
  }

  // ---------- Game over ----------
  if (stage === 'gameover') {
    const title =
      gameResult === 'win' ? 'Victory!' : gameResult === 'lose' ? 'Defeat' : 'Opponent disconnected';
    const color = gameResult === 'win' ? 'text-emerald-400' : gameResult === 'lose' ? 'text-red-400' : 'text-amber-400';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 text-center text-white">
        <div className="text-7xl">{gameResult === 'win' ? '🏆' : gameResult === 'lose' ? '💀' : '🔌'}</div>
        <h1 className={`mt-4 text-5xl font-black ${color}`}>{title}</h1>
        <button
          onClick={resetToMenu}
          className="mt-10 rounded-xl bg-amber-500 px-8 py-4 text-lg font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400"
        >
          Back to Menu
        </button>
      </div>
    );
  }

  return null;
}
