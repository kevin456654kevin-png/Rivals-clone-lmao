/**
 * Runtime check for the practice-range additions. Bundled with esbuild and run
 * under node, so it executes the real modules (not copies of their logic).
 */
import { TargetRange } from '../src/game/targets';
import { BotSquad, BOT_MAX_HP } from '../src/game/bots';
import {
  scopeMagnification,
  scopedFov,
  scopeLookScale,
  loadSettings,
  DEFAULT_SETTINGS,
  DEFAULT_BINDINGS,
} from '../src/data/settings';
import { computeViewLayout } from '../src/game/viewLayout';
import { getMap, MAPS } from '../src/data/maps';
import { getWeapon, WEAPONS } from '../src/data/weapons';
import { buildMap } from '../src/game/mapBuilder';
import { solidAt } from '../src/game/collision';
import { audio } from '../src/game/audio';
import * as THREE from 'three';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// ---------- 1. maps ----------
const ids = MAPS.map((m) => m.id);
check('maps include range + empty', ids.includes('range') && ids.includes('empty'), ids.join(', '));
const empty = getMap('empty');
check('empty map has no solids', empty.solids.length === 0, `solids=${empty.solids.length}`);
const range = getMap('range');
check('range map is bigger than the duel maps', range.size === 120, `size=${range.size}`);

// ---------- 2. targets sit in clear space on the range map ----------
const built = buildMap(range);
const tr = new TargetRange({ moving: true });
const plates = tr.raycastTargets();
check('target range exposes plate + bullseye meshes', plates.length === tr.count * 2, `${plates.length} meshes / ${tr.count} plates`);
let blocked = 0;
for (const mesh of plates) {
  mesh.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  mesh.getWorldPosition(p);
  if (solidAt(built.solids, p.x, p.y, p.z)) blocked++;
}
check('no target plate is embedded in range geometry', blocked === 0, `${blocked} blocked`);

// ---------- 3. target hit scoring, knock-down and reset ----------
// raycastTargets() emits [plate, bullseye] per target, so target N is at 2N / 2N+1
const plate0 = plates[0];
const bull1 = plates[3];
const now = 1000;
const plateHit = tr.hitTest(plate0, now);
check('plate hit scores 1 point', plateHit?.points === 1 && plateHit.bullseye === false, JSON.stringify(plateHit));
check('plate hit hides the plate', plate0.parent!.visible === false);
check('downed plate leaves layer 0 (no phantom hits)', plate0.layers.test(new THREE.Layers()) === false);
check('re-hitting a downed plate does nothing', tr.hitTest(plate0, now + 10) === null);
const bullHit = tr.hitTest(bull1, now);
check('bullseye scores 2 points', bullHit?.points === 2 && bullHit.bullseye === true, JSON.stringify(bullHit));
check('hit counters', tr.hits === 2 && tr.bullseyes === 1, `hits=${tr.hits} bull=${tr.bullseyes}`);
check('non-target object returns null', tr.hitTest(new THREE.Mesh(), now) === null);
tr.update(now + 2000); // past TARGET_RESET_MS
check('targets come back up after the reset window', plate0.parent!.visible === true && plate0.layers.test(new THREE.Layers()) === true);

// moving targets actually move
const groups = () => tr.group.children.filter((c) => c.type === 'Group');
const before = groups().map((c) => c.position.x);
tr.update(now + 3000);
const after = groups().map((c) => c.position.x);
check('moving targets oscillate', before.some((v, i) => Math.abs(v - after[i]) > 0.001), 'x positions changed');

// ---------- 4. bots ----------
const squad = new BotSquad(built.solids, range.size, 2, 0.5, new THREE.Vector3(0, 0, -42));
const botMeshes = squad.raycastTargets();
check('2 bots => 4 hittable meshes (body + head)', botMeshes.length === 4, `${botMeshes.length}`);
check('bots start alive', squad.aliveCount() === 2);

