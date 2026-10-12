import * as THREE from 'three';

/**
 * Shooting-range target plates for the practice mode.
 *
 * Targets are render-only: they are raycastable (so bullets hit them) but they
 * add no collision solids, so you can walk straight through the lane.
 */

export interface TargetHit {
  index: number;
  bullseye: boolean;
  points: number;
}

interface Target {
  index: number;
  group: THREE.Group;
  plate: THREE.Mesh;
  bull: THREE.Mesh;
  baseX: number;
  moving: boolean;
  span: number;
  speed: number;
  phase: number;
  downUntil: number;
}

export const TARGET_RESET_MS = 900;

export class TargetRange {
  readonly group = new THREE.Group();
  private targets: Target[] = [];
  hits = 0;
  bullseyes = 0;

  constructor(opts: { moving: boolean }) {
    const plateMat = new THREE.MeshStandardMaterial({
      color: '#e9e9e9',
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const bullMat = new THREE.MeshStandardMaterial({
      color: '#d94b4b',
      roughness: 0.5,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#3a0d0d'),
    });
    const postMat = new THREE.MeshStandardMaterial({ color: '#2f3540', roughness: 0.9 });
    const plateGeo = new THREE.CircleGeometry(0.55, 24);
    const bullGeo = new THREE.CircleGeometry(0.19, 20);
    const postGeo = new THREE.BoxGeometry(0.14, 1, 0.14);

    // [x, y, z, moving]
    const layout: [number, number, number, boolean][] = [
      // close row
      [-16, 1.4, -6, false],
      [-8, 1.4, -6, false],
      [0, 1.4, -6, false],
      [8, 1.4, -6, false],
      [16, 1.4, -6, false],
      // mid row — the movers
      [-14, 1.4, 14, true],
      [-7, 1.1, 14, false],
      [0, 1.6, 14, true],
      [7, 1.1, 14, false],
      [14, 1.4, 14, true],
      // far row
      [-18, 1.4, 36, false],
      [-9, 1.4, 36, false],
      [0, 1.4, 36, true],
      [9, 1.4, 36, false],
      [18, 1.4, 36, false],
      // elevated pair, for scoped shots at height
      [-6, 5.2, 36, false],
      [6, 5.2, 36, true],
    ];

    layout.forEach(([x, y, z, mover], index) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.y = Math.PI; // plates face -z, towards the firing deck

      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.userData.targetIndex = index;
      g.add(plate);

      const bull = new THREE.Mesh(bullGeo, bullMat);
      bull.position.z = 0.012; // sits just in front of the plate, so it wins the raycast
      bull.userData.targetIndex = index;
      bull.userData.bullseye = true;
      g.add(bull);

      const post = new THREE.Mesh(postGeo, postMat);
      post.scale.y = Math.max(0.2, y);
      post.position.set(x, y / 2, z);
      this.group.add(post);

      this.group.add(g);
      this.targets.push({
        index,
        group: g,
        plate,
        bull,
        baseX: x,
        moving: mover && opts.moving,
        span: 5 + (index % 3) * 1.5,
        speed: 0.7 + (index % 4) * 0.22,
        phase: index * 1.3,
        downUntil: 0,
      });
    });
  }

  /** Plates and bullseyes, for the shot raycaster. */
  raycastTargets(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const t of this.targets) out.push(t.plate, t.bull);
    return out;
  }

  /**
   * If `object` is one of our plates, score it and knock it down.
   * Returns null when the object isn't a target.
   */
  hitTest(object: THREE.Object3D, now: number): TargetHit | null {
    const index = object.userData.targetIndex as number | undefined;
    if (index === undefined) return null;
    const t = this.targets[index];
    if (!t || now < t.downUntil) return null;
    const bullseye = object.userData.bullseye === true;
    t.downUntil = now + TARGET_RESET_MS;
    this.setDown(t, true);
    this.hits += 1;
    if (bullseye) this.bullseyes += 1;
    return { index, bullseye, points: bullseye ? 2 : 1 };
  }

  /**
   * Hiding a plate is not enough: three.js raycasts invisible objects too, so a
   * downed plate would silently eat bullets. Dropping it off layer 0 removes it
   * from the shot raycaster as well.
   */
  private setDown(t: Target, down: boolean) {
    t.group.visible = !down;
    for (const mesh of [t.plate, t.bull]) {
      if (down) mesh.layers.disable(0);
      else mesh.layers.enable(0);
    }
  }

  update(now: number) {
    const t = now / 1000;
    for (const target of this.targets) {
      if (!target.group.visible && now >= target.downUntil) this.setDown(target, false);
      if (target.moving) {
        target.group.position.x = target.baseX + Math.sin(t * target.speed + target.phase) * target.span;
      }
    }
  }

  reset() {
    for (const t of this.targets) {
      t.downUntil = 0;
      this.setDown(t, false);
    }
  }

  get count() {
    return this.targets.length;
  }
}
