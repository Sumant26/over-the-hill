import { describe, it, expect } from 'vitest';
import { clamp, lerp, damp, pacejkaFriction, normalizeAngle } from '../../src/core/MathUtils';

describe('MathUtils', () => {
  it('correctly clamps numbers between boundaries', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('performs linear interpolation', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('damps value smoothly towards target without overshoot', () => {
    const val = damp(0, 10, 5, 0.016);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(10);
  });

  it('computes Pacejka curve with zero force at zero slip', () => {
    const zeroSlip = pacejkaFriction(0, 1.0);
    expect(Math.abs(zeroSlip)).toBeLessThan(1e-5);

    const moderateSlip = pacejkaFriction(0.15, 1.0);
    expect(moderateSlip).toBeGreaterThan(0.5);
    expect(moderateSlip).toBeLessThanOrEqual(1.1);
  });

  it('normalizes angles within [-PI, PI]', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI);
  });
});
