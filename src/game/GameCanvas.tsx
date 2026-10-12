import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Connection } from '../net/Connection';
import type { GameResult, Loadout, MapDef, MatchStats, NetMessage, Role, WeaponDef } from '../types';
import { getWeapon } from '../data/weapons';
import { BASE_LOOK_SPEED, keyLabel, type ActionId, type Settings } from '../data/settings';
import { buildMap } from './mapBuilder';
import { ViewModel, inspectDurationMs } from './viewmodels';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { solidAt, groundHeight } from './collision';
import { createPhysicsState, MOVE, resolveGroundAndWalls, stepPhysics, type MoveInput } from './movement';
import { HUD, type HudState } from './HUD';
import SettingsPanel from '../screens/SettingsPanel';

export interface GameCanvasProps {
  connection: Connection;
  role: Role;
  map: MapDef;
  localLoadout: Loadout;
  settings: Settings;
  score: { wins: number; losses: number };
  onSettingsChange: (s: Settings) => void;
  onGameOver: (result: GameResult, stats: MatchStats) => void;
  onLeave: () => void;
}

interface WeaponRuntime {
  ammo: number;
  reloading: boolean;
  reloadEndsAt: number;
  lastFireAt: number;
}

const SLOT_KEYS: (keyof Loadout)[] = ['primary', 'secondary', 'melee', 'misc'];
const SLOT_LABELS: Record<keyof Loadout, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  melee: 'Melee',
  misc: 'Misc',
};
const SLOT_ACTIONS: ActionId[] = ['slot1', 'slot2', 'slot3', 'slot4'];

const GAME_CSS = `
@keyframes hitmarker {
  0% { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}
@keyframes dmgPop {
  0% { opacity: 1; transform: translate(-50%, 0); }
  65% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -38px); }
}
.damage-popup {
  position: absolute;
  top: 47%;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-weight: 900;
  font-size: 18px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  animation: dmgPop 0.8s ease-out forwards;
  pointer-events: none;
}
`;

/** Pre-match countdown length. Input stays frozen until it reaches zero. */
const COUNTDOWN_SECONDS = 3;

function controlsSummary(b: Settings['bindings']) {
  const k = (a: ActionId) => keyLabel(b[a]);
  return `${k('forward')}${k('left')}${k('back')}${k('right')} move · ${k('jump')} jump · ${k('crouch')} crouch · ${k('sprint')} sprint · ${k('fire')} fire · ${k('reload')} reload · ${k('inspect')} inspect · ${k('slot1')}–${k('slot4')} weapons · wheel switches`;
}

