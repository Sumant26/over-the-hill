import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { clamp, _tempVecA, _tempVecB, _tempVecC } from '../core/MathUtils';

export interface WinchConfig {
  maxCableLength?: number;
  minCableLength?: number;
  spoolSpeed?: number;      // m/s
  cableStiffness?: number;  // N/m
  cableDamping?: number;    // Ns/m
  maxTensionForce?: number; // Newtons
}

export class Winch {
  public maxCableLength: number;
  public minCableLength: number;
  public spoolSpeed: number;
  public cableStiffness: number;
  public cableDamping: number;
  public maxTensionForce: number;

  public isAttached = false;
  public anchorPoint: THREE.Vector3 | null = null;
  public cableLength = 0;
  public currentTension = 0;

  // Local offset on vehicle front bumper
  public bumperLocalMount = new THREE.Vector3(0, 0.2, 2.1);

  constructor(config: WinchConfig = {}) {
    this.maxCableLength = config.maxCableLength ?? 30.0;
    this.minCableLength = config.minCableLength ?? 1.5;
    this.spoolSpeed = config.spoolSpeed ?? 2.8;
    this.cableStiffness = config.cableStiffness ?? 22000;
    this.cableDamping = config.cableDamping ?? 1800;
    this.maxTensionForce = config.maxTensionForce ?? 22000;
  }

  /**
   * Attempt to attach to a world anchor point
   */
  public attach(anchor: THREE.Vector3, bumperWorldPos: THREE.Vector3): boolean {
    const dist = bumperWorldPos.distanceTo(anchor);
    if (dist > this.maxCableLength) {
      return false;
    }
    this.isAttached = true;
    this.anchorPoint = anchor.clone();
    this.cableLength = dist;
    return true;
  }

  /**
   * Release and disconnect the winch
   */
  public release(): void {
    this.isAttached = false;
    this.anchorPoint = null;
    this.cableLength = 0;
    this.currentTension = 0;
  }

  /**
   * Find closest anchor in front of vehicle from a list of candidate points
   */
  public findBestAnchor(
    bumperWorldPos: THREE.Vector3,
    chassisForward: THREE.Vector3,
    candidatePoints: THREE.Vector3[]
  ): THREE.Vector3 | null {
    let bestPoint: THREE.Vector3 | null = null;
    let minScore = Infinity;

    for (const point of candidatePoints) {
      _tempVecA.copy(point).sub(bumperWorldPos);
      const dist = _tempVecA.length();

      if (dist < 1.0 || dist > this.maxCableLength) continue;

      _tempVecA.normalize();
      const dot = _tempVecA.dot(chassisForward);

      // Must be within forward hemisphere (dot > 0.2)
      if (dot > 0.2) {
        const score = dist - dot * 10; // Favor points directly in front
        if (score < minScore) {
          minScore = score;
          bestPoint = point;
        }
      }
    }

    return bestPoint;
  }

  /**
   * Update winch tension and apply pulling forces to vehicle chassis
   */
  public update(
    chassisBody: RAPIER.RigidBody,
    chassisPos: THREE.Vector3,
    chassisQuat: THREE.Quaternion,
    pullIn: boolean,
    releaseOut: boolean,
    dt: number
  ): void {
    if (!this.isAttached || !this.anchorPoint) {
      this.currentTension = 0;
      return;
    }

    // World position of the front bumper mount
    const bumperWorld = _tempVecA.copy(this.bumperLocalMount).applyQuaternion(chassisQuat).add(chassisPos);

    // Motor spooling
    if (pullIn) {
      this.cableLength = Math.max(this.minCableLength, this.cableLength - this.spoolSpeed * dt);
    } else if (releaseOut) {
      this.cableLength = Math.min(this.maxCableLength, this.cableLength + this.spoolSpeed * dt);
    }

    // Distance vector from bumper to anchor
    const cableDir = _tempVecB.copy(this.anchorPoint).sub(bumperWorld);
    const currentDist = cableDir.length();

    if (currentDist <= 0.001) {
      this.currentTension = 0;
      return;
    }

    cableDir.normalize();

    // Elastic distance constraint
    if (currentDist > this.cableLength) {
      const stretch = currentDist - this.cableLength;

      // Relative velocity along cable
      const linvel = chassisBody.linvel();
      const relVel = cableDir.x * linvel.x + cableDir.y * linvel.y + cableDir.z * linvel.z;

      const springForce = this.cableStiffness * stretch;
      const damperForce = this.cableDamping * relVel;
      this.currentTension = clamp(springForce + damperForce, 0, this.maxTensionForce);

      // Apply tension impulse towards anchor
      const impulseMag = this.currentTension * dt;
      const impulse = _tempVecC.copy(cableDir).multiplyScalar(impulseMag);
      chassisBody.applyImpulseAtPoint(impulse, bumperWorld, true);
    } else {
      this.currentTension = 0;
    }
  }
}
