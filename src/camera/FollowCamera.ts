import * as THREE from 'three';
import { damp } from '../core/MathUtils';

export interface CameraModeConfig {
  name: string;
  distance: number;
  height: number;
  pitch: number;
  baseFov: number;
  damping: number;
  lookAhead: number;
}

export class FollowCamera {
  public camera: THREE.PerspectiveCamera;

  private targetPos = new THREE.Vector3();
  private currentPos = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();

  public currentModeIndex = 0;
  public modes: CameraModeConfig[] = [
    {
      name: 'Over the Hill (Cinematic)',
      distance: 11.5,
      height: 5.8,
      pitch: 0.28,
      baseFov: 44,
      damping: 4.2,
      lookAhead: 2.2
    },
    {
      name: 'Close Trail Action',
      distance: 7.2,
      height: 3.4,
      pitch: 0.15,
      baseFov: 52,
      damping: 5.5,
      lookAhead: 1.2
    },
    {
      name: 'Overhead Scout Drone',
      distance: 19.0,
      height: 18.5,
      pitch: 0.85,
      baseFov: 36,
      damping: 3.5,
      lookAhead: 0.5
    }
  ];

  // Camera settings
  public orbitYaw = 0;
  public orbitPitch = 0.25;

  private isDragging = false;
  private prevMouseX = 0;
  private prevMouseY = 0;

  constructor(aspect = window.innerWidth / window.innerHeight) {
    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 1000);
    this.orbitPitch = this.modes[0].pitch;
    this.initMouseControls();
  }

  public cycleCameraMode(): string {
    this.currentModeIndex = (this.currentModeIndex + 1) % this.modes.length;
    this.orbitPitch = this.modes[this.currentModeIndex].pitch;
    return this.modes[this.currentModeIndex].name;
  }

  public getActiveModeName(): string {
    return this.modes[this.currentModeIndex].name;
  }

  private initMouseControls(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouseX;
      const dy = e.clientY - this.prevMouseY;

      this.orbitYaw -= dx * 0.005;
      this.orbitPitch = Math.max(-0.2, Math.min(1.2, this.orbitPitch + dy * 0.005));

      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('wheel', (e) => {
      const mode = this.modes[this.currentModeIndex];
      mode.distance = Math.max(4.0, Math.min(26.0, mode.distance + e.deltaY * 0.008));
    });
  }

  /**
   * Update chase camera tracking vehicle with pitch and speed compensation
   */
  public update(
    vehiclePos: THREE.Vector3,
    vehicleForward: THREE.Vector3,
    vehiclePitchDeg: number,
    speedKmh: number,
    dt: number
  ): void {
    const mode = this.modes[this.currentModeIndex];

    // 1. Desired look target ahead of vehicle
    this.lookTarget.copy(vehiclePos).addScaledVector(vehicleForward, mode.lookAhead);
    this.lookTarget.y += 0.8;

    // 2. Base camera follow position behind vehicle
    const angle = Math.atan2(vehicleForward.x, vehicleForward.z) + this.orbitYaw;

    // Pitch compensation: raise camera when climbing steep hill
    const pitchOffset = Math.max(0, vehiclePitchDeg * 0.06);
    const targetHeight = mode.height + pitchOffset + Math.sin(this.orbitPitch) * 4.5;
    const horizontalDist = mode.distance * Math.cos(this.orbitPitch);

    const targetX = vehiclePos.x - Math.sin(angle) * horizontalDist;
    const targetZ = vehiclePos.z - Math.cos(angle) * horizontalDist;
    const targetY = vehiclePos.y + targetHeight;

    this.targetPos.set(targetX, targetY, targetZ);

    // Initial snap
    if (this.currentPos.lengthSq() < 0.01) {
      this.currentPos.copy(this.targetPos);
    } else {
      // Smooth exponential damping
      this.currentPos.x = damp(this.currentPos.x, this.targetPos.x, mode.damping, dt);
      this.currentPos.y = damp(this.currentPos.y, this.targetPos.y, mode.damping * 1.2, dt);
      this.currentPos.z = damp(this.currentPos.z, this.targetPos.z, mode.damping, dt);
    }

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.lookTarget);

    // Dynamic FOV scaling with speed
    const targetFov = mode.baseFov + Math.min(10, speedKmh * 0.15);
    this.camera.fov = damp(this.camera.fov, targetFov, 2.5, dt);
    this.camera.updateProjectionMatrix();
  }

  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
