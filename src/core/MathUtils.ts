import * as THREE from 'three';

// Pre-allocated object pool to prevent garbage collection in hot loops
export const _tempVecA = new THREE.Vector3();
export const _tempVecB = new THREE.Vector3();
export const _tempVecC = new THREE.Vector3();
export const _tempVecD = new THREE.Vector3();

export const _tempQuatA = new THREE.Quaternion();
export const _tempQuatB = new THREE.Quaternion();

export const _tempEulerA = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Clamp a number between min and max
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth damp for angles or values without oscillation
 */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

/**
 * Simplified Pacejka friction calculation
 * B: stiffness factor, C: shape factor, D: peak value, E: curvature factor
 */
export function pacejkaFriction(slip: number, peakFriction: number): number {
  // Normalized Pacejka curve approximation
  const B = 10.0;
  const C = 1.65;
  const D = peakFriction;
  const E = 0.97;
  return D * Math.sin(C * Math.atan(B * slip - E * (B * slip - Math.atan(B * slip))));
}

/**
 * Normalize an angle to [-PI, PI]
 */
export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