export default function GameCanvas(props: GameCanvasProps) {
  const { connection, role, map, localLoadout } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const dmgOverlayRef = useRef<HTMLDivElement>(null);

  // Latest props/settings for code running inside the long-lived effect
  const propsRef = useRef(props);
  propsRef.current = props;
  const settingsRef = useRef(props.settings);
  settingsRef.current = props.settings;
  const layoutRef = useRef<() => void>(() => {});

  const [captured, setCaptured] = useState(false);
  const everCaptured = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  // Pre-match countdown label ("3", "2", "1", "GO"); null once the overlay is dismissed
  const [countdownLabel, setCountdownLabel] = useState<string | null>(String(COUNTDOWN_SECONDS));
  const pauseVisible = everCaptured.current && !captured;
  // Movement and firing are suspended while a menu is on screen
  const menuOpenRef = useRef(false);
  menuOpenRef.current = pauseVisible || showSettings;
  // Input is frozen while the pre-match countdown runs (checked in the game loop)
  const countdownRef = useRef<{ endsAt: number; shown: string } | null>(null);

  const [hud, setHud] = useState<HudState>({
    hp: 100,
    ammo: 0,
    magSize: 0,
    reloading: false,
    weapon: undefined,
    slots: [],
    sliding: false,
    crouching: false,
    speed: 0,
    medkitStatus: 'ready',
    medkitProgress: 0,
    connectionLost: false,
    damageDealt: 0,
    damageTaken: 0,
    hits: 0,
    score: props.score,
  });

  useEffect(() => {
    layoutRef.current();
  }, [props.settings.aspectRatio]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ----- Scene setup -----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(map.skyColor);
    scene.fog = new THREE.Fog(new THREE.Color(map.skyColor), map.size * 0.35, map.size * 1.15);

    const camera = new THREE.PerspectiveCamera(settingsRef.current.fov, 1, 0.05, 500);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    mount.appendChild(canvas);

    // Fit the 3D view to the window, letterboxed to the chosen aspect ratio
    function layout() {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      const ratio = settingsRef.current.aspectRatio;
      let w = ww;
      let h = wh;
      if (ratio > 0) {
        if (ww / wh > ratio) w = Math.round(wh * ratio);
        else h = Math.round(ww / ratio);
      }
      renderer.setSize(w, h);
      canvas.style.left = `${Math.round((ww - w) / 2)}px`;
      canvas.style.top = `${Math.round((wh - h) / 2)}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    layoutRef.current = layout;
    layout();

    const hemi = new THREE.HemisphereLight('#ffffff', '#555566', 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e0', 1.1);
    sun.position.set(map.size * 0.3, map.size * 0.5, map.size * 0.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const d = map.size * 0.7;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    scene.add(sun);

    const built = buildMap(map);
    scene.add(built.group);
    const solids = built.solids;

    // ----- Spawns -----
    const localSpawn = role === 'host' ? map.spawnA : map.spawnB;
    const remoteSpawn = role === 'host' ? map.spawnB : map.spawnA;

    const physics = createPhysicsState(localSpawn);
    let yaw = Math.atan2(remoteSpawn[0] - localSpawn[0], -(remoteSpawn[2] - localSpawn[2]));
    let pitch = 0;

    // ----- Remote player mesh -----
    const remoteGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#d1495b', roughness: 0.6 });
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 1.1, 4, 8), bodyMat);
    capsule.position.y = 0.95;
    capsule.castShadow = true;
    capsule.userData.isRemotePlayer = true;
    remoteGroup.add(capsule);
    const gunMat = new THREE.MeshStandardMaterial({ color: '#222' });
    const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.6), gunMat);
    gunMesh.position.set(0.3, 1.1, 0.4);
    remoteGroup.add(gunMesh);
    remoteGroup.position.set(remoteSpawn[0], remoteSpawn[1], remoteSpawn[2]);
    scene.add(remoteGroup);
    const raycastTargets: THREE.Object3D[] = [
      ...built.group.children.filter((o) => !(o instanceof THREE.GridHelper)),
      capsule,
    ];

    // Opponent HP is deliberately not tracked or sent: you can't see their health.
    const remoteTarget = {
      pos: new THREE.Vector3(remoteSpawn[0], remoteSpawn[1], remoteSpawn[2]),
      rotY: yaw + Math.PI,
      moving: false,
      crouching: false,
    };
    let remoteAlive = true;

    // ----- Weapon viewmodel -----
    // Reflections for the metal parts of the viewmodel
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const viewModel = new ViewModel(camera, envMap);
    scene.add(camera);
    let vmBobX = 0;
    let vmBobY = 0;

    const flashLight = new THREE.PointLight('#ffddaa', 0, 6);
    camera.add(flashLight);

    // ----- Input -----
    // `keys` is indexed by KeyboardEvent.code, with mouse buttons as 'Mouse0'..'Mouse4'
    const keys: Record<string, boolean> = {};
    let localAlive = true;
    let gameEnded = false;
    let prevJumpKey = false;
    let prevCrouchKey = false;
    let crouchLatched = false;
    let firedSemiThisPress = false;
    // Inspect: a purely cosmetic animation that does not block movement
    let inspectStart = -1; // performance.now() when it began, -1 when idle
    let inspectId: string | null = null;
    // Medkit channel
    let healing = false;
    let healElapsedMs = 0;
    let healDurationMs = 4000;
    let medkitStatus: 'ready' | 'charging' | 'interrupted' | 'used' = 'ready';
    let medkitNeedsRelease = false; // after an interruption, fire must be released before healing again
    // Feel: recoil kick and melee swing
    let kick = 0;
    let swingAt = -1e9;

    const isDown = (a: ActionId) => !!keys[settingsRef.current.bindings[a]];
    const captured = () => document.pointerLockElement === canvas;

    function clearKeys() {
      for (const k of Object.keys(keys)) keys[k] = false;
    }

    function requestLock() {
      const p: unknown = canvas.requestPointerLock();
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
    }

    function onLockChange() {
      const isLocked = captured();
      if (isLocked) everCaptured.current = true;
      if (!isLocked) clearKeys();
      setCaptured(isLocked);
    }

    function onMouseMove(e: MouseEvent) {
      if (!captured()) return;
      const s = settingsRef.current;
      const k = BASE_LOOK_SPEED * s.sensitivity;
      yaw -= e.movementX * k;
      pitch -= e.movementY * k * (s.invertY ? -1 : 1);
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    }

    function onKeyDown(e: KeyboardEvent) {
      const b = settingsRef.current.bindings;
      if (Object.values(b).includes(e.code)) e.preventDefault(); // stop Space scrolling/clicking buttons
      keys[e.code] = true;
      if (e.repeat || menuOpenRef.current) return;
      if (e.code === b.reload) tryReload();
      if (e.code === b.inspect) startInspect();
      for (let i = 0; i < SLOT_ACTIONS.length; i++) {
        if (e.code === b[SLOT_ACTIONS[i]]) selectSlot(i);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys[e.code] = false;
    }
    function onMouseDown(e: MouseEvent) {
      if (!captured()) {
        // Non-blocking: the first click on the game simply captures the mouse
        if (e.target === canvas) requestLock();
        return;
      }
      keys[`Mouse${e.button}`] = true;
    }
    function onMouseUp(e: MouseEvent) {
      keys[`Mouse${e.button}`] = false;
    }
    function onWheel(e: WheelEvent) {
      if (!captured() || menuOpenRef.current) return;
      cycleSlot(e.deltaY > 0 ? 1 : -1);
    }
    function onContextMenu(e: Event) {
      if (captured()) e.preventDefault();
    }

    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', clearKeys);
    window.addEventListener('resize', layout);

    // ----- Loadout / weapon state -----
    const slotWeapons: (WeaponDef | undefined)[] = SLOT_KEYS.map((k) => getWeapon(localLoadout[k]));
    let currentSlotIdx = slotWeapons.findIndex((w) => !!w);
    if (currentSlotIdx < 0) currentSlotIdx = 0;
    const runtime: Record<string, WeaponRuntime> = {};
    for (const w of slotWeapons) {
      if (w) runtime[w.id] = { ammo: w.magSize, reloading: false, reloadEndsAt: 0, lastFireAt: -9999 };
    }
    let medkitUsed = false;
    let localHp = 100;

    const stats: MatchStats = { damageDealt: 0, damageTaken: 0, hits: 0 };

    function currentWeapon(): WeaponDef | undefined {
      return slotWeapons[currentSlotIdx];
    }

    function selectSlot(i: number) {
      if (healing || !slotWeapons[i]) return;
      if (i !== currentSlotIdx) cancelInspect();
      currentSlotIdx = i;
    }

    function startInspect() {
      if (healing || gameEnded || !localAlive) return;
      const w = currentWeapon();
      if (!w || w.id === 'medkit') return;
      inspectStart = performance.now();
      inspectId = w.id;
    }

    function cancelInspect() {
      inspectStart = -1;
    }

    function cycleSlot(dir: number) {
      if (healing) return;
      cancelInspect();
      const avail = [0, 1, 2, 3].filter((i) => slotWeapons[i]);
      if (avail.length === 0) return;
      const pos = avail.indexOf(currentSlotIdx);
      const next = pos < 0 ? avail[0] : avail[(pos + dir + avail.length) % avail.length];
      currentSlotIdx = next;
    }

    function tryReload() {
      const w = currentWeapon();
      if (!w || w.magSize <= 0 || healing) return;
      const rt = runtime[w.id];
      if (!rt || rt.reloading || rt.ammo >= w.magSize) return;
      cancelInspect();
      rt.reloading = true;
      rt.reloadEndsAt = performance.now() + w.reloadMs;
    }

    // ----- Feedback: hitmarker + damage numbers -----
    function confirmHit(damage: number) {
      stats.damageDealt += damage;
      stats.hits += 1;
      const hm = hitRef.current;
      if (hm) {
        hm.style.animation = 'none';
        void hm.offsetWidth;
        hm.style.animation = 'hitmarker 220ms ease-out';
      }
      const host = popupRef.current;
      if (host) {
        const el = document.createElement('div');
        el.className = 'damage-popup';
        el.textContent = String(Math.round(damage));
        el.style.left = `calc(50% + ${Math.round((Math.random() - 0.5) * 44)}px)`;
        el.addEventListener('animationend', () => el.remove());
        host.appendChild(el);
      }
    }

    // ----- Tracers & projectiles -----
    interface Tracer {
      mesh: THREE.Line;
      expires: number;
    }
    const tracers: Tracer[] = [];
    function spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: string) {
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      tracers.push({ mesh: line, expires: performance.now() + 90 });
    }

    interface Grenade {
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      bornAt: number;
      exploded: boolean;
    }
    const grenades: Grenade[] = [];
    function spawnExplosionVisual(pos: THREE.Vector3) {
      const geo = new THREE.SphereGeometry(0.4, 10, 10);
      const mat = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      const start = performance.now();
      const anim = () => {
        const t = (performance.now() - start) / 350;
        if (t >= 1) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mat.dispose();
          return;
        }
        const scale = 1 + t * 10;
        mesh.scale.setScalar(scale);
        mat.opacity = 0.85 * (1 - t);
        requestAnimationFrame(anim);
      };
      anim();
    }

    function throwGrenade() {
      const w = getWeapon('grenade');
      if (!w) return;
      const rt = runtime['grenade'];
      if (!rt || rt.ammo <= 0) return;
      if (performance.now() - rt.lastFireAt < w.fireRateMs) return;
      rt.ammo -= 1;
      rt.lastFireAt = performance.now();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = camera.position.clone().addScaledVector(dir, 0.6);
      const vel = dir.clone().multiplyScalar(w.projectileSpeed ?? 16);
      vel.y += 4;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshStandardMaterial({ color: '#2f4f2f' }),
      );
      mesh.position.copy(origin);
      scene.add(mesh);
      grenades.push({ mesh, vel, bornAt: performance.now(), exploded: false });
    }

    /** Bounce a grenade off walls, ramps, platforms and the floor. */
    function bounceGrenade(g: Grenade, prev: THREE.Vector3) {
      const p = g.mesh.position;
      if (solidAt(solids, p.x, p.y, p.z)) {
        const blockedX = solidAt(solids, p.x, prev.y, prev.z);
        const blockedZ = solidAt(solids, prev.x, prev.y, p.z);
        if (blockedX) {
          p.x = prev.x;
          g.vel.x *= -0.4;
        }
        if (blockedZ) {
          p.z = prev.z;
          g.vel.z *= -0.4;
        }
      }
      const ground = groundHeight(solids, p.x, p.z, p.y);
      if (p.y <= ground + 0.12 && g.vel.y <= 0) {
        p.y = ground + 0.12;
        g.vel.y = Math.abs(g.vel.y) * 0.35;
        g.vel.x *= 0.7;
        g.vel.z *= 0.7;
      }
    }

    function explodeGrenade(g: Grenade) {
      g.exploded = true;
      scene.remove(g.mesh);
      g.mesh.geometry.dispose();
      (g.mesh.material as THREE.Material).dispose();
      spawnExplosionVisual(g.mesh.position);
      connection.send({ type: 'explosion', pos: [g.mesh.position.x, g.mesh.position.y, g.mesh.position.z] });
      const radius = 6.5;
      const distToRemote = g.mesh.position.distanceTo(
        new THREE.Vector3(remoteTarget.pos.x, remoteTarget.pos.y + 1, remoteTarget.pos.z),
      );
      if (distToRemote < radius && remoteAlive) {
        const dmg = Math.round(90 * (1 - distToRemote / radius));
        if (dmg > 0) {
          connection.send({ type: 'hit', damage: dmg, byShotId: 'nade-' + Math.random() });
          confirmHit(dmg);
        }
      }
    }

    // The medkit is a channel: hold it for `channelMs`. Any hit cancels it, and a
    // cancelled channel is not consumed.
    function startMedkit(w: WeaponDef) {
      if (medkitUsed || healing || medkitNeedsRelease) return;
      healing = true;
      healElapsedMs = 0;
      healDurationMs = w.channelMs ?? 4000;
      medkitStatus = 'charging';
      cancelInspect();
    }

    function cancelHeal() {
      if (!healing) return;
      healing = false;
      healElapsedMs = 0;
      medkitStatus = 'interrupted';
      medkitNeedsRelease = true;
    }

    function finishHeal() {
      healing = false;
      medkitUsed = true;
      medkitStatus = 'used';
      localHp = Math.min(100, localHp + 50);
    }

    function meleeAttack() {
      const w = currentWeapon();
      if (!w) return;
      const rt = runtime[w.id];
      if (rt && performance.now() - rt.lastFireAt < w.fireRateMs) return;
      if (rt) rt.lastFireAt = performance.now();
      swingAt = performance.now();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      raycaster.set(camera.position, dir);
      raycaster.far = w.range;
      const hits = raycaster.intersectObjects(raycastTargets, false);
      spawnTracer(camera.position.clone(), camera.position.clone().addScaledVector(dir, w.range * 0.3), '#ffffff');
      if (hits.length > 0 && hits[0].object.userData.isRemotePlayer && remoteAlive) {
        connection.send({ type: 'hit', damage: w.damage, byShotId: 'melee-' + Math.random() });
        confirmHit(w.damage);
      }
    }

    function fireGun(w: WeaponDef) {
      kick = Math.min(kick + 1, 2);
      const rt = runtime[w.id];
      if (!rt || rt.reloading) return;
      if (performance.now() - rt.lastFireAt < w.fireRateMs) return;
      if (rt.ammo <= 0) {
        tryReload();
        return;
      }
      rt.ammo -= 1;
      rt.lastFireAt = performance.now();
      flashLight.intensity = 3.5;

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const origin = camera.position.clone();
      connection.send({
        type: 'shoot',
        weaponId: w.id,
        origin: [origin.x, origin.y, origin.z],
        dir: [dir.x, dir.y, dir.z],
        id: Math.random().toString(36).slice(2),
      });

      // All pellets of one shot are combined into a single hit confirmation
      let shotDamage = 0;
      const pellets = w.pellets ?? 1;
      for (let i = 0; i < pellets; i++) {
        const spread = w.spread ?? 0;
        const spreadDir = dir
          .clone()
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * spread)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * spread);
        raycaster.set(origin, spreadDir);
        raycaster.far = w.range;
        const hits = raycaster.intersectObjects(raycastTargets, false);
        if (hits.length > 0) {
          const hit = hits[0];
          spawnTracer(origin, hit.point, '#ffe08a');
          if (hit.object.userData.isRemotePlayer && remoteAlive) {
            connection.send({ type: 'hit', damage: w.damage, byShotId: 'gun-' + Math.random() });
            shotDamage += w.damage;
          }
        } else {
          spawnTracer(origin, origin.clone().addScaledVector(spreadDir, w.range), '#ffe08a');
        }
      }
      if (shotDamage > 0) confirmHit(shotDamage);
      if (rt.ammo <= 0) tryReload();
    }

    function handleFireInput(fireHeld: boolean) {
      const w = currentWeapon();
      if (!w || !fireHeld || gameEnded || !localAlive || healing) return;
      cancelInspect();
      if (w.category === 'melee') {
        meleeAttack();
      } else if (w.id === 'grenade') {
        throwGrenade();
      } else if (w.id === 'medkit') {
        startMedkit(w);
      } else if (w.magSize > 0) {
        if (w.automatic) {
          fireGun(w);
        } else if (!firedSemiThisPress) {
          fireGun(w);
          firedSemiThisPress = true;
        }
      }
    }

    const raycaster = new THREE.Raycaster();

    // ----- Networking -----
    const endMatch = (result: GameResult) => {
      gameEnded = true;
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      propsRef.current.onGameOver(result, { ...stats });
    };

    const unsub = connection.onMessage((msg: NetMessage) => {
      if (msg.type === 'player-state') {
        remoteTarget.pos.set(msg.pos[0], msg.pos[1], msg.pos[2]);
        remoteTarget.rotY = msg.rotY;
        remoteTarget.moving = msg.moving;
        remoteTarget.crouching = msg.crouching;
      } else if (msg.type === 'shoot') {
        const origin = new THREE.Vector3(...msg.origin);
        const dir = new THREE.Vector3(...msg.dir);
        const w = getWeapon(msg.weaponId);
        spawnTracer(origin, origin.clone().addScaledVector(dir, w?.range ?? 40), '#ff8c69');
      } else if (msg.type === 'hit') {
        if (!localAlive) return;
        cancelHeal();
        stats.damageTaken += Math.min(msg.damage, localHp);
        localHp -= msg.damage;
        flashDamage();
        if (localHp <= 0 && !gameEnded) {
          localHp = 0;
          localAlive = false;
          connection.send({ type: 'death' });
          endMatch('lose');
        }
      } else if (msg.type === 'death') {
        if (!gameEnded) {
          remoteAlive = false;
          endMatch('win');
        }
      } else if (msg.type === 'explosion') {
        spawnExplosionVisual(new THREE.Vector3(...msg.pos));
      }
    });
    const unsubClose = connection.onClose(() => {
      if (!gameEnded) {
        gameEnded = true;
        propsRef.current.onGameOver('disconnected', { ...stats });
      }
    });

    let dmgFlashUntil = 0;
    function flashDamage() {
      dmgFlashUntil = performance.now() + 220;
    }

    // ----- Main loop -----
    let lastTime = performance.now();
    countdownRef.current = { endsAt: lastTime + COUNTDOWN_SECONDS * 1000, shown: String(COUNTDOWN_SECONDS) };
    let lastNetSend = 0;
    let lastHudUpdate = 0;
    let rafId = 0;
    let crouchWanted = false;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      let dt = (now - lastTime) / 1000;
      dt = Math.min(dt, 0.05);
      lastTime = now;

      const s = settingsRef.current;
      if (camera.fov !== s.fov) {
        camera.fov = s.fov;
        camera.updateProjectionMatrix();
      }

      const cd = countdownRef.current;
      let counting = false;
      if (cd) {
        const remaining = cd.endsAt - now;
        counting = remaining > 0;
        const label = counting ? String(Math.ceil(remaining / 1000)) : 'GO';
        if (label !== cd.shown) {
          cd.shown = label;
          setCountdownLabel(label);
          if (label === 'GO') window.setTimeout(() => setCountdownLabel(null), 700);
        }
      }

      const menuOpen = menuOpenRef.current || counting;

      if (!gameEnded && localAlive) {
        // Crouch: hold, or toggle on each press
        const crouchDown = !menuOpen && isDown('crouch');
        if (s.toggleCrouch) {
          if (crouchDown && !prevCrouchKey) crouchLatched = !crouchLatched;
          crouchWanted = crouchLatched && !menuOpen;
        } else {
          crouchWanted = crouchDown;
        }
        prevCrouchKey = crouchDown;

        const jumpDown = !menuOpen && isDown('jump');
        const input: MoveInput = {
          forward: menuOpen ? 0 : (isDown('forward') ? 1 : 0) - (isDown('back') ? 1 : 0),
          right: menuOpen ? 0 : (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0),
          sprint: !menuOpen && isDown('sprint'),
          crouch: crouchWanted,
          jumpPressed: jumpDown && !prevJumpKey,
          yaw,
        };
        prevJumpKey = jumpDown;
        stepPhysics(physics, input, dt);
        resolveGroundAndWalls(physics, solids, map.size);

        camera.position.set(physics.position.x, physics.position.y + physics.height - 0.08, physics.position.z);
        camera.rotation.y = yaw;
        camera.rotation.x = pitch;

        // weapon bob
        const horizSpeed = Math.hypot(physics.velocity.x, physics.velocity.z);
        const bobT = now * 0.012;
        const bobAmount = Math.min(horizSpeed / MOVE.sprintSpeed, 1.3);
        vmBobY = Math.sin(bobT) * 0.012 * bobAmount;
        vmBobX = Math.cos(bobT * 0.5) * 0.008 * bobAmount;

        const fireHeld = !menuOpen && isDown('fire');
        if (!fireHeld) {
          firedSemiThisPress = false;
          medkitNeedsRelease = false;
        }
        handleFireInput(fireHeld);
        if (healing && !menuOpen) {
          healElapsedMs += dt * 1000;
          if (healElapsedMs >= healDurationMs) finishHeal();
        }

        // reload completion
        const w = currentWeapon();
        if (w) {
          const rt = runtime[w.id];
          if (rt && rt.reloading && now >= rt.reloadEndsAt) {
            rt.reloading = false;
            rt.ammo = w.magSize;
          }
        }

        if (flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 18);

        // Network send
        if (now - lastNetSend > 50) {
          lastNetSend = now;
          connection.send({
            type: 'player-state',
            pos: [physics.position.x, physics.position.y, physics.position.z],
            rotY: yaw,
            pitch,
            moving: horizSpeed > 0.5,
            crouching: physics.crouching || physics.sliding,
          });
        }
      }

      // grenades physics
      for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        if (g.exploded) {
          grenades.splice(i, 1);
          continue;
        }
        g.vel.y -= MOVE.gravity * dt;
        const prev = g.mesh.position.clone();
        g.mesh.position.addScaledVector(g.vel, dt);
        bounceGrenade(g, prev);
        if (now - g.bornAt > 1600) {
          explodeGrenade(g);
        }
      }

      // tracers cleanup
      for (let i = tracers.length - 1; i >= 0; i--) {
        if (now > tracers[i].expires) {
          scene.remove(tracers[i].mesh);
          tracers[i].mesh.geometry.dispose();
          (tracers[i].mesh.material as THREE.Material).dispose();
          tracers.splice(i, 1);
        }
      }

      // remote interpolation
      const alpha = 1 - Math.exp(-14 * dt);
      remoteGroup.position.lerp(remoteTarget.pos, alpha);
      let dAngle = remoteTarget.rotY - remoteGroup.rotation.y;
      dAngle = Math.atan2(Math.sin(dAngle), Math.cos(dAngle));
      remoteGroup.rotation.y += dAngle * alpha;
      capsule.scale.y = remoteTarget.crouching ? 0.65 : 1;
      capsule.position.y = remoteTarget.crouching ? 0.75 : 0.95;
      remoteGroup.visible = remoteAlive;

      // Weapon viewmodel
      const held = currentWeapon();
      viewModel.show(held?.id ?? null, held?.color ?? '#444444', now);
      if (inspectStart >= 0 && now - inspectStart >= inspectDurationMs(inspectId ?? '')) inspectStart = -1;
      kick *= Math.exp(-14 * dt);
      viewModel.update(now, dt, {
        bobX: vmBobX,
        bobY: vmBobY,
        inspectId,
        inspectT: inspectStart >= 0 ? (now - inspectStart) / inspectDurationMs(inspectId ?? '') : null,
        healing,
        kick,
        swing: (now - swingAt) / 260,
      });

      renderer.render(scene, camera);

      if (dmgOverlayRef.current) {
        const remaining = dmgFlashUntil - now;
        dmgOverlayRef.current.style.opacity = remaining > 0 ? String(Math.min(0.45, remaining / 220) * 0.45 * 2) : '0';
      }

      if (now - lastHudUpdate > 100) {
        lastHudUpdate = now;
        const w = currentWeapon();
        const rt = w ? runtime[w.id] : undefined;
        setHud({
          hp: localHp,
          ammo: rt?.ammo ?? 0,
          magSize: w?.magSize ?? 0,
          reloading: !!rt?.reloading,
          weapon: w,
          slots: SLOT_KEYS.map((k, i) => ({
            key: k,
            label: SLOT_LABELS[k],
            weapon: slotWeapons[i],
            active: i === currentSlotIdx,
          })),
          sliding: physics.sliding,
          crouching: physics.crouching && !physics.sliding,
          speed: Math.hypot(physics.velocity.x, physics.velocity.z),
          medkitStatus,
          medkitProgress: healing ? Math.min(1, healElapsedMs / healDurationMs) : 0,
          connectionLost: !connection.isConnected(),
          damageDealt: stats.damageDealt,
          damageTaken: stats.damageTaken,
          hits: stats.hits,
          score: propsRef.current.score,
        });
      }
    }
    animate();

    // Try to capture the mouse straight away. Browsers may refuse without a click,
    // in which case the first click on the game captures it.
    requestLock();

    return () => {
      // Unmounting means we've left the match: ignore any late close/death events
      gameEnded = true;
      cancelAnimationFrame(rafId);
      unsub();
      unsubClose();
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', clearKeys);
      window.removeEventListener('resize', layout);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      mount.removeChild(canvas);
      viewModel.dispose();
      envMap.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bindings = props.settings.bindings;
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <style>{GAME_CSS}</style>
      <div ref={mountRef} className="absolute inset-0" />
      <div
        ref={dmgOverlayRef}
        className="pointer-events-none absolute inset-0 bg-red-600 opacity-0"
        style={{ boxShadow: 'inset 0 0 180px 60px rgba(220,38,38,0.6)' }}
      />

      {/* Hitmarker */}
      <div
        ref={hitRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 opacity-0"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {[45, 135, 225, 315].map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 h-2.5 w-0.5 rounded bg-white shadow"
            style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-8px)` }}
          />
        ))}
      </div>
      {/* Floating damage numbers are appended here imperatively */}
      <div ref={popupRef} className="pointer-events-none absolute inset-0" />

      {countdownLabel !== null && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            key={countdownLabel}
            className="select-none text-8xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            style={{ animation: 'countdown-pop 0.9s ease-out both' }}
          >
            {countdownLabel}
          </span>
          <style>{`@keyframes countdown-pop { 0% { transform: scale(1.6); opacity: 0 } 25% { transform: scale(1); opacity: 1 } 100% { transform: scale(0.9); opacity: 0.2 } }`}</style>
        </div>
      )}

      <HUD state={hud} />

      {!captured && !everCaptured.current && !showSettings && (
        <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold text-white/80">
          Click the game to capture the mouse
        </div>
      )}

      {pauseVisible && !showSettings && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="w-80 space-y-3 rounded-xl border border-white/10 bg-slate-900/95 p-6 text-center text-white shadow-2xl">
            <h2 className="text-xl font-bold">Mouse released</h2>
            <p className="text-xs text-white/50">
              The match is still running — your opponent can still hit you.
            </p>
            <button
              onClick={() => {
                // A click is a user gesture, so pointer lock is allowed here
                const c = mountRef.current?.querySelector('canvas');
                if (!c) return;
                const p: unknown = c.requestPointerLock();
                if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
              }}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-bold text-black transition hover:bg-amber-400"
            >
              Resume
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 font-semibold transition hover:bg-white/10"
            >
              Settings
            </button>
            <button
              onClick={() => props.onLeave()}
              className="w-full rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
            >
              Leave match (forfeit)
            </button>
            <p className="pt-1 text-[11px] leading-relaxed text-white/40">{controlsSummary(bindings)}</p>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-slate-950/95">
          <SettingsPanel
            settings={props.settings}
            onChange={props.onSettingsChange}
            onBack={() => setShowSettings(false)}
          />
        </div>
      )}
    </div>
  );
}
