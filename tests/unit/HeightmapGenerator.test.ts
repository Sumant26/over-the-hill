import { describe, it, expect } from 'vitest';
import { HeightmapGenerator } from '../../src/terrain/HeightmapGenerator';

describe('HeightmapGenerator', () => {
  const gen = new HeightmapGenerator(12345);

  it('keeps spawn area around (0, 0) level for smooth vehicle starting', () => {
    const h0 = gen.getHeight(0, 0);
    expect(Math.abs(h0)).toBeLessThan(0.01);

    const hNear = gen.getHeight(5, 5);
    expect(Math.abs(hNear)).toBeLessThan(0.5);
  });

  it('generates varying continuous heights away from origin', () => {
    const hFar1 = gen.getHeight(60, 60);
    const hFar2 = gen.getHeight(120, -80);
    expect(typeof hFar1).toBe('number');
    expect(typeof hFar2).toBe('number');
    expect(hFar1).not.toBe(hFar2);
  });

  it('classifies steep slopes as ROCK', () => {
    const surf = gen.getSurface(100, 100, 7.5); // High peak
    expect(surf.name).toBe('rock');
    expect(surf.friction).toBe(1.0);
  });

  it('samples valid normal vectors pointing generally upward', () => {
    const normal = gen.getNormal(20, 20);
    expect(normal.y).toBeGreaterThan(0.5); // Terrain surface generally faces up
    expect(normal.length()).toBeCloseTo(1.0);
  });
});