const body = botMeshes[0];
const head = botMeshes[1];
const sniper = getWeapon('sniper')!;
const bodyHit = squad.hitTest(body, 40, sniper.headshotMultiplier ?? 1, now);
check('body shot deals base damage', bodyHit?.damage === 40 && bodyHit.headshot === false, JSON.stringify(bodyHit));
check('body shot does not kill at 40/100', bodyHit?.killed === false && squad.aliveCount() === 2);
const headHit = squad.hitTest(head, 40, sniper.headshotMultiplier ?? 1, now);
check('headshot applies the multiplier', headHit?.damage === 100 && headHit.headshot === true, JSON.stringify(headHit));
check('headshot kills', headHit?.killed === true && squad.aliveCount() === 1 && squad.kills === 1);
check('dead bot leaves layer 0', body.layers.test(new THREE.Layers()) === false && head.layers.test(new THREE.Layers()) === false);
check('dead bot absorbs no further damage', squad.hitTest(body, 50, 1, now) === null);

// respawn after the timer (time only ever moves forwards, like performance.now())
let t = now;
squad.update({
  dt: 0.016,
  now: (t += 4000),
  playerPos: new THREE.Vector3(0, 1.6, -42),
  playerAlive: true,
  onPlayerDamage: () => {},
  onBotShot: () => {},
});
check('bot respawns after ~3s', squad.aliveCount() === 2, `alive=${squad.aliveCount()}`);
check('respawned bot is back on layer 0', body.layers.test(new THREE.Layers()) === true);

// splash damage (position read out of the world matrix)
const splashPos = body.getWorldPosition(new THREE.Vector3()).clone();
const splashDmg = squad.applySplash(splashPos, 6.5, 90, t);
check('grenade splash damages bots', splashDmg > 0 && Number.isFinite(splashDmg), `damage=${splashDmg}`);

// On an empty map every bot has line of sight, so engagement is deterministic.
const emptyBuilt = buildMap(getMap('empty'));
const hunters = new BotSquad(emptyBuilt.solids, 100, 2, 0.5, new THREE.Vector3(0, 0, -40));
const youAreHere = new THREE.Vector3(0, 1.6, -40);
let shots = 0;
let damageTaken = 0;
let startDist = 0;
let endDist = 0;
for (let i = 0; i < 600; i++) {
  const nowMs = (t += 1000 / 60);
  hunters.update({
    dt: 1 / 60,
    now: nowMs,
    playerPos: youAreHere,
    playerAlive: true,
    onPlayerDamage: (d) => (damageTaken += d),
    onBotShot: () => shots++,
  });
  const d = hunters.raycastTargets()[0].getWorldPosition(new THREE.Vector3()).distanceTo(youAreHere);
  if (i === 0) startDist = d;
  endDist = d;
}
const outOfBounds = hunters.raycastTargets().filter((m) => {
  const p = m.getWorldPosition(new THREE.Vector3());
  return Math.abs(p.x) > 50 || Math.abs(p.z) > 50 || p.y < -1;
});
check('bots stay inside the map and above ground', outOfBounds.length === 0, `${outOfBounds.length} outside`);
check('bots shoot when they have line of sight', shots > 5, `${shots} shots in 10s`);
check('bot bullets can hurt the player', damageTaken > 0, `damage=${damageTaken}`);
check('bots close distance on the player instead of wandering off', endDist < startDist, `${startDist.toFixed(1)} -> ${endDist.toFixed(1)}`);
check('bots do not fire while the player is down', (() => {
  let s = 0;
  for (let i = 0; i < 120; i++) {
    hunters.update({
      dt: 1 / 60,
      now: (t += 1000 / 60),
      playerPos: youAreHere,
      playerAlive: false,
      onPlayerDamage: () => s++,
      onBotShot: () => {},
    });
  }
  return s === 0;
})());

