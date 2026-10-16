import { describe, it, expect } from 'vitest';
import { TireFriction, TireContactInput } from '../../src/physics/TireFriction';

describe('TireFriction', () => {
  it('returns zero forces when normal load is zero (wheel airborne)', () => {
    const input: TireContactInput = {
      normalLoad: 0,
      surfaceFriction: 1.0,
      forwardSpeed: 10,
      lateralSpeed: 0,
      wheelAngularVelocity: 25,
      wheelRadius: 0.4,
      driveTorque: 0,
      brakeTorque: 0,
      isHandbrake: false
    };

    const out = TireFriction.computeForces(input, 0.016);
    expect(out.longitudinalForce).toBe(0);
    expect(out.lateralForce).toBe(0);
  });

  it('generates forward longitudinal force when driving torque causes positive slip', () => {
    const input: TireContactInput = {
      normalLoad: 4000,
      surfaceFriction: 0.8,
      forwardSpeed: 5,
      lateralSpeed: 0,
      wheelAngularVelocity: 18, // wheel surface speed = 18 * 0.4 = 7.2 > 5
      wheelRadius: 0.4,
      driveTorque: 500,
      brakeTorque: 0,
      isHandbrake: false
    };

    const out = TireFriction.computeForces(input, 0.016);
    expect(out.longitudinalForce).toBeGreaterThan(0);
  });

  it('strictly obeys the friction circle limit', () => {
    const normalLoad = 5000;
    const surfaceFriction = 0.5;
    const maxTraction = normalLoad * surfaceFriction;

    const input: TireContactInput = {
      normalLoad,
      surfaceFriction,
      forwardSpeed: 10,
      lateralSpeed: 8, // high side-slip
      wheelAngularVelocity: 50, // high wheelspin
      wheelRadius: 0.4,
      driveTorque: 2000,
      brakeTorque: 0,
      isHandbrake: false
    };

    const out = TireFriction.computeForces(input, 0.016);
    const combinedForce = Math.sqrt(out.longitudinalForce ** 2 + out.lateralForce ** 2);
    expect(combinedForce).toBeLessThanOrEqual(maxTraction + 1e-3);
  });
});
