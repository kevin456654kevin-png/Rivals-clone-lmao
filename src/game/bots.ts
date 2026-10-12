import * as THREE from 'three';
import type { Solid } from './collision';
import { solidAt } from './collision';
import {
  createPhysicsState,
  resolveGroundAndWalls,
  stepPhysics,
  type MoveInput,
  type PlayerPhysicsState,
} from './movement';

/**
 * Practice-range bots.
 *
 * Each bot runs the same physics as the player (so it walks, jumps over nothing,
 * slides off ramps exactly like you do), wanders between random goals, and
 * engages when it has line of sight. Line of sight is sampled against the map
 * solids, so bots do not shoot through walls.
 */

export const BOT_MAX_HP = 100;
const BOT_RESPAWN_MS = 3000;
const BODY_COLOR = '#4f86c6';
const HEAD_COLOR = '#c9dcf2';

export interface BotUpdateCtx {
  dt: number;
  now: number;
  /** Player eye position. */
  playerPos: THREE.Vector3;
  playerAlive: boolean;
  /** Called when a bot's bullet lands. */
  onPlayerDamage: (damage: number) => void;
  /** Called for every bot shot so the game can draw a tracer. */
  onBotShot: (from: THREE.Vector3, to: THREE.Vector3) => void;
}

export interface BotHitResult {
  damage: number;
  headshot: boolean;
  killed: boolean;
}

