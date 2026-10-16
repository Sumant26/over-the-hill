import { clamp } from '../core/MathUtils';

export interface DrivetrainConfig {
  idleRPM?: number;
  maxRPM?: number;
  gearRatios?: number[];
  reverseRatio?: number;
  finalDriveRatio?: number;
  lowRangeMultiplier?: number;
}

export class Drivetrain {
  public idleRPM: number;
  public maxRPM: number;
  public gearRatios: number[];
  public reverseRatio: number;
  public finalDriveRatio: number;
  public lowRangeMultiplier: number;

  public currentGear: number = 1; // 1, 2, 3, 4, or -1 (Reverse)
  public isLowRange: boolean = false;
  public isDiffLocked: boolean = false;
  public currentRPM: number;

  constructor(config: DrivetrainConfig = {}) {
    this.idleRPM = config.idleRPM ?? 800;
    this.maxRPM = config.maxRPM ?? 5500;
    this.gearRatios = config.gearRatios ?? [3.8, 2.3, 1.4, 1.0];
    this.reverseRatio = config.reverseRatio ?? 3.5;
    this.finalDriveRatio = config.finalDriveRatio ?? 3.73;
    this.lowRangeMultiplier = config.lowRangeMultiplier ?? 2.6;
    this.currentRPM = this.idleRPM;
  }

  public toggleLowRange(): boolean {
    this.isLowRange = !this.isLowRange;
    return this.isLowRange;
  }

  public toggleDiffLock(): boolean {
    this.isDiffLocked = !this.isDiffLocked;
    return this.isDiffLocked;
  }

  /**
   * Get total gear ratio from engine to wheel axles
   */
  public getEffectiveGearRatio(): number {
    let ratio: number;
    if (this.currentGear === -1) {
      ratio = -this.reverseRatio;
    } else {
      const idx = clamp(this.currentGear - 1, 0, this.gearRatios.length - 1);
      ratio = this.gearRatios[idx];
    }

    const tcase = this.isLowRange ? this.lowRangeMultiplier : 1.0;
    return ratio * tcase * this.finalDriveRatio;
  }

  /**
   * Calculate engine torque curve based on RPM (supports off-road crawling torque)
   */
  public getEngineTorque(throttle: number): number {
    if (throttle <= 0.01) return 0;

    // Strong off-road low-end torque with peak at 2600 RPM
    const normRPM = (this.currentRPM - this.idleRPM) / (this.maxRPM - this.idleRPM);
    const torqueCurve = Math.sin(Math.PI * clamp(normRPM, 0, 1));
    const baseTorque = 480; // Nm peak torque for heavy 4x4 trail truck

    return throttle * (baseTorque * (0.75 + 0.35 * torqueCurve));
  }

  /**
   * Update engine RPM and automatic transmission gear selection
   */
  public update(wheelSpeedRadPerSec: number, throttle: number, brake: number, dt: number): void {
    const effectiveRatio = Math.abs(this.getEffectiveGearRatio());
    const targetRPM = Math.abs(wheelSpeedRadPerSec) * effectiveRatio * (60 / (2 * Math.PI));

    const activeThrottle = this.currentGear === -1 ? brake : throttle;

    // Smooth RPM response
    const targetWithThrottle = Math.max(
      this.idleRPM,
      activeThrottle > 0.05 ? Math.max(targetRPM, this.idleRPM + activeThrottle * 1800) : targetRPM
    );

    this.currentRPM += (clamp(targetWithThrottle, this.idleRPM, this.maxRPM) - this.currentRPM) * Math.min(1, dt * 12);

    // Automatic gear shifting logic
    if (this.currentGear > 0) {
      // Shift to reverse if braking while stationary or rolling backwards
      if (brake > 0.3 && wheelSpeedRadPerSec <= 0.5 && throttle <= 0.05) {
        this.currentGear = -1;
      } else if (this.currentRPM > 4200 && this.currentGear < this.gearRatios.length) {
        this.currentGear++;
      } else if (this.currentRPM < 1800 && this.currentGear > 1) {
        this.currentGear--;
      }
    } else if (this.currentGear === -1) {
      // Shift back to forward 1st gear if pressing forward throttle while stationary or rolling forward
      if (throttle > 0.3 && wheelSpeedRadPerSec >= -0.5 && brake <= 0.05) {
        this.currentGear = 1;
      }
    }
  }

  /**
   * Distribute drive torque to left and right wheels
   */
  public distributeTorque(
    totalDriveTorque: number,
    leftGrip: number,
    rightGrip: number
  ): { leftTorque: number; rightTorque: number } {
    if (this.isDiffLocked) {
      // Locked diff: torque shifts to the wheel with more grip
      const totalGrip = leftGrip + rightGrip;
      if (totalGrip < 0.01) {
        return { leftTorque: totalDriveTorque * 0.5, rightTorque: totalDriveTorque * 0.5 };
      }
      return {
        leftTorque: totalDriveTorque * (leftGrip / totalGrip),
        rightTorque: totalDriveTorque * (rightGrip / totalGrip)
      };
    } else {
      // Open diff: limited by the slipping wheel
      const minGrip = Math.min(leftGrip, rightGrip);
      const openLimitFactor = clamp(minGrip * 2, 0.15, 1.0);
      const halfTorque = (totalDriveTorque * 0.5) * openLimitFactor;
      return { leftTorque: halfTorque, rightTorque: halfTorque };
    }
  }
}

