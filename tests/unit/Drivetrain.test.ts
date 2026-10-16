import { describe, it, expect } from 'vitest';
import { Drivetrain } from '../../src/physics/Drivetrain';

describe('Drivetrain', () => {
  it('initializes with default 1st gear and idle RPM', () => {
    const dt = new Drivetrain();
    expect(dt.currentGear).toBe(1);
    expect(dt.currentRPM).toBe(800);
    expect(dt.isLowRange).toBe(false);
    expect(dt.isDiffLocked).toBe(false);
  });

  it('multiplies gear ratio when Low-Range 4L is engaged', () => {
    const dt = new Drivetrain();
    const highRatio = dt.getEffectiveGearRatio();

    dt.toggleLowRange();
    expect(dt.isLowRange).toBe(true);

    const lowRatio = dt.getEffectiveGearRatio();
    expect(lowRatio).toBeCloseTo(highRatio * 2.6);
  });

  it('splits torque evenly in open diff, but transfers power to high-grip wheel when locked', () => {
    const dt = new Drivetrain();
    const totalTorque = 1000;

    // Open diff with one wheel in slick mud (0.1 grip) and one on rock (1.0 grip)
    const openResult = dt.distributeTorque(totalTorque, 0.1, 1.0);
    expect(openResult.leftTorque).toBe(openResult.rightTorque);
    expect(openResult.leftTorque).toBeLessThan(totalTorque * 0.5); // power loss due to slip

    // Now engage Differential Lock
    dt.toggleDiffLock();
    expect(dt.isDiffLocked).toBe(true);

    const lockedResult = dt.distributeTorque(totalTorque, 0.1, 1.0);
    // The wheel on rock (right) should receive the lion's share of torque
    expect(lockedResult.rightTorque).toBeGreaterThan(lockedResult.leftTorque);
    expect(lockedResult.rightTorque).toBeCloseTo(totalTorque * (1.0 / 1.1));
  });

  it('shifts up when RPM exceeds threshold', () => {
    const dt = new Drivetrain();
    dt.currentRPM = 4500;
    dt.update(100, 1.0, 0, 0.1);
    expect(dt.currentGear).toBe(2);
  });
});