// ---------- 5. scope maths ----------
check('scope zoom 0 => no magnification', scopeMagnification(0) === 1);
check('scope zoom 3 => 4x magnification', scopeMagnification(3) === 4);
check('scope zoom clamps negatives', scopeMagnification(-5) === 1);
check('sniper needs a scope to be accurate', (sniper.spread ?? 0) > 20 * (sniper.spreadScoped ?? 1), `hip=${sniper.spread} scoped=${sniper.spreadScoped}`);
check('sniper has a quickscope fire rate', (sniper.quickScopeFireRateMs ?? 0) < sniper.fireRateMs, `${sniper.quickScopeFireRateMs} < ${sniper.fireRateMs}`);
check('exactly one weapon has a scope overlay', WEAPONS.filter((w) => w.scopeOverlay).length === 1);
check('scope zoom 0 leaves the FOV untouched', scopedFov(78, 0, 1) === 78, `${scopedFov(78, 0, 1)}`);
check('scope zoom 3 gives a 4x tighter FOV', Math.abs(scopedFov(78, 3, 1) - 19.5) < 1e-9, `${scopedFov(78, 3, 1)}`);
check('FOV eases in with the scope blend', Math.abs(scopedFov(78, 3, 0.5) - 78 / 2.5) < 1e-9, `${scopedFov(78, 3, 0.5)}`);
check('an unraised scope keeps hip-fire FOV', scopedFov(78, 3, 0) === 78);
check('scope zoom 0 leaves look speed untouched', scopeLookScale(0, 1, 1) === 1);
check('4x magnification quarters look speed', Math.abs(scopeLookScale(3, 1, 1) - 0.25) < 1e-9, `${scopeLookScale(3, 1, 1)}`);
check('scoped sensitivity multiplies back up', Math.abs(scopeLookScale(3, 1, 2) - 0.5) < 1e-9);

// ---------- 5b. stretched resolution layout ----------
const letterbox = computeViewLayout(1920, 1080, 4 / 3, false);
check(
  '4:3 letterboxed renders 1440x1080 and centres itself',
  letterbox.renderWidth === 1440 && letterbox.renderHeight === 1080 && letterbox.left === 240 && letterbox.top === 0 && letterbox.cssWidth === 1440,
  JSON.stringify(letterbox),
);
const stretched = computeViewLayout(1920, 1080, 4 / 3, true);
check(
  '4:3 stretched keeps the 1440x1080 buffer but covers the window',
  stretched.renderWidth === 1440 && stretched.renderHeight === 1080 && stretched.left === 0 && stretched.top === 0 && stretched.cssWidth === 1920 && stretched.cssHeight === 1080,
  JSON.stringify(stretched),
);
check('stretch keeps the render aspect (vertical FOV unchanged)', Math.abs(stretched.renderWidth / stretched.renderHeight - 4 / 3) < 1e-9);
const fill = computeViewLayout(1920, 1080, 0, true);
check('aspect "fill window" ignores the stretch toggle', fill.renderWidth === 1920 && fill.cssWidth === 1920 && !fill.stretched);
const tall = computeViewLayout(1000, 1200, 4 / 3, false);
check('portrait windows letterbox top and bottom', tall.renderWidth === 1000 && tall.renderHeight === 750 && tall.top === 225, JSON.stringify(tall));
const exact = computeViewLayout(1600, 1200, 4 / 3, true);
check('a window already at the target ratio is not rescaled', exact.renderWidth === 1600 && exact.renderHeight === 1200);

// ---------- 6. settings persistence ----------
check('default scope binding is right mouse', DEFAULT_BINDINGS.scope === 'Mouse2');
check('default volume is audible', DEFAULT_SETTINGS.volume > 0 && !DEFAULT_SETTINGS.muted);
const loaded = loadSettings();
check(
  'loadSettings fills every new field without localStorage',
  loaded.scopeZoom === DEFAULT_SETTINGS.scopeZoom &&
    loaded.stretchRes === DEFAULT_SETTINGS.stretchRes &&
    loaded.allowQuickScope === DEFAULT_SETTINGS.allowQuickScope &&
    loaded.scopeSettleMs === DEFAULT_SETTINGS.scopeSettleMs &&
    loaded.bindings.scope === 'Mouse2',
  JSON.stringify({ zoom: loaded.scopeZoom, stretch: loaded.stretchRes, settle: loaded.scopeSettleMs }),
);

// ---------- 7. audio engine survives a no-DOM environment ----------
let audioThrew = '';
try {
  audio.configure(0.5, false);
  audio.configure(0.5, false);
  audio.unlock();
  audio.shot('sniper');
  audio.scopeIn();
  audio.targetHit(true);
} catch (e) {
  audioThrew = String(e);
}
check('audio engine is inert without a browser AudioContext', audioThrew === '', audioThrew);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
