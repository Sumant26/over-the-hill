import * as THREE from 'three';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { RaycastVehicle } from './physics/RaycastVehicle';
import { Winch } from './physics/Winch';
import { TerrainManager } from './terrain/TerrainManager';
import { RoadSystem } from './terrain/RoadSystem';
import { VehicleModel } from './entities/VehicleModel';
import { ConvoyManager } from './entities/ConvoyManager';
import { CampAndProps } from './entities/CampAndProps';
import { WinchCableMesh } from './entities/WinchCableMesh';
import { FoliageManager } from './entities/FoliageManager';
import { ParticleManager } from './entities/ParticleManager';
import { FollowCamera } from './camera/FollowCamera';
import { Environment } from './scene/Environment';
import { SoundManager } from './audio/SoundManager';
import { InputManager } from './core/InputManager';
import { Inclinometer } from './ui/Inclinometer';
import { GaugeCluster } from './ui/GaugeCluster';
import { GameLoop } from './core/GameLoop';

export async function bootstrapApp(): Promise<void> {
  const container = document.getElementById('canvas-container') || document.body;

  // 1. Three.js Renderer Setup
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // 2. Physics Engine Initialization
  const physics = new PhysicsWorld();
  await physics.init();

  // 3. Environment & Atmospheric Lighting
  const environment = new Environment(scene);

  // 4. Terrain System
  const terrain = new TerrainManager(scene, physics, 888);

  // 4b. Road Network (Winding dirt & gravel trails matching Image 2 & 3)
  const roads = new RoadSystem(scene, terrain.heightmap);

  // 4c. Base Camp, Animated Campfire & Trail Obstacles
  const campAndProps = new CampAndProps(scene, terrain.heightmap);

  // 5. Foliage, Landmarks & Boulders
  const foliage = new FoliageManager(scene, terrain.heightmap, 550, 320);

  // 6. Lead Expedition Vehicle & Visual Model
  const spawnPos = new THREE.Vector3(0, 2.4, 0);
  const leadVehicle = new RaycastVehicle(physics, spawnPos);
  const leadModel = new VehicleModel(leadVehicle, scene, { paletteIndex: 0, archetype: 'fj40' });

  // 6b. Expedition Convoy & Multiplayer Manager (Fleet of 4 vehicles: FJ40, Cooler Truck, Kayak Wagon, Pickup)
  const convoy = new ConvoyManager(scene, physics, leadVehicle, leadModel);

  // Initial terrain chunks around spawn point
  terrain.updatePlayerPosition(spawnPos, 2);
  physics.step(0.016); // Warm up physics pipeline

  // 7. Mechanical Winch & 3D Cable
  const winch = new Winch();
  const winchCableMesh = new WinchCableMesh(scene);

  // 8. Particle Effects Manager (Dust, Mud, Water, Exhaust)
  const particles = new ParticleManager(scene);

  // 9. Follow Camera (Over the Hill signature tilt-shift)
  const followCamera = new FollowCamera(window.innerWidth / window.innerHeight);

  // 10. Audio Engine & Input Manager
  const sound = new SoundManager();
  const inputManager = new InputManager();

  // 11. UI Cockpit HUDs
  const inclinometer = new Inclinometer();
  const gaugeCluster = new GaugeCluster();

  // Scratch vectors to ensure zero GC in loops
  const _bumperPos = new THREE.Vector3();
  const _exhaustPos = new THREE.Vector3();
  const _vehicleForward = new THREE.Vector3();
  const _chassisQuat = new THREE.Quaternion();
  let elapsedTime = 0;

  // Window resize handler
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    followCamera.onResize(window.innerWidth, window.innerHeight);
  });

  // 12. Decoupled Game Loop
  const gameLoop = new GameLoop(
    // Fixed Physics Update (60Hz)
    (fixedDt) => {
      const inputs = inputManager.update();

      // Convoy Vehicle Switching (TAB or keys 1..4)
      if (inputs.switchNextVehicle) {
        const next = convoy.cycleNextVehicle();
        gaugeCluster.showNotification(next.name, `Driving: ${next.colorName}`);
      }
      if (inputs.selectVehicleIndex !== null) {
        const member = convoy.selectVehicle(inputs.selectVehicleIndex);
        gaugeCluster.showNotification(member.name, `Driving: ${member.colorName}`);
      }

      // 2-Player Co-op Mode Toggle (Key K)
      if (inputs.toggleCoop) {
        const coop = convoy.toggleCoopMode();
        gaugeCluster.showNotification(
          coop ? '2-Player Co-op Active: P1 (WASD) | P2 (Arrow Keys)' : 'Expedition Convoy AI Active (Auto-Follow)',
          'Multiplayer Mode'
        );
      }

      const activeMember = convoy.getActiveMember();
      const activeVehicle = activeMember.vehicle;
      const activeModel = activeMember.model;

      // Handle Vehicle Systems for Active Vehicle
      if (inputs.toggleDiffLock) {
        const locked = activeVehicle.drivetrain.toggleDiffLock();
        gaugeCluster.showNotification(locked ? 'Diff Locked (Equal Torque)' : 'Diff Open (Standard Traction)');
      }
      if (inputs.toggleLowRange) {
        const low = activeVehicle.drivetrain.toggleLowRange();
        gaugeCluster.showNotification(low ? '4WD Low (Max Crawl Torque)' : '4WD High (Standard Trail)');
      }
      if (inputs.toggleAudio) {
        sound.toggleMute();
      }
      if (inputs.toggleCamera) {
        const mode = followCamera.cycleCameraMode();
        gaugeCluster.showNotification(mode, 'Camera Mode Switched');
      }
      if (inputs.toggleTimeOfDay) {
        const timeName = environment.cycleTimeOfDay();
        gaugeCluster.showNotification(timeName, 'Time of Day Changed');
      }
      if (inputs.togglePaintColor) {
        const paletteName = activeModel.cycleColorPalette();
        gaugeCluster.showNotification(paletteName, 'Vehicle Color Switched');
      }

      const trans = activeVehicle.chassisBody.translation();
      const rot = activeVehicle.chassisBody.rotation();
      _chassisQuat.set(rot.x, rot.y, rot.z, rot.w);
      _vehicleForward.set(0, 0, 1).applyQuaternion(_chassisQuat);

      const currentPos = new THREE.Vector3(trans.x, trans.y, trans.z);

      if (inputs.toggleRecoveryBoards) {
        foliage.deployRecoveryBoard(currentPos, _vehicleForward);
        gaugeCluster.showNotification('Traction Boards Deployed', '+1.1 Surface Grip');
        for (let i = 0; i < 4; i++) {
          activeVehicle.wheels[i].surfaceFriction = 1.1;
        }
      }

      if (inputs.resetVehicle) {
        const curY = terrain.getHeightAt(trans.x, trans.z);
        activeVehicle.reset(new THREE.Vector3(trans.x, Math.max(trans.y, curY) + 2.2, trans.z));
        gaugeCluster.showNotification('Vehicle Reset Upright', 'Orientation Restored');
      }

      // Winch Toggle Logic (can attach to trees, rocks, bridge, or OTHER CONVOY TRUCKS!)
      activeModel.getBumperWorldPosition(_bumperPos);

      if (inputs.winchAttachToggle) {
        if (winch.isAttached) {
          winch.release();
          gaugeCluster.showNotification('Winch Released', 'Cable Retracted');
        } else {
          const candidateAnchors = [
            ...foliage.getCandidateAnchors(),
            ...convoy.getConvoyWinchAnchors(activeVehicle)
          ];
          const bestAnchor = winch.findBestAnchor(_bumperPos, _vehicleForward, candidateAnchors);
          if (bestAnchor) {
            winch.attach(bestAnchor, _bumperPos);
            gaugeCluster.showNotification('Winch Attached!', 'Hold [F] to Spool In, [V] to Slack');
          }
        }
      }

      // Winch Physics Update
      winch.update(
        activeVehicle.chassisBody,
        currentPos,
        _chassisQuat,
        inputs.winchPull,
        inputs.winchRelease,
        fixedDt
      );

      // Update Surface Properties for wheels of all convoy members
      for (const m of convoy.members) {
        for (let i = 0; i < 4; i++) {
          const wheel = m.vehicle.wheels[i];
          if (wheel.isGrounded) {
            if (roads.isNearRoad(wheel.contactPoint.x, wheel.contactPoint.z, 2.2)) {
              wheel.surfaceFriction = 0.95; // Smooth road grip
              wheel.surfaceType = 'road';
            } else {
              const surf = terrain.getSurfaceAt(wheel.contactPoint.x, wheel.contactPoint.z);
              wheel.surfaceFriction = surf.friction;
              wheel.surfaceType = surf.name;
            }
          }
        }
      }

      // Step all convoy vehicles simultaneously (Player 1 + Player 2 or AI follow)
      convoy.updatePhysics(
        inputs.throttle,
        inputs.brake,
        inputs.steer,
        inputs.handbrake,
        inputs.p2Throttle,
        inputs.p2Brake,
        inputs.p2Steer,
        inputs.p2Handbrake,
        fixedDt
      );

      // Step Rapier3D physics world
      physics.step(fixedDt);
    },

    // Variable Render Frame (rAF)
    (_alpha, frameDt) => {
      elapsedTime += frameDt;

      // 1. Update Visual Meshes across all convoy vehicles & campsite
      convoy.updateVisuals();
      campAndProps.update(elapsedTime);

      const activeMember = convoy.getActiveMember();
      const activeVehicle = activeMember.vehicle;
      const activeModel = activeMember.model;

      const trans = activeVehicle.chassisBody.translation();
      const currentPos = new THREE.Vector3(trans.x, trans.y, trans.z);

      // 2. Stream Terrain Chunks around vehicle
      terrain.updatePlayerPosition(currentPos, 2);

      // 3. Update Winch Cable Line & 3D Reticle
      activeModel.getBumperWorldPosition(_bumperPos);
      const tensionRatio = winch.currentTension / winch.maxTensionForce;
      winchCableMesh.update(_bumperPos, winch.anchorPoint, winch.isAttached, tensionRatio);

      const candidateAnchors = [
        ...foliage.getCandidateAnchors(),
        ...convoy.getConvoyWinchAnchors(activeVehicle)
      ];
      const bestAnchor = winch.findBestAnchor(_bumperPos, _vehicleForward, candidateAnchors);
      foliage.updateWinchReticle(bestAnchor, winch.isAttached, elapsedTime);

      const anchorDist = (!winch.isAttached && bestAnchor) ? _bumperPos.distanceTo(bestAnchor) : null;

      // 4. Update Camera & Sunlight tracking active vehicle
      const rot = activeVehicle.chassisBody.rotation();
      _chassisQuat.set(rot.x, rot.y, rot.z, rot.w);
      _vehicleForward.set(0, 0, 1).applyQuaternion(_chassisQuat);

      const telemetry = activeVehicle.getTelemetry();
      followCamera.update(currentPos, _vehicleForward, telemetry.pitchDeg, telemetry.speedKmh, frameDt);
      environment.update(currentPos);

      // 5. Dynamic Particles (Tire dust & Mud + Exhaust)
      for (const m of convoy.members) {
        for (let i = 0; i < 4; i++) {
          const w = m.vehicle.wheels[i];
          if (w.isGrounded && w.slipRatio > 0.15) {
            particles.emitDust(w.contactPoint, w.slipRatio, w.surfaceType);
          }
        }
      }
      activeModel.getExhaustWorldPosition(_exhaustPos);
      particles.emitExhaust(_exhaustPos, _vehicleForward, telemetry.engineRPM > 1200 ? 0.6 : 0.1);
      particles.update(frameDt);

      // 6. Dynamic Brake Lights
      const isBraking = (telemetry.speedKmh > 2 && telemetry.currentGear > 0 && inputManager.update().brake > 0.05) ||
                        (telemetry.currentGear === -1 && inputManager.update().brake > 0.05);
      activeModel.setBraking(isBraking);

      // 7. Landmark Discovery Check
      const discoveredLandmark = foliage.checkLandmarks(currentPos);
      if (discoveredLandmark) {
        gaugeCluster.showNotification(discoveredLandmark, 'New Trail Landmark Discovered!');
      }

      // 8. Update Audio Synthesis
      const maxSlip = Math.max(...activeVehicle.wheels.map((w) => w.slipRatio));
      const isWinching = winch.isAttached && (winch.currentTension > 500);
      sound.update(telemetry.engineRPM, maxSlip, isWinching);

      // 9. Update HUD Telemetry
      inclinometer.update(telemetry.pitchDeg, telemetry.rollDeg);

      const dominantSurface = activeVehicle.wheels[0].surfaceType || 'dirt';
      const headingDeg = THREE.MathUtils.radToDeg(Math.atan2(_vehicleForward.x, _vehicleForward.z));

      gaugeCluster.update({
        speedKmh: telemetry.speedKmh,
        rpm: telemetry.engineRPM,
        gear: telemetry.currentGear,
        isLowRange: telemetry.isLowRange,
        isDiffLocked: telemetry.isDiffLocked,
        winchAttached: winch.isAttached,
        winchLength: winch.cableLength,
        winchTension: winch.currentTension,
        surfaceType: `${activeMember.name.split(' ')[0]} | ${dominantSurface.toUpperCase()}`,
        cameraModeName: followCamera.getActiveModeName(),
        timePresetName: environment.getTimePresetName(),
        headingDeg,
        winchAnchorDist: anchorDist
      });

      // 10. Render Three.js Scene
      renderer.render(scene, followCamera.camera);
    }
  );

  gameLoop.start();
}

// Auto-boot if running in browser
if (typeof window !== 'undefined') {
  bootstrapApp();
}