interface Bot {
  index: number;
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  physics: PlayerPhysicsState;
  hp: number;
  alive: boolean;
  respawnAt: number;
  goal: THREE.Vector3;
  nextThinkAt: number;
  acquiredAt: number; // when line of sight was first established (0 = none)
  lastShotAt: number;
  strafeDir: number;
  nextStrafeFlip: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export class BotSquad {
  readonly group = new THREE.Group();
  private bots: Bot[] = [];
  kills = 0;
  deaths = 0; // times the player was dropped by a bot

  constructor(
    private solids: Solid[],
    private worldSize: number,
    count: number,
    private skill: number,
    private playerSpawn: THREE.Vector3,
  ) {
    const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.1, 4, 8);
    const headGeo = new THREE.SphereGeometry(0.24, 14, 12);
    const gunGeo = new THREE.BoxGeometry(0.14, 0.14, 0.62);
    const bodyMat = new THREE.MeshStandardMaterial({ color: BODY_COLOR, roughness: 0.65 });
    const headMat = new THREE.MeshStandardMaterial({ color: HEAD_COLOR, roughness: 0.55 });
    const gunMat = new THREE.MeshStandardMaterial({ color: '#1d2126' });

    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.95;
      body.castShadow = true;
      body.userData.botIndex = i;
      g.add(body);

      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.66;
      head.castShadow = true;
      head.userData.botIndex = i;
      head.userData.isHead = true;
      g.add(head);

      // -z is "forwards" for a group whose rotation.y follows the player yaw convention
      const gun = new THREE.Mesh(gunGeo, gunMat);
      gun.position.set(0.3, 1.15, -0.4);
      g.add(gun);

      const spawn = this.spawnAwayFrom(this.playerSpawn, 22);
      g.position.copy(spawn);
      this.group.add(g);

      this.bots.push({
        index: i,
        group: g,
        body,
        head,
        physics: createPhysicsState([spawn.x, spawn.y, spawn.z]),
        hp: BOT_MAX_HP,
        alive: true,
        respawnAt: 0,
        goal: this.randomSpawn(),
        nextThinkAt: 0,
        acquiredAt: 0,
        lastShotAt: 0,
        strafeDir: Math.random() < 0.5 ? -1 : 1,
        nextStrafeFlip: 0,
      });
    }
  }

  private randomSpawn(): THREE.Vector3 {
    const half = this.worldSize / 2 - 4;
    return new THREE.Vector3((Math.random() * 2 - 1) * half, 0, (Math.random() * 2 - 1) * half);
  }

  /** A reachable-looking point roughly 6..18 units from the player. */
  private pointNearPlayer(player: THREE.Vector3): THREE.Vector3 {
    const half = this.worldSize / 2 - 4;
    const angle = Math.random() * Math.PI * 2;
    const dist = 6 + Math.random() * 12;
    const x = THREE.MathUtils.clamp(player.x + Math.cos(angle) * dist, -half, half);
    const z = THREE.MathUtils.clamp(player.z + Math.sin(angle) * dist, -half, half);
    return new THREE.Vector3(x, 0, z);
  }

  /** A spawn point at least `minDist` away from the player. */
  private spawnAwayFrom(player: THREE.Vector3, minDist: number): THREE.Vector3 {
    const half = this.worldSize / 2 - 5;
    for (let i = 0; i < 24; i++) {
      const p = new THREE.Vector3((Math.random() * 2 - 1) * half, 0, (Math.random() * 2 - 1) * half);
      if (p.distanceTo(player) >= minDist) return p;
    }
    return new THREE.Vector3(player.x > 0 ? -half : half, 0, 0);
  }

  /** Meshes to hand to the shot raycaster. */
  raycastTargets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const b of this.bots) out.push(b.body, b.head);
    return out;
  }

  aliveCount() {
    return this.bots.filter((b) => b.alive).length;
  }

  /**
   * Apply a bullet to a bot if `object` is one of its meshes.
   * Returns null when the object does not belong to a bot.
   */
  hitTest(
    object: THREE.Object3D,
    baseDamage: number,
    headshotMultiplier: number,
    now: number,
  ): BotHitResult | null {
    const index = object.userData.botIndex as number | undefined;
    if (index === undefined) return null;
    const bot = this.bots[index];
    if (!bot || !bot.alive) return null;
    const headshot = object.userData.isHead === true;
    const damage = Math.round(baseDamage * (headshot ? headshotMultiplier : 1));
    bot.hp -= damage;
    const killed = bot.hp <= 0;
    if (killed) this.kill(bot, now);
    return { damage, headshot, killed };
  }

  /** Explosion damage. Returns the total damage dealt across all bots caught. */
  applySplash(pos: THREE.Vector3, radius: number, maxDamage: number, now: number): number {
    let total = 0;
    for (const bot of this.bots) {
      if (!bot.alive) continue;
      const centre = new THREE.Vector3(
        bot.physics.position.x,
        bot.physics.position.y + 1,
        bot.physics.position.z,
      );
      const d = centre.distanceTo(pos);
      if (d >= radius) continue;
      const damage = Math.round(maxDamage * (1 - d / radius));
      if (damage <= 0) continue;
      bot.hp -= damage;
      total += damage;
      if (bot.hp <= 0) this.kill(bot, now);
    }
    return total;
  }

  private kill(bot: Bot, now: number) {
    bot.alive = false;
    bot.hp = 0;
    bot.group.visible = false;
    // Invisible meshes are still raycastable in three.js, so drop them off the
    // shot layer too — otherwise a dead bot would silently eat bullets.
    bot.body.layers.disable(0);
    bot.head.layers.disable(0);
    bot.respawnAt = now + BOT_RESPAWN_MS;
    this.kills += 1;
  }

  private respawn(bot: Bot, player: THREE.Vector3) {
    const p = this.spawnAwayFrom(player, 25);
    bot.physics = createPhysicsState([p.x, p.y, p.z]);
    bot.hp = BOT_MAX_HP;
    bot.alive = true;
    bot.acquiredAt = 0;
    bot.goal = this.randomSpawn();
    bot.nextThinkAt = 0;
    bot.group.visible = true;
    bot.body.layers.enable(0);
    bot.head.layers.enable(0);
    bot.group.position.copy(p);
  }

  /** Sampled line of sight against map geometry only. */
  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const steps = 28;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const z = from.z + (to.z - from.z) * t;
      if (solidAt(this.solids, x, y, z)) return false;
    }
    return true;
  }

  private eyeOf(bot: Bot): THREE.Vector3 {
    return new THREE.Vector3(
      bot.physics.position.x,
      bot.physics.position.y + bot.physics.height - 0.12,
      bot.physics.position.z,
    );
  }

  update(ctx: BotUpdateCtx) {
    const { dt, now } = ctx;
    for (const bot of this.bots) {
      if (!bot.alive) {
        if (now >= bot.respawnAt) this.respawn(bot, ctx.playerPos);
        continue;
      }

      const eye = this.eyeOf(bot);
      const flat = new THREE.Vector3(ctx.playerPos.x - eye.x, 0, ctx.playerPos.z - eye.z);
      const dist = flat.length();
      const seesPlayer = ctx.playerAlive && dist > 0.4 && this.hasLineOfSight(eye, ctx.playerPos);

      if (seesPlayer && bot.acquiredAt === 0) bot.acquiredAt = now;
      if (!seesPlayer) bot.acquiredAt = 0;

      let input: MoveInput;

      if (seesPlayer) {
        // Face the player, strafe, and keep a preferred distance.
        const yaw = Math.atan2(-flat.x, -flat.z);
        if (now > bot.nextStrafeFlip) {
          bot.nextStrafeFlip = now + 500 + Math.random() * 700;
          bot.strafeDir *= -1;
        }
        const preferred = lerp(22, 9, this.skill);
        const forward = dist > preferred + 3 ? 1 : dist < preferred - 3 ? -1 : 0;
        input = {
          forward,
          right: bot.strafeDir,
          sprint: false,
          crouch: false,
          jumpPressed: false,
          yaw,
        };
        this.tryShoot(bot, ctx, eye, dist);
      } else {
        // No line of sight: mostly hunt towards the player, sometimes wander off
        // so the range doesn't turn into a straight conga line.
        if (now > bot.nextThinkAt) {
          bot.goal = Math.random() < 0.72 ? this.pointNearPlayer(ctx.playerPos) : this.randomSpawn();
          bot.nextThinkAt = now + 1500 + Math.random() * 2000;
        }
        const toGoal = new THREE.Vector3(bot.goal.x - eye.x, 0, bot.goal.z - eye.z);
        if (toGoal.length() < 2.5) {
          bot.goal = Math.random() < 0.72 ? this.pointNearPlayer(ctx.playerPos) : this.randomSpawn();
          bot.nextThinkAt = now + 1200;
        }
        const yaw = Math.atan2(-toGoal.x, -toGoal.z);
        input = { forward: 1, right: 0, sprint: true, crouch: false, jumpPressed: false, yaw };
      }

      stepPhysics(bot.physics, input, dt);
      resolveGroundAndWalls(bot.physics, this.solids, this.worldSize);

      // Don't let bots overlap the player
      const px = bot.physics.position.x - ctx.playerPos.x;
      const pz = bot.physics.position.z - ctx.playerPos.z;
      const pd = Math.hypot(px, pz);
      if (pd < 1.1 && pd > 0.0001) {
        const push = (1.1 - pd) / pd;
        bot.physics.position.x += px * push;
        bot.physics.position.z += pz * push;
      }

      bot.group.position.set(bot.physics.position.x, bot.physics.position.y, bot.physics.position.z);
      bot.group.rotation.y = input.yaw;
      // squash slightly while the physics height changes (crouch/slide share the rig)
      const squash = bot.physics.height / 1.7;
      bot.body.scale.y = squash;
      bot.body.position.y = 0.95 * squash;
      bot.head.position.y = 1.66 * squash;
    }
  }

  private tryShoot(bot: Bot, ctx: BotUpdateCtx, eye: THREE.Vector3, dist: number) {
    const reactionMs = lerp(750, 130, this.skill);
    if (ctx.now - bot.acquiredAt < reactionMs) return;
    const intervalMs = lerp(820, 230, this.skill);
    if (ctx.now - bot.lastShotAt < intervalMs) return;
    bot.lastShotAt = ctx.now;

    // Hit chance falls off with range and rises with skill.
    const base = lerp(0.28, 0.68, this.skill);
    const falloff = Math.max(0.15, 1 - dist / 70);
    const hits = Math.random() < base * falloff;
    const jitter = lerp(1.6, 0.35, this.skill) * (hits ? 0.2 : 1);
    const aim = ctx.playerPos.clone();
    aim.x += (Math.random() - 0.5) * jitter;
    aim.y += (Math.random() - 0.5) * jitter;
    aim.z += (Math.random() - 0.5) * jitter;
    ctx.onBotShot(eye.clone(), aim);

    if (hits) {
      const damage = Math.round(lerp(6, 15, this.skill) * Math.max(0.4, 1 - dist / 120));
      if (damage > 0) ctx.onPlayerDamage(damage);
    }
  }

  /** Called when the player is dropped, so bots stop shooting at a corpse. */
  notePlayerDeath(now: number) {
    this.deaths += 1;
    for (const b of this.bots) b.lastShotAt = now;
  }
}
