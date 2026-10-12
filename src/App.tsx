import { useCallback, useRef, useState } from 'react';
import { Connection } from './net/Connection';
import type { GameResult, Loadout, MatchStats, NetMessage, Role, RoomConfig } from './types';
import { getMap, MAPS } from './data/maps';
import { loadSettings, saveSettings, type Settings } from './data/settings';
import MainMenu from './screens/MainMenu';
import HostSetup from './screens/HostSetup';
import JoinScreen from './screens/JoinScreen';
import LobbyRoom from './screens/LobbyRoom';
import LoadoutSelect from './screens/LoadoutSelect';
import GameOver from './screens/GameOver';
import SettingsPanel from './screens/SettingsPanel';
import GameCanvas from './game/GameCanvas';

type Stage = 'menu' | 'settings' | 'host-setup' | 'join' | 'lobby' | 'loadout' | 'game' | 'gameover';

const EMPTY_STATS: MatchStats = { damageDealt: 0, damageTaken: 0, hits: 0 };

export default function App() {
  const [stage, setStageState] = useState<Stage>('menu');
  // Mirrors `stage` for use inside network callbacks that outlive a render
  const stageRef = useRef<Stage>('menu');
  const setStage = useCallback((s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  }, []);

  const connRef = useRef<Connection | null>(null);
  const roleRef = useRef<Role>('host');
  const configRef = useRef<RoomConfig>({ mapId: MAPS[0].id, bannedWeapons: [] });
  const localLoadoutRef = useRef<Loadout | null>(null);
  const remoteLoadoutRef = useRef<Loadout | null>(null);
  const rematchLocalRef = useRef(false);
  const rematchRemoteRef = useRef(false);
  const handlersAttached = useRef(false);

  const [roomCode, setRoomCode] = useState('');
  const [config, setConfig] = useState<RoomConfig>(configRef.current);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [hostStatus, setHostStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [joinError, setJoinError] = useState('');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [gameStats, setGameStats] = useState<MatchStats>(EMPTY_STATS);
  const [score, setScore] = useState({ wins: 0, losses: 0 });
  const [rematchLocal, setRematchLocal] = useState(false);
  const [rematchRemote, setRematchRemote] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  function updateSettings(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  const getConn = useCallback(() => {
    if (!connRef.current) connRef.current = new Connection();
    return connRef.current;
  }, []);

  /** Clear loadouts and rematch flags, then go to loadout selection. */
  const enterLoadout = useCallback(() => {
    localLoadoutRef.current = null;
    remoteLoadoutRef.current = null;
    rematchLocalRef.current = false;
    rematchRemoteRef.current = false;
    setRematchLocal(false);
    setRematchRemote(false);
    setStage('loadout');
  }, [setStage]);

  /** Both players have locked in: the match starts immediately. */
  const beginMatch = useCallback(() => {
    rematchLocalRef.current = false;
    rematchRemoteRef.current = false;
    setRematchLocal(false);
    setRematchRemote(false);
    setStage('game');
  }, [setStage]);

  const checkBothLoadoutsReady = useCallback(() => {
    if (stageRef.current !== 'loadout') return;
    if (localLoadoutRef.current && remoteLoadoutRef.current) beginMatch();
  }, [beginMatch]);

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
        const inMatchOrOver = stageRef.current === 'game' || stageRef.current === 'gameover';
        if (msg.type === 'config') {
          configRef.current = msg.config;
          setConfig(msg.config);
          setStage('lobby');
        } else if (msg.type === 'start-match') {
          enterLoadout();
        } else if (msg.type === 'loadout') {
          remoteLoadoutRef.current = msg.loadout;
          checkBothLoadoutsReady();
        } else if (msg.type === 'rematch-request') {
          if (!inMatchOrOver) return;
          rematchRemoteRef.current = true;
          setRematchRemote(true);
          if (rematchLocalRef.current) beginMatch();
        } else if (msg.type === 'rematch-loadout') {
          if (inMatchOrOver) enterLoadout();
        }
      });
    },
    [beginMatch, checkBothLoadoutsReady, enterLoadout, setStage],
  );

  function requestRematch() {
    if (rematchLocalRef.current) return;
    rematchLocalRef.current = true;
    setRematchLocal(true);
    getConn().send({ type: 'rematch-request' });
    if (rematchRemoteRef.current) beginMatch();
  }

  function requestLoadoutChange() {
    getConn().send({ type: 'rematch-loadout' });
    enterLoadout();
  }

  function handleGameOver(result: GameResult, stats: MatchStats) {
    setGameResult(result);
    setGameStats(stats);
    if (result === 'win') setScore((p) => ({ ...p, wins: p.wins + 1 }));
    else if (result === 'lose') setScore((p) => ({ ...p, losses: p.losses + 1 }));
    setStage('gameover');
  }

  function resetToMenu() {
    connRef.current?.destroy();
    connRef.current = null;
    handlersAttached.current = false;
    localLoadoutRef.current = null;
    remoteLoadoutRef.current = null;
    rematchLocalRef.current = false;
    rematchRemoteRef.current = false;
    setRematchLocal(false);
    setRematchRemote(false);
    setOpponentConnected(false);
    setHostStatus('idle');
    setJoinStatus('idle');
    setJoinError('');
    setGameResult(null);
    setScore({ wins: 0, losses: 0 });
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
        onSettings={() => setStage('settings')}
      />
    );
  }

  // ---------- Settings ----------
  if (stage === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
        <SettingsPanel settings={settings} onChange={updateSettings} onBack={() => setStage('menu')} />
      </div>
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
          getConn().send({ type: 'start-match' });
          enterLoadout();
        }}
      />
    );
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
        settings={settings}
        score={score}
        onSettingsChange={updateSettings}
        onGameOver={handleGameOver}
        onLeave={resetToMenu}
      />
    );
  }

  // ---------- Game over ----------
  if (stage === 'gameover') {
    return (
      <GameOver
        result={gameResult ?? 'disconnected'}
        stats={gameStats}
        score={score}
        rematchLocal={rematchLocal}
        rematchRemote={rematchRemote}
        onRematch={requestRematch}
        onChangeLoadout={requestLoadoutChange}
        onMenu={resetToMenu}
      />
    );
  }

  return null;
}
