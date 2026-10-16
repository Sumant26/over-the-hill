import * as THREE from 'three';
import { HeightmapGenerator } from '../terrain/HeightmapGenerator';

export class CampAndProps {
  public group: THREE.Group;
  private campfireFlame!: THREE.Mesh;
  private flameLight!: THREE.PointLight;
  private animatedProps: { update: (time: number) => void }[] = [];

  constructor(private scene: THREE.Scene, private heightmap: HeightmapGenerator) {
    this.group = new THREE.Group();
    this.buildBaseCamp();
    this.buildFallenLogObstacle();
    this.buildTrailCairns();
    this.scene.add(this.group);
  }

  private buildBaseCamp(): void {
    const campX = -8;
    const campZ = -6;
    const campY = this.heightmap.getHeight(campX, campZ);

    const campGroup = new THREE.Group();
    campGroup.position.set(campX, campY, campZ);

    const canvasMat = new THREE.MeshStandardMaterial({
      color: 0xdfd3b8, // Weathered canvas tan
      roughness: 0.9,
      flatShading: true
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5a3e28,
      roughness: 0.85,
      flatShading: true
    });

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x686c75,
      roughness: 0.92,
      flatShading: true
    });

    // 1. Classic A-Frame Expedition Tent
    const tentRoofGeom = new THREE.ConeGeometry(2.6, 2.2, 4);
    tentRoofGeom.rotateY(Math.PI / 4);
    tentRoofGeom.scale(1.2, 1.0, 1.6);
    const tentRoof = new THREE.Mesh(tentRoofGeom, canvasMat);
    tentRoof.position.set(-3.5, 1.1, -1.0);
    tentRoof.castShadow = true;
    campGroup.add(tentRoof);

    // Tent Ridge Pole
    const ridgePole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.4, 6), woodMat);
    ridgePole.rotation.x = Math.PI / 2;
    ridgePole.position.set(-3.5, 2.1, -1.0);
    campGroup.add(ridgePole);

    // 2. Crackling Campfire with Stone Ring
    const stoneRingCount = 10;
    const ringRadius = 1.1;
    for (let i = 0; i < stoneRingCount; i++) {
      const angle = (i / stoneRingCount) * Math.PI * 2;
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.24, 0),
        stoneMat
      );
      stone.position.set(Math.cos(angle) * ringRadius, 0.12, Math.sin(angle) * ringRadius);
      stone.scale.set(1.0, 0.6 + Math.random() * 0.4, 1.0);
      campGroup.add(stone);
    }

    // Charred campfire logs criss-crossed
    const logGeom = new THREE.CylinderGeometry(0.08, 0.09, 1.2, 6);
    logGeom.rotateZ(Math.PI / 2);
    const charredMat = new THREE.MeshStandardMaterial({ color: 0x221a15, roughness: 0.95 });
    for (let i = 0; i < 3; i++) {
      const fireLog = new THREE.Mesh(logGeom, charredMat);
      fireLog.position.set(0, 0.15 + i * 0.06, 0);
      fireLog.rotation.y = (i * Math.PI) / 3;
      campGroup.add(fireLog);
    }

    // Dynamic glowing campfire flame
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff7700
    });
    this.campfireFlame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.75, 5), flameMat);
    this.campfireFlame.position.set(0, 0.5, 0);
    campGroup.add(this.campfireFlame);

    // Flickering Campfire Light
    this.flameLight = new THREE.PointLight(0xff7b1c, 2.8, 14, 1.5);
    this.flameLight.position.set(0, 0.8, 0);
    this.flameLight.castShadow = false;
    campGroup.add(this.flameLight);

    // 3. Camp Cooking Tripod & Hanging Kettle
    const legGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.8, 5);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(legGeom, woodMat);
      const ang = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(ang) * 0.55, 0.9, Math.sin(ang) * 0.55);
      leg.lookAt(0, 1.8, 0);
      leg.rotateX(Math.PI / 2);
      campGroup.add(leg);
    }

    const kettleMat = new THREE.MeshStandardMaterial({ color: 0x1d1e22, roughness: 0.7, metalness: 0.5 });
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), kettleMat);
    kettle.position.set(0, 0.85, 0);
    campGroup.add(kettle);

    // 4. Firewood Stack & Chopping Stump with Axe
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.55, 8), woodMat);
    stump.position.set(2.2, 0.28, 1.2);
    stump.castShadow = true;
    campGroup.add(stump);

    // Axe head in stump
    const axeHeadMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 });
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.03), axeHeadMat);
    axeHead.position.set(2.2, 0.62, 1.2);
    campGroup.add(axeHead);

    const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 5), woodMat);
    axeHandle.position.set(2.35, 0.85, 1.2);
    axeHandle.rotation.z = -0.4;
    campGroup.add(axeHandle);

    // Firewood stack
    const woodLogGeom = new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6);
    woodLogGeom.rotateX(Math.PI / 2);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3 - row; col++) {
        const log = new THREE.Mesh(woodLogGeom, woodMat);
        log.position.set(2.4 + col * 0.16 + row * 0.08, 0.08 + row * 0.14, -0.6);
        campGroup.add(log);
      }
    }

    // 5. Wooden Log Sitting Benches
    const benchGeom = new THREE.BoxGeometry(1.4, 0.18, 0.4);
    const bench1 = new THREE.Mesh(benchGeom, woodMat);
    bench1.position.set(0, 0.35, 1.6);
    bench1.castShadow = true;
    campGroup.add(bench1);

    const bench2 = new THREE.Mesh(benchGeom, woodMat);
    bench2.position.set(1.7, 0.35, -0.2);
    bench2.rotation.y = Math.PI / 2;
    bench2.castShadow = true;
    campGroup.add(bench2);

    this.group.add(campGroup);

    // Flame flicker animation registration
    this.animatedProps.push({
      update: (time: number) => {
        const s = 0.85 + Math.sin(time * 16) * 0.15 + Math.cos(time * 26) * 0.1;
        this.campfireFlame.scale.set(s, s * (0.9 + Math.sin(time * 12) * 0.2), s);
        this.flameLight.intensity = 2.4 + Math.sin(time * 20) * 0.6;
      }
    });
  }

  /**
   * Massive Fallen Pine Tree Log across the trail (Challenging off-road obstacle)
   */
  private buildFallenLogObstacle(): void {
    const logX = 32;
    const logZ = 18;
    const logY = this.heightmap.getHeight(logX, logZ);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2c1f,
      roughness: 0.9,
      flatShading: true
    });

    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x48582d,
      roughness: 0.95,
      flatShading: true
    });

    const logGroup = new THREE.Group();
    logGroup.position.set(logX, logY + 0.32, logZ);

    // Main fallen log trunk (diameter 0.65m, length 6.2m)
    const logGeom = new THREE.CylinderGeometry(0.32, 0.38, 6.2, 7);
    logGeom.rotateZ(Math.PI / 2);
    const logMesh = new THREE.Mesh(logGeom, trunkMat);
    logMesh.rotation.y = 0.4;
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    logGroup.add(logMesh);

    // Green moss patch on top of log
    const mossGeom = new THREE.BoxGeometry(4.5, 0.1, 0.45);
    const moss = new THREE.Mesh(mossGeom, mossMat);
    moss.position.set(0, 0.32, 0);
    moss.rotation.y = 0.4;
    logGroup.add(moss);

    // Snapped tree stump at one end
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 1.4, 7), trunkMat);
    stump.position.set(-2.8, 0.4, -0.9);
    stump.rotation.z = 0.18;
    logGroup.add(stump);

    this.group.add(logGroup);
  }

  /**
   * Trail Cairns (Traditional stacked stones marking mountain trails)
   */
  private buildTrailCairns(): void {
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x767882,
      roughness: 0.88,
      flatShading: true
    });

    const cairnPositions = [
      new THREE.Vector3(14, 0, 20),
      new THREE.Vector3(38, 0, 10),
      new THREE.Vector3(45, 0, -12),
      new THREE.Vector3(-32, 0, 30)
    ];

    for (const pos of cairnPositions) {
      pos.y = this.heightmap.getHeight(pos.x, pos.z);
      const cairn = new THREE.Group();
      cairn.position.copy(pos);

      // Stack of 4 descending stones
      for (let s = 0; s < 4; s++) {
        const radius = 0.38 - s * 0.08;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), stoneMat);
        stone.position.set((Math.random() - 0.5) * 0.04, s * 0.22 + 0.12, (Math.random() - 0.5) * 0.04);
        stone.scale.set(1.0, 0.65, 1.0);
        stone.castShadow = true;
        cairn.add(stone);
      }
      this.group.add(cairn);
    }
  }

  public update(timeSec: number): void {
    for (const prop of this.animatedProps) {
      prop.update(timeSec);
    }
  }
}
