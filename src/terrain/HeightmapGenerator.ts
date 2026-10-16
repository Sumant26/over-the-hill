import * as THREE from 'three';
import { SURFACE_TYPES, SurfaceProperties } from './SurfaceTypes';

// Fast 2D Simplex-like noise generator
class SimpleNoise2D {
  private perm: Uint8Array;

  constructor(seed = 1337) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Shuffle with linear congruential generator
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = (s >>> 16) % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  public noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const grad = (hash: number, gx: number, gy: number) => {
      const h = hash & 7;
      const u = h < 4 ? gx : gy;
      const v = h < 4 ? gy : gx;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const x1 = (1 - u) * grad(aa, xf, yf) + u * grad(ba, xf - 1, yf);
    const x2 = (1 - u) * grad(ab, xf, yf - 1) + u * grad(bb, xf - 1, yf - 1);

    return (1 - v) * x1 + v * x2;
  }
}

export class HeightmapGenerator {
  private noiseGen: SimpleNoise2D;

  constructor(seed = 42) {
    this.noiseGen = new SimpleNoise2D(seed);
  }

  /**
   * Sample terrain elevation at (x, z)
   */
  public getHeight(x: number, z: number): number {
    // Keep spawn area (0, 0) relatively level
    const distFromOrigin = Math.sqrt(x * x + z * z);
    const flatRadius = 15;
    const flatFactor = Math.min(1, Math.max(0, (distFromOrigin - flatRadius) / 20));

    // Multi-octave fractal noise
    const n1 = this.noiseGen.noise(x * 0.015, z * 0.015) * 8.0;   // Large hills
    const n2 = this.noiseGen.noise(x * 0.04, z * 0.04) * 3.5;     // Rolling terrain
    const n3 = this.noiseGen.noise(x * 0.1, z * 0.1) * 0.8;       // Ground bumps

    // Valley / Mud-pit carving (negative basins)
    const valley = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 2.0;

    const rawHeight = n1 + n2 + n3 + valley;
    return rawHeight * flatFactor;
  }

  /**
   * Sample surface type based on elevation and slope
   */
  public getSurface(x: number, z: number, height: number): SurfaceProperties {
    // Compute approximate slope by sampling nearby points
    const eps = 0.5;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    const dx = (hR - hL) / (2 * eps);
    const dz = (hU - hD) / (2 * eps);
    const slope = Math.sqrt(dx * dx + dz * dz);

    // Steep cliffs become rock
    if (slope > 0.45 || height > 6.5) {
      return SURFACE_TYPES.ROCK;
    }

    // Low elevation basins become mud pits or water
    if (height < -1.0) {
      return SURFACE_TYPES.WATER;
    } else if (height < 0.8 && Math.abs(this.noiseGen.noise(x * 0.05, z * 0.05)) > 0.15) {
      // Mud trails and bogs in low flat areas
      return SURFACE_TYPES.MUD;
    }

    // Trail paths vs Grass
    const trailNoise = Math.abs(this.noiseGen.noise(x * 0.03 + 5.0, z * 0.03 + 5.0));
    if (trailNoise < 0.12) {
      return SURFACE_TYPES.DIRT;
    }

    return SURFACE_TYPES.GRASS;
  }

  /**
   * Calculate surface normal at (x, z)
   */
  public getNormal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const eps = 0.2;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    out.set(hL - hR, 2 * eps, hD - hU).normalize();
    return out;
  }
}
