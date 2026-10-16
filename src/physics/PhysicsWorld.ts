import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface RaycastHitResult {
  hit: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: RAPIER.Collider | null;
}

export class PhysicsWorld {
  public world!: RAPIER.World;
  private initialized = false;
  private gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);

  // Cached scratch ray to prevent allocations in raycasting queries
  private scratchRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  public async init(): Promise<void> {
    if (this.initialized) return;
    await RAPIER.init();
    this.world = new RAPIER.World(this.gravity);
    this.initialized = true;
  }

  public step(dt: number): void {
    if (!this.initialized) return;
    this.world.timestep = dt;
    this.world.step();
  }

  /**
   * Cast a ray in the physics world and return point, normal, distance, and hit collider
   */
  public castRay(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    maxDistance: number,
    excludeRigidBody?: RAPIER.RigidBody,
    outResult?: RaycastHitResult
  ): RaycastHitResult {
    const result = outResult || {
      hit: false,
      point: new THREE.Vector3(),
      normal: new THREE.Vector3(0, 1, 0),
      distance: maxDistance,
      collider: null
    };

    if (!this.initialized) {
      result.hit = false;
      return result;
    }

    this.scratchRay.origin.x = origin.x;
    this.scratchRay.origin.y = origin.y;
    this.scratchRay.origin.z = origin.z;

    this.scratchRay.dir.x = direction.x;
    this.scratchRay.dir.y = direction.y;
    this.scratchRay.dir.z = direction.z;

    const hit = this.world.castRayAndGetNormal(
      this.scratchRay,
      maxDistance,
      true,
      undefined,
      undefined,
      undefined,
      excludeRigidBody
    );

    if (hit) {
      result.hit = true;
      result.distance = hit.timeOfImpact;
      result.point.set(
        origin.x + direction.x * hit.timeOfImpact,
        origin.y + direction.y * hit.timeOfImpact,
        origin.z + direction.z * hit.timeOfImpact
      );
      result.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
      result.collider = hit.collider;
    } else {
      result.hit = false;
      result.distance = maxDistance;
      result.collider = null;
    }

    return result;
  }

  /**
   * Create a flat ground collider for testing or base plane
   */
  public createGroundPlane(width: number, depth: number, y: number = 0): RAPIER.Collider {
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, y, 0);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(width / 2, 0.5, depth / 2).setTranslation(0, -0.5, 0);
    return this.world.createCollider(groundColliderDesc, groundBody);
  }

  public isReady(): boolean {
    return this.initialized;
  }
}
