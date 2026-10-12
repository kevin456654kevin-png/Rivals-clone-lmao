import * as THREE from 'three';
import { type Solid, resolveCeilings, resolveHorizontal, resolveVertical } from './collision';

/**
 * Source-inspired movement: ground/air acceleration and crouch-sprint sliding.
 *
 * Air strafing uses the Quake/Source model:
 *  - low airWishSpeed (2.0) means the dot-product cap is tight, so each frame you
 *    gain a consistent slice of speed in your wish direction,
 *  - high airAccel (50) makes that slice feel snappy,
 *  - turning your mouse into the strafe converts those slices into net speed gain,
 *  - no hard speed cap — momentum is preserved across bunny hops.
 */

export const MOVE = {
  walkSpeed: 6.2,
  sprintSpeed: 9.2,
  crouchSpeed: 3.2,
  groundAccel: 14,
  airAccel: 50, // high for responsive air-strafing (Source-style)
  airWishSpeed: 2.0, // low wish cap so strafing compounds into real speed
  bhopWindow: 0.15, // generous window for scroll-wheel bhopping
  friction: 7.5,
  gravity: 26,
  jumpVelocity: 9.2,
  maxAirSpeed: 60, // soft ceiling — only clamps if you exceed this (prevents insanity)
  slideStartMinSpeed: 6.5,
  slideBoost: 1.18,
  slideFriction: 1.1,
  slideMinDuration: 0.25,
  slideMaxSpeedForControl: 2.0,
  standHeight: 1.7,
  crouchHeight: 1.05,
  slideHeight: 0.85,
  crouchHeightLerp: 10,
  playerRadius: 0.4,
};

export interface PlayerPhysicsState {
  position: THREE.Vector3; // feet position
  velocity: THREE.Vector3;
  grounded: boolean;
  sliding: boolean;
  slideTime: number;
  crouching: boolean;
  height: number;
  timeSinceLand: number; // seconds spent grounded since the last landing
}

export function createPhysicsState(spawn: [number, number, number]): PlayerPhysicsState {
  return {
    position: new THREE.Vector3(spawn[0], spawn[1], spawn[2]),
    velocity: new THREE.Vector3(0, 0, 0),
    grounded: true,
    sliding: false,
    slideTime: 0,
    crouching: false,
    height: MOVE.standHeight,
    timeSinceLand: 0,
  };
}

function accelerate(
  velocity: THREE.Vector3,
  wishDir: THREE.Vector3,
  wishSpeed: number,
  accel: number,
  dt: number,
) {
  const currentSpeed = velocity.dot(wishDir);
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return;
  let accelSpeed = accel * dt * wishSpeed;
  if (accelSpeed > addSpeed) accelSpeed = addSpeed;
  velocity.addScaledVector(wishDir, accelSpeed);
}

export interface MoveInput {
  forward: number; // -1..1
  right: number; // -1..1
  sprint: boolean;
  crouch: boolean;
  jumpPressed: boolean; // edge-triggered this frame
  yaw: number;
  /** Multiplier on the ground speed cap (e.g. scoped-in slowdown). Default 1. */
  speedScale?: number;
}

