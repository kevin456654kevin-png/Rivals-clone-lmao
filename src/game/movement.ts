import * as THREE from 'three';

/**
 * Source-engine inspired movement: ground/air acceleration, bunny-hopping
 * (no speed penalty on jump, generous air control) and crouch-sprint sliding.
 */

export const MOVE = {
  walkSpeed: 6.2,
  sprintSpeed: 9.2,
  crouchSpeed: 3.2,
  groundAccel: 14,
  airAccel: 70,
  airSpeedCap: 1.6,
  friction: 7.5,
  gravity: 26,
  jumpVelocity: 9.2,
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
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  grounded: boolean;
  sliding: boolean;
  slideTime: number;
  crouching: boolean;
  height: number;
}

export function createPhysicsState(spawn: [number, number, number]): PlayerPhysicsState {
  return {
    position: new THREE.Vector3(spawn[0], spawn[1], spawn[2]),
    velocity: new THREE.Vector3(0, 0, 0),
    grounded: false,
    sliding: false,
    slideTime: 0,
    crouching: false,
    height: MOVE.standHeight,
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
}

export function stepPhysics(state: PlayerPhysicsState, input: MoveInput, dt: number) {
  const wishDirLocal = new THREE.Vector3(input.right, 0, -input.forward);
  if (wishDirLocal.lengthSq() > 0) wishDirLocal.normalize();
  const wishDir = wishDirLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), input.yaw);

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
      const maxSpeed = input.crouch ? MOVE.crouchSpeed : input.sprint ? MOVE.sprintSpeed : MOVE.walkSpeed;
      accelerate(state.velocity, wishDir, maxSpeed, MOVE.groundAccel, dt);
    } else {
      accelerate(state.velocity, wishDir, MOVE.airSpeedCap * MOVE.sprintSpeed, MOVE.airAccel, dt);
    }
  }

  // Jump (bunny-hop friendly: no landing penalty, immediate re-jump available)
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

export function resolveGroundAndWalls(
  state: PlayerPhysicsState,
  colliders: THREE.Box3[],
  worldSize: number,
) {
  // Floor
  if (state.position.y <= 0) {
    state.position.y = 0;
    state.velocity.y = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  // World bounds
  const half = worldSize / 2 - 0.6;
  state.position.x = THREE.MathUtils.clamp(state.position.x, -half, half);
  state.position.z = THREE.MathUtils.clamp(state.position.z, -half, half);

  // AABB collision resolution against walls (simple cylinder-ish via radius box)
  const r = MOVE.playerRadius;
  const feet = state.position.y;
  const head = state.position.y + state.height;
  for (const box of colliders) {
    if (head < box.min.y || feet > box.max.y) continue;
    const px = state.position.x;
    const pz = state.position.z;
    const closestX = THREE.MathUtils.clamp(px, box.min.x, box.max.x);
    const closestZ = THREE.MathUtils.clamp(pz, box.min.z, box.max.z);
    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < r * r) {
      const dist = Math.sqrt(distSq) || 0.0001;
      const overlap = r - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      state.position.x += nx * overlap;
      state.position.z += nz * overlap;
      const vn = state.velocity.x * nx + state.velocity.z * nz;
      if (vn < 0) {
        state.velocity.x -= vn * nx;
        state.velocity.z -= vn * nz;
      }
    }
  }
}
