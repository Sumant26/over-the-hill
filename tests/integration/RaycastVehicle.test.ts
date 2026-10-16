import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { PhysicsWorld } from '../../src/physics/PhysicsWorld';
import { RaycastVehicle } from '../../src/physics/RaycastVehicle';

describe('RaycastVehicle Integration', () => {
  let physics: PhysicsWorld;
  let vehicle: RaycastVehicle;

  beforeAll(async () => {
    physics = new PhysicsWorld();
    await physics.init();
    physics.createGroundPlane(100, 100, 0);
    vehicle = new RaycastVehicle(physics, new THREE.Vector3(0, 1.5, 0));
  });

  it('settles onto ground plane with all 4 wheels compressed at equilibrium', () => {
    // Step simulation for 60 ticks (1 second) to allow vehicle to settle on suspension
    for (let i = 0; i < 60; i++) {
      vehicle.update(0, 0, 0, false, 0.016);
      physics.step(0.016);
    }

    const telemetry = vehicle.getTelemetry();
    expect(telemetry.wheelsGroundedCount).toBe(4);
    expect(vehicle.chassisBody.translation().y).toBeGreaterThan(0.2);
    expect(vehicle.chassisBody.translation().y).toBeLessThan(1.5);
    expect(telemetry.isRolledOver).toBe(false);
  });

  it('accelerates forward when throttle is applied', () => {
    // Apply full throttle for 40 ticks
    for (let i = 0; i < 40; i++) {
      vehicle.update(1.0, 0, 0, false, 0.016);
      physics.step(0.016);
    }

    const telemetry = vehicle.getTelemetry();
    expect(telemetry.speedKmh).toBeGreaterThan(0);
    expect(vehicle.chassisBody.translation().z).toBeGreaterThan(0.1);
  });

  it('resets to origin and stops motion', () => {
    vehicle.reset(new THREE.Vector3(0, 2, 0));
    const linvel = vehicle.chassisBody.linvel();
    expect(linvel.x).toBe(0);
    expect(linvel.y).toBe(0);
    expect(linvel.z).toBe(0);
  });
});
