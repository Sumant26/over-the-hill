import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { RaycastVehicle } from '../physics/RaycastVehicle';
import { VehicleModel, VehicleArchetype } from './VehicleModel';

export interface ConvoyMember {
  id: number;
  name: string;
  vehicle: RaycastVehicle;
  model: VehicleModel;
  colorName: string;
  isPlayerControlled: boolean;
}

export class ConvoyManager {
  public members: ConvoyMember[] = [];
  public activeVehicleIndex = 0;
  public isCoopMode = false;

  private _scratchVecA = new THREE.Vector3();
  private _scratchVecB = new THREE.Vector3();
  private _scratchQuat = new THREE.Quaternion();

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsWorld,
    playerVehicle: RaycastVehicle,
    playerModel: VehicleModel
  ) {
    // 1. Register Lead Player Vehicle (Vehicle 0: Terracotta FJ40)
    this.members.push({
      id: 0,
      name: 'Truck 1 (Lead FJ40)',
      vehicle: playerVehicle,
      model: playerModel,
      colorName: 'Terracotta Orange',
      isPlayerControlled: true
    });

    // 2. Spawn Companion Convoy Vehicles (matching Image 2 & 3)
    this.spawnCompanion(1, 'Truck 2 (Overland Cooler)', 1, 'cooler', new THREE.Vector3(-4.5, 2.4, -9.0));
    this.spawnCompanion(2, 'Truck 3 (Wagon with Kayak)', 2, 'kayak', new THREE.Vector3(4.5, 2.4, -18.0));
    this.spawnCompanion(3, 'Truck 4 (Safari Pickup)', 5, 'pickup', new THREE.Vector3(0.0, 2.4, -27.0));
  }

  private spawnCompanion(
    id: number,
    name: string,
    paletteIndex: number,
    archetype: VehicleArchetype,
    spawnOffset: THREE.Vector3
  ): void {
    const leadPos = this.members[0].vehicle.chassisBody.translation();
    const spawnPos = new THREE.Vector3(leadPos.x + spawnOffset.x, leadPos.y + spawnOffset.y, leadPos.z + spawnOffset.z);

    const vehicle = new RaycastVehicle(this.physics, spawnPos);
    const model = new VehicleModel(vehicle, this.scene, { paletteIndex, archetype });

    this.members.push({
      id,
      name,
      vehicle,
      model,
      colorName: VehicleModel.COLOR_PALETTES[paletteIndex].name,
      isPlayerControlled: false
    });
  }

  public getActiveMember(): ConvoyMember {
    return this.members[this.activeVehicleIndex];
  }

  public getActiveVehicle(): RaycastVehicle {
    return this.members[this.activeVehicleIndex].vehicle;
  }

  public getActiveModel(): VehicleModel {
    return this.members[this.activeVehicleIndex].model;
  }

  /**
   * Cycle active vehicle control (Single Player Mode)
   */
  public cycleNextVehicle(): ConvoyMember {
    this.activeVehicleIndex = (this.activeVehicleIndex + 1) % this.members.length;
    this.updateControlFlags();
    return this.getActiveMember();
  }

  public selectVehicle(index: number): ConvoyMember {
    if (index >= 0 && index < this.members.length) {
      this.activeVehicleIndex = index;
      this.updateControlFlags();
    }
    return this.getActiveMember();
  }

  public toggleCoopMode(): boolean {
    this.isCoopMode = !this.isCoopMode;
    this.updateControlFlags();
    return this.isCoopMode;
  }

  private updateControlFlags(): void {
    for (let i = 0; i < this.members.length; i++) {
      if (i === this.activeVehicleIndex) {
        this.members[i].isPlayerControlled = true;
      } else if (this.isCoopMode && i === 1) {
        this.members[i].isPlayerControlled = true; // Controlled by Player 2
      } else {
        this.members[i].isPlayerControlled = false;
      }
    }
  }

  /**
   * Fixed physics step update for all convoy vehicles
   */
  public updatePhysics(
    p1Throttle: number,
    p1Brake: number,
    p1Steer: number,
    p1Handbrake: boolean,
    p2Throttle: number,
    p2Brake: number,
    p2Steer: number,
    p2Handbrake: boolean,
    fixedDt: number
  ): void {
    for (let i = 0; i < this.members.length; i++) {
      const member = this.members[i];

      if (i === this.activeVehicleIndex) {
        // Player 1 controls Active Vehicle
        member.vehicle.update(p1Throttle, p1Brake, p1Steer, p1Handbrake, fixedDt);
      } else if (this.isCoopMode && i === 1) {
        // Player 2 controls Vehicle 1 in Co-op mode
        member.vehicle.update(p2Throttle, p2Brake, p2Steer, p2Handbrake, fixedDt);
      } else {
        // Autonomous Convoy Follow AI
        this.updateFollowAI(member, i, fixedDt);
      }
    }
  }

  /**
   * Autonomous Follow AI: vehicles maintain formation behind the leader or truck ahead
   */
  private updateFollowAI(member: ConvoyMember, memberIdx: number, fixedDt: number): void {
    // Follow the vehicle immediately ahead in the convoy line
    const targetLeader = this.members[memberIdx - 1] ?? this.members[0];

    const leaderTrans = targetLeader.vehicle.chassisBody.translation();
    const leaderRot = targetLeader.vehicle.chassisBody.rotation();
    this._scratchQuat.set(leaderRot.x, leaderRot.y, leaderRot.z, leaderRot.w);

    const leaderForward = this._scratchVecA.set(0, 0, 1).applyQuaternion(this._scratchQuat);

    // Target position is 7.5 meters behind the leader with slight stagger
    const stagger = memberIdx % 2 === 0 ? 1.8 : -1.8;
    const leaderRight = this._scratchVecB.set(1, 0, 0).applyQuaternion(this._scratchQuat);

    const targetPos = new THREE.Vector3(
      leaderTrans.x - leaderForward.x * 7.5 + leaderRight.x * stagger,
      leaderTrans.y,
      leaderTrans.z - leaderForward.z * 7.5 + leaderRight.z * stagger
    );

    const myTrans = member.vehicle.chassisBody.translation();
    const myRot = member.vehicle.chassisBody.rotation();
    const myQuat = new THREE.Quaternion(myRot.x, myRot.y, myRot.z, myRot.w);
    const myForward = new THREE.Vector3(0, 0, 1).applyQuaternion(myQuat);
    const myRight = new THREE.Vector3(1, 0, 0).applyQuaternion(myQuat);

    // Vector to target follow position
    const toTarget = new THREE.Vector3(targetPos.x - myTrans.x, 0, targetPos.z - myTrans.z);
    const distToTarget = toTarget.length();

    let throttle = 0;
    let brake = 0;
    let steer = 0;

    if (distToTarget > 3.0) {
      toTarget.normalize();
      const dotForward = myForward.dot(toTarget);
      const dotRight = myRight.dot(toTarget);

      steer = Math.max(-1.0, Math.min(1.0, dotRight * 2.2));

      if (dotForward > 0.1) {
        // Accelerate toward target; scale throttle by distance
        const desiredSpeed = Math.min(1.0, distToTarget * 0.15);
        throttle = desiredSpeed;
      } else {
        // Facing away, turn hard
        throttle = 0.35;
      }

      // Check distance directly to leader vehicle to avoid collision
      const distToLeader = new THREE.Vector3(leaderTrans.x - myTrans.x, 0, leaderTrans.z - myTrans.z).length();
      if (distToLeader < 5.0) {
        throttle = 0;
        brake = 0.8;
      }
    } else {
      // Reached follow distance, idle or slight brake
      brake = 0.3;
    }

    member.vehicle.update(throttle, brake, steer, false, fixedDt);
  }

  /**
   * Render frame update to synchronize visual meshes
   */
  public updateVisuals(): void {
    for (const member of this.members) {
      member.model.update();
    }
  }

  /**
   * Collect all bumpers and anchor points from all vehicles for vehicle-to-vehicle winching
   */
  public getConvoyWinchAnchors(excludeVehicle: RaycastVehicle): THREE.Vector3[] {
    const anchors: THREE.Vector3[] = [];
    const _pos = new THREE.Vector3();

    for (const member of this.members) {
      if (member.vehicle === excludeVehicle) continue;
      member.model.getBumperWorldPosition(_pos);
      anchors.push(_pos.clone());

      // Rear recovery point
      const trans = member.vehicle.chassisBody.translation();
      const rot = member.vehicle.chassisBody.rotation();
      const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
      const rearPos = new THREE.Vector3(0, 0.25, -2.1).applyQuaternion(q).add(new THREE.Vector3(trans.x, trans.y, trans.z));
      anchors.push(rearPos);
    }
    return anchors;
  }
}
