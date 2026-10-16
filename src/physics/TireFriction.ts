import { clamp, pacejkaFriction } from '../core/MathUtils';

export interface TireContactInput {
  normalLoad: number;         // Newtons from suspension spring
  surfaceFriction: number;    // Multiplier from terrain (e.g. 1.0 rock, 0.35 mud)
  forwardSpeed: number;       // m/s along tire forward vector
  lateralSpeed: number;       // m/s along tire lateral/axle vector
  wheelAngularVelocity: number;// rad/s
  wheelRadius: number;        // meters
  driveTorque: number;        // Nm from engine/drivetrain
  brakeTorque: number;        // Nm from brakes
  isHandbrake: boolean;
}

export interface TireForceOutput {
  longitudinalForce: number;  // Force along tire rolling direction (N)
  lateralForce: number;       // Force perpendicular to rolling direction (N)
  slipRatio: number;          // Wheelspin or skid factor
  slipAngle: number;          // Cornering scrub angle (radians)
  newAngularVelocity: number; // rad/s for next tick
}

export class TireFriction {
  /**
   * Calculate friction forces using friction ellipse and Pacejka curve approximation
   */
  public static computeForces(input: TireContactInput, dt: number): TireForceOutput {
    const {
      normalLoad,
      surfaceFriction,
      forwardSpeed,
      lateralSpeed,
      wheelAngularVelocity,
      wheelRadius,
      driveTorque,
      brakeTorque,
      isHandbrake
    } = input;

    // Zero load = zero grip (wheel in the air)
    if (normalLoad <= 1.0) {
      const freeSpinDelta = (driveTorque / (0.5 * 15 * wheelRadius * wheelRadius)) * dt;
      return {
        longitudinalForce: 0,
        lateralForce: 0,
        slipRatio: 0,
        slipAngle: 0,
        newAngularVelocity: Math.max(0, wheelAngularVelocity + freeSpinDelta)
      };
    }

    const maxTraction = normalLoad * surfaceFriction;

    // Linear speed of wheel surface
    const wheelSurfaceSpeed = wheelAngularVelocity * wheelRadius;

    // Slip ratio calculation
    const speedDenominator = Math.max(Math.abs(forwardSpeed), 0.2);
    const slipRatio = (wheelSurfaceSpeed - forwardSpeed) / speedDenominator;

    // Slip angle calculation (lateral scrub)
    const slipAngle = -Math.atan2(lateralSpeed, speedDenominator);

    // Pacejka normalized responses
    let fx = pacejkaFriction(clamp(slipRatio, -1.5, 1.5), maxTraction);
    let fy = pacejkaFriction(clamp(slipAngle * 2.0, -1.5, 1.5), maxTraction);

    // Apply brake resistance
    if (isHandbrake) {
      fx = -Math.sign(forwardSpeed) * maxTraction;
      fy *= 0.5; // Handbrake reduces lateral grip causing controlled slides
    } else if (brakeTorque > 10) {
      const brakeForce = brakeTorque / wheelRadius;
      const appliedBrake = Math.min(brakeForce, maxTraction);
      fx -= Math.sign(forwardSpeed) * appliedBrake;
    }

    // Friction Ellipse constraint
    const totalForceMag = Math.sqrt(fx * fx + fy * fy);
    if (totalForceMag > maxTraction && totalForceMag > 0.001) {
      const scale = maxTraction / totalForceMag;
      fx *= scale;
      fy *= scale;
    }

    // Wheel rotational inertia integration
    const wheelInertia = 0.5 * 18 * wheelRadius * wheelRadius; // ~18kg offroad wheel
    const netTorque = driveTorque - fx * wheelRadius - (brakeTorque + (isHandbrake ? 1200 : 0)) * Math.sign(wheelAngularVelocity);
    const angularAccel = netTorque / wheelInertia;
    let newAngularVel = wheelAngularVelocity + angularAccel * dt;

    if (isHandbrake) {
      newAngularVel = 0;
    }

    return {
      longitudinalForce: fx,
      lateralForce: fy,
      slipRatio: Math.abs(slipRatio),
      slipAngle,
      newAngularVelocity: newAngularVel
    };
  }
}
