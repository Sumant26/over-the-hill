import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { PhysicsWorld, RaycastHitResult } from './PhysicsWorld';
import { Drivetrain } from './Drivetrain';
import { TireFriction, TireContactInput } from './TireFriction';
import { clamp, damp, normalizeAngle, _tempVecA, _tempVecB, _tempVecC, _tempVecD, _tempQuatA } from '../core/MathUtils';

export interface WheelState {
  mountPoint: THREE.Vector3;     // Local offset from chassis center
  worldPosition: THREE.Vector3;  // Current 3D position of wheel hub
  worldRotation: THREE.Quaternion;// Current 3D orientation
  isGrounded: boolean;
  compression: number;          // Meters compressed (0 = full droop)
  suspensionForce: number;      // Newtons
  steerAngle: number;           // Current steering angle (radians)
  rotationAngle: number;        // Accumulated wheel roll angle (radians)
  angularVelocity: number;      // Rad/sec
  slipRatio: number;
  slipAngle: number;
  contactPoint: THREE.Vector3;
  contactNormal: THREE.Vector3;
  surfaceFriction: number;
  surfaceType: string;
}

export interface VehicleTelemetry {
  speedKmh: number;
  engineRPM: number;
  currentGear: number;
  isLowRange: boolean;
  isDiffLocked: boolean;
  pitchDeg: number;             // + is nose up, - is nose down
  rollDeg: number;              // + is roll right, - is roll left
  wheelsGroundedCount: number;
  isRolledOver: boolean;
}

export class RaycastVehicle {
  public chassisBody!: RAPIER.RigidBody;
  public chassisCollider!: RAPIER.Collider;
  public drivetrain: Drivetrain;

  public wheels: WheelState[] = [];
  public wheelRadius = 0.42;
  public suspensionRestLength = 0.55;
  public springStiffness = 32000;  // N/m
  public damping = 2800;          // Ns/m
  public antiRollStiffness = 6000; // N/m

  private maxSteerAngle = 0.55;   // ~31.5 degrees
  private maxSteerSpeed = 3.5;    // rad/s
  private currentSteer = 0;

