import * as THREE from 'three';
import { HeightmapGenerator } from '../terrain/HeightmapGenerator';

export interface Landmark {
  name: string;
  position: THREE.Vector3;
  discovered: boolean;
}

function mergeNonIndexedGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let totalVerts = 0;
  for (const g of geoms) totalVerts += g.attributes.position.count;
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  let offset = 0;
  for (const g of geoms) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    pos.set(p, offset * 3);
    norm.set(n, offset * 3);
    offset += g.attributes.position.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  return merged;
}

export class FoliageManager {
  private treeInstances!: THREE.InstancedMesh;
  private larchInstances!: THREE.InstancedMesh;
  private rockInstances!: THREE.InstancedMesh;
  private grassInstances!: THREE.InstancedMesh;
  private riverStoneInstances!: THREE.InstancedMesh;
  public winchAnchors: THREE.Vector3[] = [];

  // Holographic 3D Winch Target Reticle
  private winchReticle!: THREE.Group;
  private reticleRing!: THREE.Mesh;

  // Active recovery traction boards deployed on the ground
  private activeBoards: THREE.Mesh[] = [];

  // Discovered landmarks
  public landmarks: Landmark[] = [];

  constructor(
    private scene: THREE.Scene,
    private heightmap: HeightmapGenerator,
    countTrees = 550,
    countRocks = 300
  ) {
    this.createGoldenGrass(2800);
    this.createTieredPines(countTrees);
    this.createGoldenLarches(380);
    this.createRocks(countRocks);
    this.createRiverStones(160);
    this.createLandmarks();
    this.createWaterfall();
    this.createTrailFences();
    this.createWinchReticle();
  }

