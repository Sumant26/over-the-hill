import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld';
import { TerrainManager } from '../../src/terrain/TerrainManager';

describe('TerrainManager Integration', () => {
  let physics: PhysicsWorld;
  let scene: THREE.Scene;
  let terrain: TerrainManager;

  beforeAll(async () => {
    physics = new PhysicsWorld();
    await physics.init();
    scene = new THREE.Scene();
    terrain = new TerrainManager(scene, physics, 777);
  });

  it('generates a 3x3 grid of chunks around the player at radius 1', () => {
    terrain.updatePlayerPosition(new THREE.Vector3(0, 0, 0), 1);
    physics.step(0.016);
    // (-1, 0, 1) in x and z = 3 * 3 = 9 chunks
    expect(terrain.getActiveChunkCount()).toBe(9);
  });

  it('allows Rapier raycast to hit the terrain trimesh collider directly', () => {
    physics.step(0.016);
    const origin = new THREE.Vector3(5, 10, 5);
    const dir = new THREE.Vector3(0, -1, 0);

    const hit = physics.castRay(origin, dir, 20);
    expect(hit.hit).toBe(true);
    expect(hit.distance).toBeGreaterThan(0);
    expect(hit.distance).toBeLessThan(20);
    expect(hit.point.y).toBeCloseTo(terrain.getHeightAt(5, 5), 1);
  });

  it('retrieves accurate surface friction properties at terrain coordinates', () => {
    const surf = terrain.getSurfaceAt(0, 0);
    expect(surf).toBeDefined();
    expect(surf.friction).toBeGreaterThan(0);
    expect(surf.friction).toBeLessThanOrEqual(1.0);
  });
});