  // Cached scratch vectors to ensure zero GC in fixed update
  private _chassisPos = new THREE.Vector3();
  private _chassisQuat = new THREE.Quaternion();
  private _downDir = new THREE.Vector3();
  private _forwardDir = new THREE.Vector3();
  private _rightDir = new THREE.Vector3();
  private _rayHit: RaycastHitResult = {
    hit: false,
    point: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 1, 0),
    distance: 0,
    collider: null
  };

  constructor(
    private physics: PhysicsWorld,
    spawnPosition: THREE.Vector3 = new THREE.Vector3(0, 3, 0)
  ) {
    this.drivetrain = new Drivetrain();
    this.initChassis(spawnPosition);
    this.initWheels();
  }

  private initChassis(spawnPos: THREE.Vector3): void {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y, spawnPos.z)
      .setCanSleep(false)
      .setLinearDamping(0.08)
      .setAngularDamping(0.35);

    this.chassisBody = this.physics.world.createRigidBody(bodyDesc);

    // Chassis dimensions: Width 1.9m, Height 1.1m, Length 4.2m, Mass 1800 kg
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.95, 0.55, 2.1)
      .setMass(1800)
      .setFriction(0.4)
      .setRestitution(0.1);

    this.chassisCollider = this.physics.world.createCollider(colliderDesc, this.chassisBody);
  }

  private initWheels(): void {
    // 0: Front-Left, 1: Front-Right, 2: Rear-Left, 3: Rear-Right
    const mountOffsets = [
      new THREE.Vector3(-0.95, -0.2, 1.4),   // FL
      new THREE.Vector3(0.95, -0.2, 1.4),    // FR
      new THREE.Vector3(-0.95, -0.2, -1.4),  // RL
      new THREE.Vector3(0.95, -0.2, -1.4)    // RR
    ];

    this.wheels = mountOffsets.map((mountPoint) => ({
      mountPoint,
      worldPosition: new THREE.Vector3(),
      worldRotation: new THREE.Quaternion(),
      isGrounded: false,
      compression: 0,
      suspensionForce: 0,
      steerAngle: 0,
      rotationAngle: 0,
      angularVelocity: 0,
      slipRatio: 0,
      slipAngle: 0,
      contactPoint: new THREE.Vector3(),
      contactNormal: new THREE.Vector3(0, 1, 0),
      surfaceFriction: 0.8,
      surfaceType: 'dirt'
    }));
  }

  /**
   * Fixed physics step (called at deterministic 60Hz)
   */
  public update(
    throttle: number,
    brake: number,
    steerInput: number,
    handbrake: boolean,
    dt: number
  ): void {
    // 1. Synchronize chassis transform
    const trans = this.chassisBody.translation();
    const rot = this.chassisBody.rotation();
    this._chassisPos.set(trans.x, trans.y, trans.z);
    this._chassisQuat.set(rot.x, rot.y, rot.z, rot.w);

    // Local chassis axis vectors in world coordinates
    this._downDir.set(0, -1, 0).applyQuaternion(this._chassisQuat);
    this._forwardDir.set(0, 0, 1).applyQuaternion(this._chassisQuat);
    this._rightDir.set(1, 0, 0).applyQuaternion(this._chassisQuat);

    // 2. Smooth steering with speed-dependent sensitivity (A = Left, D = Right)
    const linVel = this.chassisBody.linvel();
    const forwardSpeed = this._forwardDir.x * linVel.x + this._forwardDir.y * linVel.y + this._forwardDir.z * linVel.z;
    const speedRatio = clamp(Math.abs(forwardSpeed) / 15, 0, 1);
    const targetSteerAngle = steerInput * (this.maxSteerAngle * (1 - speedRatio * 0.35));
    this.currentSteer = damp(this.currentSteer, targetSteerAngle, this.maxSteerSpeed * 3.5, dt);

    this.wheels[0].steerAngle = this.currentSteer;
    this.wheels[1].steerAngle = this.currentSteer;

    // 3. Process Suspension Raycasts
    const maxRayDistance = this.suspensionRestLength + this.wheelRadius;

    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i];

      // World position of the suspension mount
      _tempVecA.copy(wheel.mountPoint).applyQuaternion(this._chassisQuat).add(this._chassisPos);

      // Perform Raycast
      this.physics.castRay(_tempVecA, this._downDir, maxRayDistance, this.chassisBody, this._rayHit);

      if (this._rayHit.hit) {
        wheel.isGrounded = true;
        wheel.contactPoint.copy(this._rayHit.point);
        wheel.contactNormal.copy(this._rayHit.normal);

        const currentSuspLength = Math.max(0, this._rayHit.distance - this.wheelRadius);
        const prevCompression = wheel.compression;
        wheel.compression = clamp(this.suspensionRestLength - currentSuspLength, 0, this.suspensionRestLength);

        // Spring-damper force calculation
        const compressionVel = (wheel.compression - prevCompression) / dt;
        const springForce = this.springStiffness * wheel.compression;
        const damperForce = clamp(this.damping * compressionVel, -springForce * 0.8, springForce * 1.5);
        wheel.suspensionForce = Math.max(0, springForce + damperForce);

        // Apply suspension upward impulse at mount point
        const totalImpulse = (wheel.suspensionForce * dt);
        _tempVecB.copy(wheel.contactNormal).multiplyScalar(totalImpulse);
        this.chassisBody.applyImpulseAtPoint(_tempVecB, _tempVecA, true);

        // World position of wheel hub
        wheel.worldPosition.copy(_tempVecA).addScaledVector(this._downDir, currentSuspLength);
      } else {
        wheel.isGrounded = false;
        wheel.compression = 0;
        wheel.suspensionForce = 0;
        wheel.worldPosition.copy(_tempVecA).addScaledVector(this._downDir, this.suspensionRestLength);
      }
    }

    // 4. Anti-Roll Bar Force (Balances left and right wheels to limit body roll)
    this.applyAntiRollBar(0, 1); // Front axle
    this.applyAntiRollBar(2, 3); // Rear axle

    // 5. Update Drivetrain & Distribute Torque
    const avgWheelSpeed = (this.wheels[0].angularVelocity + this.wheels[1].angularVelocity +
                           this.wheels[2].angularVelocity + this.wheels[3].angularVelocity) / 4;

    const isMovingForward = forwardSpeed > 0.6;
    const isMovingBackward = forwardSpeed < -0.6;

    let activeDriveThrottle = 0;
    let activeBrake = 0;

    if (this.drivetrain.currentGear > 0) {
      if (isMovingForward) {
        activeDriveThrottle = throttle;
        activeBrake = brake;
      } else {
        // Stationary or rolling back
        if (brake > 0.1 && throttle <= 0.05) {
          this.drivetrain.currentGear = -1;
          activeDriveThrottle = brake;
          activeBrake = 0;
        } else {
          activeDriveThrottle = throttle;
          activeBrake = 0;
        }
      }
    } else if (this.drivetrain.currentGear === -1) {
      if (isMovingBackward) {
        activeDriveThrottle = brake;
        activeBrake = throttle;
      } else {
        // Stationary or rolling forward
        if (throttle > 0.1 && brake <= 0.05) {
          this.drivetrain.currentGear = 1;
          activeDriveThrottle = throttle;
          activeBrake = 0;
        } else {
          activeDriveThrottle = brake;
          activeBrake = 0;
        }
      }
    }

    this.drivetrain.update(avgWheelSpeed, throttle, brake, dt);

    const engineTorque = this.drivetrain.getEngineTorque(activeDriveThrottle);
    const driveRatio = this.drivetrain.getEffectiveGearRatio();
    const totalAxleTorque = engineTorque * driveRatio;

    // Split between front and rear axles (50/50 4WD)
    const frontAxleTorque = totalAxleTorque * 0.5;
    const rearAxleTorque = totalAxleTorque * 0.5;

    const frontSplit = this.drivetrain.distributeTorque(
      frontAxleTorque,
      this.wheels[0].surfaceFriction * (this.wheels[0].isGrounded ? 1 : 0),
      this.wheels[1].surfaceFriction * (this.wheels[1].isGrounded ? 1 : 0)
    );

    const rearSplit = this.drivetrain.distributeTorque(
      rearAxleTorque,
      this.wheels[2].surfaceFriction * (this.wheels[2].isGrounded ? 1 : 0),
      this.wheels[3].surfaceFriction * (this.wheels[3].isGrounded ? 1 : 0)
    );

    const torques = [frontSplit.leftTorque, frontSplit.rightTorque, rearSplit.leftTorque, rearSplit.rightTorque];

    // 6. Compute Tire Friction & Traction Impulses
    const brakeTorquePerWheel = (activeBrake * 2400) + (throttle === 0 && brake === 0 ? 40 : 0);


    for (let i = 0; i < 4; i++) {
      const wheel = this.wheels[i];

      // Calculate wheel heading vectors
      _tempQuatA.setFromAxisAngle(new THREE.Vector3(0, 1, 0), wheel.steerAngle);
      const wheelForward = _tempVecB.copy(this._forwardDir).applyQuaternion(_tempQuatA);
      const wheelRight = _tempVecC.copy(this._rightDir).applyQuaternion(_tempQuatA);

      // Linear velocity at the contact point: v_p = v_lin + omega x r
      const linvel = this.chassisBody.linvel();
      const angvel = this.chassisBody.angvel();
      _tempVecD.copy(wheel.contactPoint).sub(this._chassisPos);
      
      const pointVelX = linvel.x + (angvel.y * _tempVecD.z - angvel.z * _tempVecD.y);
      const pointVelY = linvel.y + (angvel.z * _tempVecD.x - angvel.x * _tempVecD.z);
      const pointVelZ = linvel.z + (angvel.x * _tempVecD.y - angvel.y * _tempVecD.x);

      const forwardVel = wheelForward.x * pointVelX + wheelForward.y * pointVelY + wheelForward.z * pointVelZ;
      const lateralVel = wheelRight.x * pointVelX + wheelRight.y * pointVelY + wheelRight.z * pointVelZ;

      const tireInput: TireContactInput = {
        normalLoad: wheel.suspensionForce,
        surfaceFriction: wheel.surfaceFriction,
        forwardSpeed: forwardVel,
        lateralSpeed: lateralVel,
        wheelAngularVelocity: wheel.angularVelocity,
        wheelRadius: this.wheelRadius,
        driveTorque: torques[i],
        brakeTorque: brakeTorquePerWheel,
        isHandbrake: handbrake && i >= 2 // Handbrake on rear wheels
      };

      const tireForces = TireFriction.computeForces(tireInput, dt);

      wheel.angularVelocity = tireForces.newAngularVelocity;
      wheel.rotationAngle = normalizeAngle(wheel.rotationAngle + wheel.angularVelocity * dt);
      wheel.slipRatio = tireForces.slipRatio;
      wheel.slipAngle = tireForces.slipAngle;

      if (wheel.isGrounded) {
        // Apply longitudinal and lateral reaction forces to chassis
        const impulseFx = wheelForward.multiplyScalar(tireForces.longitudinalForce * dt);
        const impulseFy = wheelRight.multiplyScalar(tireForces.lateralForce * dt);
        const netImpulse = impulseFx.add(impulseFy);

        this.chassisBody.applyImpulseAtPoint(netImpulse, wheel.contactPoint, true);
      }

      // Visual orientation
      wheel.worldRotation.copy(this._chassisQuat)
        .multiply(_tempQuatA)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wheel.rotationAngle));
    }
  }

  private applyAntiRollBar(leftIdx: number, rightIdx: number): void {
    const leftWheel = this.wheels[leftIdx];
    const rightWheel = this.wheels[rightIdx];

    const travelDiff = leftWheel.compression - rightWheel.compression;
    const arbForce = travelDiff * this.antiRollStiffness;

    if (leftWheel.isGrounded) {
      leftWheel.suspensionForce = Math.max(0, leftWheel.suspensionForce - arbForce);
    }
    if (rightWheel.isGrounded) {
      rightWheel.suspensionForce = Math.max(0, rightWheel.suspensionForce + arbForce);
    }
  }

  /**
   * Telemetry for HUD (Inclinometer, Speedometer, RPM)
   */
  public getTelemetry(): VehicleTelemetry {
    const rot = this.chassisBody.rotation();
    this._chassisQuat.set(rot.x, rot.y, rot.z, rot.w);
    this._forwardDir.set(0, 0, 1).applyQuaternion(this._chassisQuat);

    // Compute Pitch and Roll angles in degrees
    const euler = new THREE.Euler().setFromQuaternion(this._chassisQuat, 'YXZ');
    const pitchDeg = THREE.MathUtils.radToDeg(euler.x);
    const rollDeg = THREE.MathUtils.radToDeg(euler.z);

    const linvel = this.chassisBody.linvel();
    const speedMs = Math.sqrt(linvel.x * linvel.x + linvel.y * linvel.y + linvel.z * linvel.z);
    const speedKmh = Math.round(speedMs * 3.6);

    const groundedCount = this.wheels.reduce((acc, w) => acc + (w.isGrounded ? 1 : 0), 0);
    const isRolledOver = Math.abs(rollDeg) > 75 || Math.abs(pitchDeg) > 75;

    return {
      speedKmh,
      engineRPM: Math.round(this.drivetrain.currentRPM),
      currentGear: this.drivetrain.currentGear,
      isLowRange: this.drivetrain.isLowRange,
      isDiffLocked: this.drivetrain.isDiffLocked,
      pitchDeg: Math.round(pitchDeg),
      rollDeg: Math.round(rollDeg),
      wheelsGroundedCount: groundedCount,
      isRolledOver
    };
  }

  /**
   * Reset vehicle upright at a safe altitude
   */
  public reset(spawnPos = new THREE.Vector3(0, 2, 0)): void {
    this.chassisBody.setTranslation(spawnPos, true);
    this.chassisBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.chassisBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.chassisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    this.wheels.forEach((w) => {
      w.angularVelocity = 0;
      w.rotationAngle = 0;
      w.compression = 0;
    });
  }
}