  /**
   * Instanced Tall Golden Wheat Grass blades matching Image 1 & 2
   */
  private createGoldenGrass(count: number): void {
    // 3 crossing blades forming a lush stylized grass tuft
    const bladeGeom = new THREE.PlaneGeometry(0.35, 1.05);
    bladeGeom.translate(0, 0.52, 0);

    const b1 = bladeGeom.toNonIndexed();
    const b2 = bladeGeom.clone().rotateY(Math.PI / 3).toNonIndexed();
    const b3 = bladeGeom.clone().rotateY((Math.PI * 2) / 3).toNonIndexed();
    const tuftGeom = mergeNonIndexedGeometries([b1, b2, b3]);

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0xf5cb4e, // Radiant warm golden wheat / amber
      roughness: 0.78,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide
    });

    this.grassInstances = new THREE.InstancedMesh(tuftGeom, grassMat, count);
    this.grassInstances.castShadow = false;
    this.grassInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const spread = 240;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread;
      const z = (Math.random() - 0.5) * spread;
      const distFromZero = Math.sqrt(x * x + z * z);
      if (distFromZero < 4.0) continue; // Keep immediate vehicle chassis clear

      const y = this.heightmap.getHeight(x, z);
      const surface = this.heightmap.getSurface(x, z, y);

      // Place densely on golden grass hills
      if (surface.name === 'grass') {
        const scaleY = 0.85 + Math.random() * 0.55;
        const scaleXZ = 0.8 + Math.random() * 0.45;
        dummy.position.set(x, y - 0.05, z);
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        // Subtle tilt with hillside
        dummy.rotation.x = (Math.random() - 0.5) * 0.15;
        dummy.rotation.z = (Math.random() - 0.5) * 0.15;
        dummy.updateMatrix();

        this.grassInstances.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }

    this.grassInstances.count = placed;
    this.grassInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.grassInstances);
  }

  /**
   * Tiered Stylized Evergreen Conifer Pine Trees (Image 2 & 3)
   */
  private createTieredPines(count: number): void {
    const t1 = new THREE.ConeGeometry(2.5, 2.2, 5);
    t1.translate(0, 1.8, 0);
    const t2 = new THREE.ConeGeometry(2.0, 2.0, 5);
    t2.translate(0, 3.2, 0);
    const t3 = new THREE.ConeGeometry(1.4, 2.0, 5);
    t3.translate(0, 4.6, 0);
    const coniferGeom = mergeNonIndexedGeometries([t1.toNonIndexed(), t2.toNonIndexed(), t3.toNonIndexed()]);

    const coniferMat = new THREE.MeshStandardMaterial({
      color: 0x1f4e30, // Deep lush conifer pine green
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true
    });

    this.treeInstances = new THREE.InstancedMesh(coniferGeom, coniferMat, count);
    this.treeInstances.castShadow = true;
    this.treeInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const spread = 280;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread;
      const z = (Math.random() - 0.5) * spread;
      if (Math.sqrt(x * x + z * z) < 14) continue;

      const y = this.heightmap.getHeight(x, z);
      const surface = this.heightmap.getSurface(x, z, y);

      if (surface.name === 'grass' || surface.name === 'dirt') {
        const scale = 0.85 + Math.random() * 0.75;
        dummy.position.set(x, y, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();

        this.treeInstances.setMatrixAt(placed, dummy.matrix);

        if (placed % 3 === 0) {
          this.winchAnchors.push(new THREE.Vector3(x, y + 1.2, z));
        }

        placed++;
      }
    }

    this.treeInstances.count = placed;
    this.treeInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.treeInstances);
  }

  /**
   * Autumn Golden Larch Pines (Image 2 & 3 radiant yellow conifer trees)
   */
  private createGoldenLarches(count: number): void {
    const t1 = new THREE.ConeGeometry(2.3, 2.4, 5);
    t1.translate(0, 1.8, 0);
    const t2 = new THREE.ConeGeometry(1.8, 2.2, 5);
    t2.translate(0, 3.4, 0);
    const t3 = new THREE.ConeGeometry(1.3, 2.0, 5);
    t3.translate(0, 4.8, 0);
    const larchGeom = mergeNonIndexedGeometries([t1.toNonIndexed(), t2.toNonIndexed(), t3.toNonIndexed()]);

    const larchMat = new THREE.MeshStandardMaterial({
      color: 0xf2be24, // Radiant glowing autumn larch golden amber
      roughness: 0.8,
      metalness: 0.05,
      flatShading: true
    });

    this.larchInstances = new THREE.InstancedMesh(larchGeom, larchMat, count);
    this.larchInstances.castShadow = true;
    this.larchInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const spread = 270;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread;
      const z = (Math.random() - 0.5) * spread;
      if (Math.sqrt(x * x + z * z) < 14) continue;

      const y = this.heightmap.getHeight(x, z);
      const surface = this.heightmap.getSurface(x, z, y);

      if (surface.name === 'grass' || surface.name === 'dirt') {
        const scale = 0.8 + Math.random() * 0.7;
        dummy.position.set(x, y, z);
        dummy.scale.set(scale, scale * (0.95 + Math.random() * 0.3), scale);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();

        this.larchInstances.setMatrixAt(placed, dummy.matrix);

        if (placed % 3 === 0) {
          this.winchAnchors.push(new THREE.Vector3(x, y + 1.3, z));
        }

        placed++;
      }
    }

    this.larchInstances.count = placed;
    this.larchInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.larchInstances);
  }

  /**
   * Mountain Slate Rocks & Boulders
   */
  private createRocks(count: number): void {
    const rockGeom = new THREE.DodecahedronGeometry(1.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x6e727e, // Warm mountain slate gray
      roughness: 0.9,
      metalness: 0.06,
      flatShading: true
    });

    this.rockInstances = new THREE.InstancedMesh(rockGeom, rockMat, count);
    this.rockInstances.castShadow = true;
    this.rockInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    const spread = 280;

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread;
      const z = (Math.random() - 0.5) * spread;
      if (Math.sqrt(x * x + z * z) < 12) continue;

      const y = this.heightmap.getHeight(x, z);
      const scaleX = 0.8 + Math.random() * 1.5;
      const scaleY = 0.6 + Math.random() * 1.3;
      const scaleZ = 0.8 + Math.random() * 1.5;

      dummy.position.set(x, y - 0.25, z);
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();

      this.rockInstances.setMatrixAt(placed, dummy.matrix);

      if (scaleY > 1.2 && placed % 3 === 0) {
        this.winchAnchors.push(new THREE.Vector3(x, y + 0.9, z));
      }

      placed++;
    }

    this.rockInstances.count = placed;
    this.rockInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.rockInstances);
  }

  /**
   * Smooth Rounded River Stones along lake shoreline (Image 3)
   */
  private createRiverStones(count: number): void {
    const stoneGeom = new THREE.DodecahedronGeometry(0.8, 1);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x8a8d96, // Smooth light slate river pebble
      roughness: 0.7,
      metalness: 0.1,
      flatShading: true
    });

    this.riverStoneInstances = new THREE.InstancedMesh(stoneGeom, stoneMat, count);
    this.riverStoneInstances.castShadow = true;
    this.riverStoneInstances.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < count * 2 && placed < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 95;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      const y = this.heightmap.getHeight(x, z);
      // Place near lake elevation (shoreline)
      if (y > -0.6 && y < 1.4) {
        dummy.position.set(x, y - 0.15, z);
        dummy.scale.set(0.6 + Math.random() * 0.9, 0.4 + Math.random() * 0.5, 0.6 + Math.random() * 0.9);
        dummy.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.4);
        dummy.updateMatrix();

        this.riverStoneInstances.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }

    this.riverStoneInstances.count = placed;
    this.riverStoneInstances.instanceMatrix.needsUpdate = true;
    this.scene.add(this.riverStoneInstances);
  }

  private createLandmarks(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6d4c3d, roughness: 0.85, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9, flatShading: true });
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 0.9, flatShading: true });
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffe082, emissive: 0xffb300, emissiveIntensity: 1.5 });

    // 1. Old Ranger Outpost Cabin (at X: -28, Z: 36)
    const cabinGroup = new THREE.Group();
    const cabinX = -28;
    const cabinZ = 36;
    const cabinY = this.heightmap.getHeight(cabinX, cabinZ);
    cabinGroup.position.set(cabinX, cabinY, cabinZ);

    // Cabin Walls
    const walls = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.2, 5.5), woodMat);
    walls.position.set(0, 1.6, 0);
    walls.castShadow = true;
    cabinGroup.add(walls);

    // Pitched Roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.0, 4), roofMat);
    roof.position.set(0, 4.0, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.1, 1.0, 1.25);
    roof.castShadow = true;
    cabinGroup.add(roof);

    // Stone Chimney
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4.5, 0.8), stoneMat);
    chimney.position.set(2.0, 2.5, 1.2);
    chimney.castShadow = true;
    cabinGroup.add(chimney);

    // Front Porch & Lantern
    const porch = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.3, 1.8), woodMat);
    porch.position.set(0, 0.15, 3.4);
    cabinGroup.add(porch);

    const lantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), lanternMat);
    lantern.position.set(1.4, 2.2, 2.8);
    cabinGroup.add(lantern);

    this.scene.add(cabinGroup);
    this.winchAnchors.push(new THREE.Vector3(cabinX, cabinY + 1.2, cabinZ));
    this.landmarks.push({
      name: 'Old Ranger Outpost',
      position: new THREE.Vector3(cabinX, cabinY, cabinZ),
      discovered: false
    });

    // 2. Fire Lookout Watchtower (at X: 52, Z: -42)
    const towerGroup = new THREE.Group();
    const towerX = 52;
    const towerZ = -42;
    const towerY = this.heightmap.getHeight(towerX, towerZ);
    towerGroup.position.set(towerX, towerY, towerZ);

    // 4 Corner Wooden Pilings
    const legGeom = new THREE.CylinderGeometry(0.18, 0.22, 9.0, 6);
    const leg1 = new THREE.Mesh(legGeom, woodMat);
    leg1.position.set(-2.0, 4.5, -2.0);
    towerGroup.add(leg1);
    const leg2 = leg1.clone();
    leg2.position.set(2.0, 4.5, -2.0);
    towerGroup.add(leg2);
    const leg3 = leg1.clone();
    leg3.position.set(-2.0, 4.5, 2.0);
    towerGroup.add(leg3);
    const leg4 = leg1.clone();
    leg4.position.set(2.0, 4.5, 2.0);
    towerGroup.add(leg4);

    // Observation Cabin on top
    const obsDeck = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 4.8), woodMat);
    obsDeck.position.set(0, 9.0, 0);
    towerGroup.add(obsDeck);

    const obsCabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 3.6), woodMat);
    obsCabin.position.set(0, 10.3, 0);
    towerGroup.add(obsCabin);

    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.5, 4), roofMat);
    towerRoof.position.set(0, 12.0, 0);
    towerRoof.rotation.y = Math.PI / 4;
    towerGroup.add(towerRoof);

    this.scene.add(towerGroup);
    this.winchAnchors.push(new THREE.Vector3(towerX, towerY + 1.5, towerZ));
    this.landmarks.push({
      name: 'Eagle Ridge Watchtower',
      position: new THREE.Vector3(towerX, towerY, towerZ),
      discovered: false
    });

    // 3. Bear Creek Timber Bridge (at X: 12, Z: -15)
    const bridgeGroup = new THREE.Group();
    const bridgeX = 12;
    const bridgeZ = -15;
    const bridgeY = this.heightmap.getHeight(bridgeX, bridgeZ) + 0.3;
    bridgeGroup.position.set(bridgeX, bridgeY, bridgeZ);

    const deckGeom = new THREE.BoxGeometry(3.2, 0.35, 10.0);
    const deck = new THREE.Mesh(deckGeom, woodMat);
    deck.receiveShadow = true;
    deck.castShadow = true;
    bridgeGroup.add(deck);

    // Railings
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 10.0), woodMat);
    railL.position.set(-1.55, 0.6, 0);
    bridgeGroup.add(railL);
    const railR = railL.clone();
    railR.position.x = 1.55;
    bridgeGroup.add(railR);

    // Wooden support pilings extending into lake water (Image 3)
    const pilingGeom = new THREE.CylinderGeometry(0.14, 0.16, 3.8, 6);
    const p1 = new THREE.Mesh(pilingGeom, woodMat);
    p1.position.set(-1.4, -1.6, -3.5);
    bridgeGroup.add(p1);
    const p2 = p1.clone();
    p2.position.set(1.4, -1.6, -3.5);
    bridgeGroup.add(p2);
    const p3 = p1.clone();
    p3.position.set(-1.4, -1.6, 3.5);
    bridgeGroup.add(p3);
    const p4 = p1.clone();
    p4.position.set(1.4, -1.6, 3.5);
    bridgeGroup.add(p4);

    this.scene.add(bridgeGroup);
    this.winchAnchors.push(new THREE.Vector3(bridgeX + 1.6, bridgeY + 0.8, bridgeZ));
    this.winchAnchors.push(new THREE.Vector3(bridgeX - 1.6, bridgeY + 0.8, bridgeZ));
    this.landmarks.push({
      name: 'Bear Creek Timber Bridge',
      position: new THREE.Vector3(bridgeX, bridgeY, bridgeZ),
      discovered: false
    });
  }

  /**
   * Scenic Mountain Waterfall cascading down rocky cliff (Image 3)
   */
  private createWaterfall(): void {
    const fallGroup = new THREE.Group();
    const cliffX = -65;
    const cliffZ = 55;
    const cliffY = this.heightmap.getHeight(cliffX, cliffZ) + 3.0;
    fallGroup.position.set(cliffX, cliffY, cliffZ);

    // Stepped rocky chute
    const rockChuteMat = new THREE.MeshStandardMaterial({ color: 0x484b55, roughness: 0.9, flatShading: true });
    const chute = new THREE.Mesh(new THREE.BoxGeometry(4.8, 12, 3.0), rockChuteMat);
    chute.position.set(0, -4.5, 0);
    chute.castShadow = true;
    fallGroup.add(chute);

    // Cascading white/cyan foam water stream
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xedf7ff,
      emissive: 0xc4e2ff,
      emissiveIntensity: 0.4,
      roughness: 0.15,
      transparent: true,
      opacity: 0.92,
      flatShading: true
    });
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 11), foamMat);
    stream.position.set(0, -4.2, 1.55);
    stream.rotation.x = -0.12;
    fallGroup.add(stream);

    // Water spray mist disc at base
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 8), mistMat);
    pool.position.set(0, -9.8, 2.5);
    pool.rotation.x = -Math.PI / 2;
    fallGroup.add(pool);

    this.scene.add(fallGroup);
    this.landmarks.push({
      name: 'Silver Cascades Waterfall',
      position: new THREE.Vector3(cliffX, cliffY - 6, cliffZ),
      discovered: false
    });
  }

  private createTrailFences(): void {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, flatShading: true });
    const postGeom = new THREE.CylinderGeometry(0.1, 0.1, 1.4, 5);
    const railGeom = new THREE.CylinderGeometry(0.06, 0.06, 4.2, 5);
    railGeom.rotateZ(Math.PI / 2);

    // Place a winding trail fence alongside spawn
    const trailPoints = [
      new THREE.Vector3(-12, 0, 8),
      new THREE.Vector3(-10, 0, 16),
      new THREE.Vector3(-6, 0, 24),
      new THREE.Vector3(0, 0, 32),
      new THREE.Vector3(8, 0, 38)
    ];

    for (let i = 0; i < trailPoints.length; i++) {
      const pt = trailPoints[i];
      pt.y = this.heightmap.getHeight(pt.x, pt.z);

      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(pt.x, pt.y + 0.6, pt.z);
      this.scene.add(post);

      if (i < trailPoints.length - 1) {
        const next = trailPoints[i + 1];
        next.y = this.heightmap.getHeight(next.x, next.z);

        const midX = (pt.x + next.x) / 2;
        const midY = (pt.y + next.y) / 2 + 0.7;
        const midZ = (pt.z + next.z) / 2;

        const rail = new THREE.Mesh(railGeom, postMat);
        rail.position.set(midX, midY, midZ);
        rail.lookAt(next.x, midY, next.z);
        rail.rotateY(Math.PI / 2);
        this.scene.add(rail);
      }
    }
  }

  private createWinchReticle(): void {
    this.winchReticle = new THREE.Group();

    // Outer glowing ring
    const ringGeom = new THREE.TorusGeometry(0.85, 0.08, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.85,
      wireframe: false
    });
    this.reticleRing = new THREE.Mesh(ringGeom, ringMat);
    this.reticleRing.rotation.x = Math.PI / 2;
    this.winchReticle.add(this.reticleRing);

    // Inner crosshairs
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const crossBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.04), crossMat);
    const crossBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), crossMat);
    this.winchReticle.add(crossBar1);
    this.winchReticle.add(crossBar2);

    this.winchReticle.visible = false;
    this.scene.add(this.winchReticle);
  }

  public updateWinchReticle(targetAnchor: THREE.Vector3 | null, isWinchAttached: boolean, timeSec: number): void {
    if (isWinchAttached || !targetAnchor) {
      this.winchReticle.visible = false;
      return;
    }

    this.winchReticle.visible = true;
    this.winchReticle.position.copy(targetAnchor);
    this.winchReticle.position.y += 0.3 + Math.sin(timeSec * 4) * 0.15;
    this.reticleRing.rotation.z = timeSec * 1.5;
  }

  /**
   * Deploy bright orange recovery boards directly under the vehicle wheels
   */
  public deployRecoveryBoard(position: THREE.Vector3, forwardDir: THREE.Vector3): void {
    const boardGeom = new THREE.BoxGeometry(0.42, 0.06, 1.35);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0xff6600, // Maxtrax orange
      roughness: 0.5,
      flatShading: true
    });

    const board = new THREE.Mesh(boardGeom, boardMat);
    board.position.copy(position);
    board.position.y += 0.05;
    board.lookAt(position.x + forwardDir.x, board.position.y, position.z + forwardDir.z);
    board.receiveShadow = true;

    this.scene.add(board);
    this.activeBoards.push(board);

    // Keep max 6 boards in the world
    if (this.activeBoards.length > 6) {
      const oldest = this.activeBoards.shift();
      if (oldest) {
        this.scene.remove(oldest);
        oldest.geometry.dispose();
      }
    }
  }

  public checkLandmarks(playerPos: THREE.Vector3): string | null {
    for (const lm of this.landmarks) {
      if (!lm.discovered) {
        const dist = playerPos.distanceTo(lm.position);
        if (dist < 15.0) {
          lm.discovered = true;
          return lm.name;
        }
      }
    }
    return null;
  }

  public getCandidateAnchors(): THREE.Vector3[] {
    return this.winchAnchors;
  }
}