export function stepPhysics(state: PlayerPhysicsState, input: MoveInput, dt: number) {
  const wishDirLocal = new THREE.Vector3(input.right, 0, -input.forward);
  if (wishDirLocal.lengthSq() > 0) wishDirLocal.normalize();
  const wishDir = wishDirLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);

  if (state.grounded) state.timeSinceLand += dt;
  else state.timeSinceLand = 0;

  const horizVel = new THREE.Vector3(state.velocity.x, 0, state.velocity.z);
  const speed = horizVel.length();

  // --- Slide trigger ---
  if (
    !state.sliding &&
    state.grounded &&
    input.crouch &&
    speed > MOVE.slideStartMinSpeed &&
    (input.sprint || speed > MOVE.walkSpeed * 0.95)
  ) {
    state.sliding = true;
    state.slideTime = 0;
    horizVel.multiplyScalar(MOVE.slideBoost);
    state.velocity.x = horizVel.x;
    state.velocity.z = horizVel.z;
  }

  if (state.sliding) {
    state.slideTime += dt;
    const curHoriz = new THREE.Vector3(state.velocity.x, 0, state.velocity.z);
    const curSpeed = curHoriz.length();
    // slight steering while sliding
    if (curSpeed < MOVE.slideMaxSpeedForControl + 3) {
      accelerate(state.velocity, wishDir, MOVE.slideMaxSpeedForControl, MOVE.airAccel * 0.3, dt);
    }
    // friction decel
    if (state.grounded) {
      const decel = MOVE.slideFriction * dt;
      const newSpeed = Math.max(0, curSpeed - decel * curSpeed);
      if (curSpeed > 0.001) {
        const scale = newSpeed / curSpeed;
        state.velocity.x *= scale;
        state.velocity.z *= scale;
      }
    }
    const endBySpeed = curSpeed < MOVE.walkSpeed * 0.6 && state.slideTime > MOVE.slideMinDuration;
    const endByRelease = !input.crouch && state.slideTime > MOVE.slideMinDuration;
    const endByJump = input.jumpPressed && state.grounded;
    if (endBySpeed || endByRelease || endByJump) {
      state.sliding = false;
    }
  } else {
    state.crouching = input.crouch;
    if (state.grounded) {
      // friction
      if (speed > 0) {
        const drop = speed * MOVE.friction * dt;
        const newSpeed = Math.max(speed - drop, 0);
        const scale = speed > 0 ? newSpeed / speed : 0;
        state.velocity.x *= scale;
        state.velocity.z *= scale;
      }
      const scale = input.speedScale ?? 1;
      const maxSpeed =
        (input.crouch ? MOVE.crouchSpeed : input.sprint ? MOVE.sprintSpeed : MOVE.walkSpeed) * scale;
      accelerate(state.velocity, wishDir, maxSpeed, MOVE.groundAccel, dt);
    } else {
      accelerate(state.velocity, wishDir, MOVE.airWishSpeed, MOVE.airAccel, dt);
      // Soft ceiling: only clamp if way above limit (preserves strafing momentum)
      const airSpeed = Math.hypot(state.velocity.x, state.velocity.z);
      if (airSpeed > MOVE.maxAirSpeed) {
        const s = MOVE.maxAirSpeed / airSpeed;
        state.velocity.x *= s;
        state.velocity.z *= s;
      }
    }
  }

  // Jump. Bhop: re-jumping within the window after landing preserves all momentum.
  if (input.jumpPressed && state.grounded && !state.sliding) {
    state.velocity.y = MOVE.jumpVelocity;
    state.grounded = false;
  }

  // Gravity
  state.velocity.y -= MOVE.gravity * dt;

  // Integrate
  state.position.addScaledVector(state.velocity, dt);

  // Target crouch height
  const targetHeight = state.sliding ? MOVE.slideHeight : input.crouch ? MOVE.crouchHeight : MOVE.standHeight;
  state.height += (targetHeight - state.height) * Math.min(1, MOVE.crouchHeightLerp * dt);
}

export function resolveGroundAndWalls(state: PlayerPhysicsState, solids: Solid[], worldSize: number) {
  // World bounds
  const half = worldSize / 2 - 0.6;
  state.position.x = THREE.MathUtils.clamp(state.position.x, -half, half);
  state.position.z = THREE.MathUtils.clamp(state.position.z, -half, half);

  const r = MOVE.playerRadius;
  // Two passes so pushing out of one wall doesn't leave us inside a neighbour
  resolveHorizontal(state.position, state.velocity, state.height, solids, r);
  resolveHorizontal(state.position, state.velocity, state.height, solids, r);
  resolveCeilings(state.position, state.velocity, state.height, solids, r);
  state.grounded = resolveVertical(state.position, state.velocity, solids);
}
