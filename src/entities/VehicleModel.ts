import * as THREE from 'three';
import { WheelMesh } from './WheelMesh';
import { RaycastVehicle } from '../physics/RaycastVehicle';

export interface VehicleColorPalette {
  name: string;
  body: number;
  roof: number;
}

export type VehicleArchetype = 'fj40' | 'cooler' | 'kayak' | 'pickup';

export interface VehicleModelOptions {
  paletteIndex?: number;
  archetype?: VehicleArchetype;
}

export class VehicleModel {
  public group: THREE.Group;
  private chassisMesh: THREE.Group;
  private wheels: WheelMesh[] = [];

  // Interactive dynamic materials
  private bodyMat!: THREE.MeshStandardMaterial;
  private roofMat!: THREE.MeshStandardMaterial;
  private brakeLightsMat!: THREE.MeshStandardMaterial;
  private headlightsMat!: THREE.MeshStandardMaterial;
  private roofLightsMat!: THREE.MeshStandardMaterial;
  public headlightSpotLeft!: THREE.SpotLight;
  public headlightSpotRight!: THREE.SpotLight;

  // Convoy Color Palettes matching Image 1, 2, and 3
  public static COLOR_PALETTES: VehicleColorPalette[] = [
    { name: 'Terracotta Orange (Image 1 & 3)', body: 0xdf5428, roof: 0xf4f1e9 },
    { name: 'Expedition Yellow (Image 2 Lead)', body: 0xedbf20, roof: 0xedbf20 },
    { name: 'Forest Sage Olive (Image 3)', body: 0x4e6342, roof: 0xf4f1e9 },
    { name: 'Glacier Alpine White (Image 3)', body: 0xe6e9ec, roof: 0x22242a },
    { name: 'Mountain Lake Blue (Image 2)', body: 0x4c8db8, roof: 0xf4f1e9 },
    { name: 'Desert Sand Tan (Image 3)', body: 0xc8965e, roof: 0xf4f1e9 }
  ];

  public currentPaletteIndex = 0;
  public archetype: VehicleArchetype = 'fj40';

  constructor(private vehicle: RaycastVehicle, scene: THREE.Scene, options: VehicleModelOptions = {}) {
    this.currentPaletteIndex = options.paletteIndex ?? 0;
    this.archetype = options.archetype ?? 'fj40';

    this.group = new THREE.Group();
    this.chassisMesh = new THREE.Group();
    this.group.add(this.chassisMesh);

    this.buildTruckBody();
    this.buildWheels();
    this.buildHeadlightProjectors(scene);

    scene.add(this.group);
  }

  /**
   * Procedural Mud Splatter Texture Generation matching Image 1's authentic weathered look
   */
  private generateMudSplatterTexture(baseHex: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // 1. Base Vehicle Body Color
    const col = new THREE.Color(baseHex);
    ctx.fillStyle = `rgb(${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)})`;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle door seam & panel line accents
    ctx.strokeStyle = 'rgba(25, 15, 10, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.lineTo(256, 512);
    ctx.moveTo(0, 200);
    ctx.lineTo(512, 200);
    ctx.stroke();

    // 2. Realistic Mud Splatters along lower body panels & wheel wells (matching Image 1)
    const mudColors = ['#29180e', '#3a2315', '#482c1b', '#20120a'];

    // Dense mud splatter base along lower 55%
    for (let i = 0; i < 280; i++) {
      const x = Math.random() * 512;
      const y = 230 + Math.random() * 282; // Clustered near bottom
      const r = 2 + Math.random() * 12;

      ctx.fillStyle = mudColors[Math.floor(Math.random() * mudColors.length)];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // Slanted spray streak
      if (Math.random() > 0.4) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 22, y - Math.random() * 26);
        ctx.lineWidth = 1.5 + Math.random() * 2.5;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.stroke();
      }
    }

    // Fine mud mist / speckles
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * 512;
      const y = 160 + Math.random() * 352;
      const r = 0.8 + Math.random() * 2.2;
      ctx.fillStyle = 'rgba(38, 22, 13, 0.75)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private buildTruckBody(): void {
    const p = VehicleModel.COLOR_PALETTES[this.currentPaletteIndex];

    // 1. Curated Materials
    this.bodyMat = new THREE.MeshStandardMaterial({
      map: this.generateMudSplatterTexture(p.body),
      roughness: 0.52,
      metalness: 0.1,
      flatShading: true
    });

    this.roofMat = new THREE.MeshStandardMaterial({
      color: p.roof, // Off-white vintage fiberglass hardtop
      roughness: 0.42,
      metalness: 0.08,
      flatShading: true
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1f2024, // Matte dark trim / bumper / rock sliders
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e5ea,
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x152230,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.85
    });

    // Expedition Camping Gear Materials (matching Image 2 & 3)
    const coolerBodyMat = new THREE.MeshStandardMaterial({
      color: 0x3b9fde, // Retro Ice-Blue Cooler box body (Image 2)
      roughness: 0.35,
      metalness: 0.05,
      flatShading: true
    });

    const coolerLidMat = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa, // White cooler lid & handles
      roughness: 0.4,
      flatShading: true
    });

    const campSwagMat = new THREE.MeshStandardMaterial({
      color: 0x2e4a34, // Dark forest olive rolled canvas swag / tent (Image 2)
      roughness: 0.85,
      flatShading: true
    });

    const cargoTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x2d3238, // Tactical dark grey expedition trunk
      roughness: 0.65,
      flatShading: true
    });

    const jerryCanMat = new THREE.MeshStandardMaterial({
      color: 0xcc2918, // Bright rally red fuel can
      roughness: 0.5,
      flatShading: true
    });

    const jerryCanWaterMat = new THREE.MeshStandardMaterial({
      color: 0x2980b9, // Blue water can
      roughness: 0.5,
      flatShading: true
    });

    const tractionBoardMat = new THREE.MeshStandardMaterial({
      color: 0xff6600, // Vibrant orange Maxtrax recovery boards
      roughness: 0.6,
      flatShading: true
    });

    this.brakeLightsMat = new THREE.MeshStandardMaterial({
      color: 0x771111,
      emissive: 0x440808,
      emissiveIntensity: 0.4,
      roughness: 0.3
    });

    this.headlightsMat = new THREE.MeshStandardMaterial({
      color: 0xfffaea,
      emissive: 0xffe89e,
      emissiveIntensity: 1.25,
      roughness: 0.2
    });

    this.roofLightsMat = new THREE.MeshStandardMaterial({
      color: 0xffe082,
      emissive: 0xffb74d,
      emissiveIntensity: 1.0,
      roughness: 0.2
    });

    // 2. Lower Main Body Tub
    const tubGeom = new THREE.BoxGeometry(1.86, 0.54, 3.75);
    const tub = new THREE.Mesh(tubGeom, this.bodyMat);
    tub.position.set(0, 0.16, 0);
    tub.castShadow = true;
    tub.receiveShadow = true;
    this.chassisMesh.add(tub);

    // 3. Vintage Arched Hood with Central Cowl Scoop Vent (Image 1)
    const hoodGeom = new THREE.BoxGeometry(1.66, 0.44, 1.45);
    const hood = new THREE.Mesh(hoodGeom, this.bodyMat);
    hood.position.set(0, 0.44, 1.12);
    hood.castShadow = true;
    this.chassisMesh.add(hood);

    // Central hood cowl cooling slit (Image 1 signature detail)
    const cowlVentGeom = new THREE.BoxGeometry(0.55, 0.04, 0.18);
    const cowlVent = new THREE.Mesh(cowlVentGeom, trimMat);
    cowlVent.position.set(0, 0.67, 1.35);
    this.chassisMesh.add(cowlVent);

    // Front Grille Fascia with classic white surround (Image 1)
    const grilleFasciaGeom = new THREE.BoxGeometry(1.56, 0.42, 0.1);
    const grilleFascia = new THREE.Mesh(grilleFasciaGeom, this.roofMat);
    grilleFascia.position.set(0, 0.42, 1.86);
    this.chassisMesh.add(grilleFascia);

    // Recessed dark radiator mesh slats
    const meshSlatGeom = new THREE.BoxGeometry(0.72, 0.26, 0.05);
    const meshSlat = new THREE.Mesh(meshSlatGeom, trimMat);
    meshSlat.position.set(0, 0.42, 1.92);
    this.chassisMesh.add(meshSlat);

    // 4. Large Round Vintage Headlights with Contrast Bezel Rings (Image 1)
    const bezelGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.06, 16);
    bezelGeom.rotateX(Math.PI / 2);
    const headBezelL = new THREE.Mesh(bezelGeom, trimMat); // Dark contrast bezel ring
    headBezelL.position.set(-0.55, 0.44, 1.89);
    this.chassisMesh.add(headBezelL);

    const headLensGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16);
    headLensGeom.rotateX(Math.PI / 2);
    const headLensL = new THREE.Mesh(headLensGeom, this.headlightsMat);
    headLensL.position.set(-0.55, 0.44, 1.92);
    this.chassisMesh.add(headLensL);

    const headBezelR = headBezelL.clone();
    headBezelR.position.x = 0.55;
    this.chassisMesh.add(headBezelR);

    const headLensR = headLensL.clone();
    headLensR.position.x = 0.55;
    this.chassisMesh.add(headLensR);

    // Rectangular dual-tone amber front fender turn indicators (Image 1)
    const turnGeom = new THREE.BoxGeometry(0.14, 0.09, 0.06);
    const turnMat = new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0xff8800, emissiveIntensity: 0.6 });
    const turnL = new THREE.Mesh(turnGeom, turnMat);
    turnL.position.set(-0.76, 0.38, 1.86);
    this.chassisMesh.add(turnL);

    const turnR = turnL.clone();
    turnR.position.x = 0.76;
    this.chassisMesh.add(turnR);

    // 5. Heavy-Duty Front Bumper with Bull Bar & Auxiliary Fog Lights
    const bumperGeom = new THREE.BoxGeometry(2.05, 0.22, 0.36);
    const frontBumper = new THREE.Mesh(bumperGeom, trimMat);
    frontBumper.position.set(0, 0.12, 2.05);
    frontBumper.castShadow = true;
    this.chassisMesh.add(frontBumper);

    // Bull Bar over front bumper
    const bullBarGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.35, 8);
    bullBarGeom.rotateZ(Math.PI / 2);
    const bullBar = new THREE.Mesh(bullBarGeom, trimMat);
    bullBar.position.set(0, 0.36, 2.18);
    this.chassisMesh.add(bullBar);

    // Front Bumper Auxiliary Round Fog Lights (Yellow truck in Image 2)
    const auxLightGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12);
    auxLightGeom.rotateX(Math.PI / 2);
    const auxL = new THREE.Mesh(auxLightGeom, this.roofLightsMat);
    auxL.position.set(-0.35, 0.36, 2.22);
    this.chassisMesh.add(auxL);
    const auxR = auxL.clone();
    auxR.position.x = 0.35;
    this.chassisMesh.add(auxR);

    // Tall Whip Antenna with Spring Base (Image 1 & 3)
    const antennaSpringGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6);
    const antennaSpring = new THREE.Mesh(antennaSpringGeom, chromeMat);
    antennaSpring.position.set(0.85, 0.25, 2.05);
    this.chassisMesh.add(antennaSpring);

    const antennaRodGeom = new THREE.CylinderGeometry(0.008, 0.004, 1.95, 6);
    const antennaRod = new THREE.Mesh(antennaRodGeom, trimMat);
    antennaRod.position.set(0.85, 1.25, 2.0);
    antennaRod.rotation.x = -0.06; // slight lean
    this.chassisMesh.add(antennaRod);

    const antennaBallGeom = new THREE.SphereGeometry(0.025, 6, 6);
    const antennaBall = new THREE.Mesh(antennaBallGeom, chromeMat);
    antennaBall.position.set(0.85, 2.22, 1.94);
    this.chassisMesh.add(antennaBall);

    // Winch Spool Housing & Cable Rollers
    const winchBaseGeom = new THREE.BoxGeometry(0.65, 0.2, 0.28);
    const winchBase = new THREE.Mesh(winchBaseGeom, trimMat);
    winchBase.position.set(0, 0.25, 2.08);
    this.chassisMesh.add(winchBase);

    const winchDrumGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.35, 10);
    winchDrumGeom.rotateZ(Math.PI / 2);
    const winchDrumMat = new THREE.MeshStandardMaterial({ color: 0xaa2211, roughness: 0.4 });
    const winchDrum = new THREE.Mesh(winchDrumGeom, winchDrumMat);
    winchDrum.position.set(0, 0.3, 2.08);
    this.chassisMesh.add(winchDrum);

    const rollerGeom = new THREE.BoxGeometry(0.3, 0.08, 0.04);
    const roller = new THREE.Mesh(rollerGeom, chromeMat);
    roller.position.set(0, 0.28, 2.24);
    this.chassisMesh.add(roller);

    const hookGeom = new THREE.TorusGeometry(0.06, 0.02, 6, 12, Math.PI * 1.5);
    const hookMat = new THREE.MeshStandardMaterial({ color: 0xcc2211, roughness: 0.3 });
    const hook = new THREE.Mesh(hookGeom, hookMat);
    hook.position.set(0, 0.26, 2.26);
    hook.rotation.y = Math.PI / 2;
    this.chassisMesh.add(hook);

    // Red D-Ring shackles
    const shackleGeom = new THREE.TorusGeometry(0.045, 0.015, 6, 10);
    const shackleL = new THREE.Mesh(shackleGeom, hookMat);
    shackleL.position.set(-0.82, 0.1, 2.24);
    this.chassisMesh.add(shackleL);
    const shackleR = shackleL.clone();
    shackleR.position.x = 0.82;
    this.chassisMesh.add(shackleR);

    // 6. Cabin & Fiberglass Hardtop
    const cabGeom = new THREE.BoxGeometry(1.72, 0.72, 1.55);
    const cab = new THREE.Mesh(cabGeom, this.roofMat);
    cab.position.set(0, 0.74, -0.22);
    cab.castShadow = true;
    this.chassisMesh.add(cab);

    // Windshield Glass & Frame
    const windGeom = new THREE.BoxGeometry(1.58, 0.48, 0.04);
    const windshield = new THREE.Mesh(windGeom, glassMat);
    windshield.position.set(0, 0.68, 0.54);
    windshield.rotation.x = -0.22;
    this.chassisMesh.add(windshield);

    // Side windows
    const sideWinGeom = new THREE.BoxGeometry(0.04, 0.38, 1.15);
    const sideWinL = new THREE.Mesh(sideWinGeom, glassMat);
    sideWinL.position.set(-0.87, 0.72, -0.2);
    this.chassisMesh.add(sideWinL);
    const sideWinR = sideWinL.clone();
    sideWinR.position.x = 0.87;
    this.chassisMesh.add(sideWinR);

    // Rear window
    const rearWinGeom = new THREE.BoxGeometry(1.2, 0.4, 0.04);
    const rearWin = new THREE.Mesh(rearWinGeom, glassMat);
    rearWin.position.set(0, 0.75, -1.0);
    this.chassisMesh.add(rearWin);

    // 7. Safari Snorkel (Image 1)
    const snorkelTubeGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.95, 8);
    const snorkelTube = new THREE.Mesh(snorkelTubeGeom, trimMat);
    snorkelTube.position.set(-0.9, 0.72, 0.42);
    snorkelTube.rotation.z = 0.08;
    this.chassisMesh.add(snorkelTube);

    const snorkelCapGeom = new THREE.BoxGeometry(0.14, 0.11, 0.16);
    const snorkelCap = new THREE.Mesh(snorkelCapGeom, trimMat);
    snorkelCap.position.set(-0.88, 1.18, 0.42);
    this.chassisMesh.add(snorkelCap);

    // 8. Rock Sliders & Fender Flares
    const sliderGeom = new THREE.CylinderGeometry(0.04, 0.04, 2.1, 8);
    sliderGeom.rotateX(Math.PI / 2);
    const sliderL = new THREE.Mesh(sliderGeom, trimMat);
    sliderL.position.set(-0.98, -0.05, 0);
    this.chassisMesh.add(sliderL);
    const sliderR = sliderL.clone();
    sliderR.position.x = 0.98;
    this.chassisMesh.add(sliderR);

    const flareGeom = new THREE.BoxGeometry(0.14, 0.1, 0.9);
    const flareFL = new THREE.Mesh(flareGeom, trimMat);
    flareFL.position.set(-0.98, 0.18, 1.4);
    this.chassisMesh.add(flareFL);
    const flareFR = flareFL.clone();
    flareFR.position.x = 0.98;
    this.chassisMesh.add(flareFR);

    const flareRL = flareFL.clone();
    flareRL.position.z = -1.4;
    this.chassisMesh.add(flareRL);
    const flareRR = flareFR.clone();
    flareRR.position.z = -1.4;
    this.chassisMesh.add(flareRR);

    // 9. Side Mirrors
    const mirrorStemGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6);
    mirrorStemGeom.rotateZ(Math.PI / 2);
    const mirrorStemL = new THREE.Mesh(mirrorStemGeom, trimMat);
    mirrorStemL.position.set(-0.95, 0.58, 0.45);
    this.chassisMesh.add(mirrorStemL);

    const mirrorHeadGeom = new THREE.BoxGeometry(0.04, 0.14, 0.18);
    const mirrorHeadL = new THREE.Mesh(mirrorHeadGeom, trimMat);
    mirrorHeadL.position.set(-1.06, 0.58, 0.45);
    this.chassisMesh.add(mirrorHeadL);

    const mirrorStemR = mirrorStemL.clone();
    mirrorStemR.position.x = 0.95;
    this.chassisMesh.add(mirrorStemR);
    const mirrorHeadR = mirrorHeadL.clone();
    mirrorHeadR.position.x = 1.06;
    this.chassisMesh.add(mirrorHeadR);

    // 10. Tubular Safari Roof Basket Loaded with Expedition Cargo (Image 1 & 2)
    const rackBaseGeom = new THREE.BoxGeometry(1.68, 0.06, 1.85);
    const rackBase = new THREE.Mesh(rackBaseGeom, trimMat);
    rackBase.position.set(0, 1.14, -0.22);
    this.chassisMesh.add(rackBase);

    const railGeom = new THREE.CylinderGeometry(0.025, 0.025, 1.85, 6);
    railGeom.rotateX(Math.PI / 2);
    const railL = new THREE.Mesh(railGeom, trimMat);
    railL.position.set(-0.82, 1.25, -0.22);
    this.chassisMesh.add(railL);
    const railR = railL.clone();
    railR.position.x = 0.82;
    this.chassisMesh.add(railR);

    // Crossbars on basket
    for (let i = 0; i < 4; i++) {
      const crossGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.64, 6);
      crossGeom.rotateZ(Math.PI / 2);
      const crossBar = new THREE.Mesh(crossGeom, trimMat);
      crossBar.position.set(0, 1.25, -0.9 + i * 0.48);
      this.chassisMesh.add(crossBar);
    }

    if (this.archetype === 'kayak') {
      // VIBRANT ORANGE EXPEDITION KAYAK (Olive wagon in Image 3!)
      const kayakGroup = new THREE.Group();
      kayakGroup.position.set(0, 1.35, -0.2);

      const kayakHullMat = new THREE.MeshStandardMaterial({
        color: 0xff5500, // Vibrant orange kayak
        roughness: 0.32,
        flatShading: true
      });

      // Streamlined hull
      const hullGeom = new THREE.CylinderGeometry(0.24, 0.28, 2.6, 6);
      hullGeom.rotateX(Math.PI / 2);
      hullGeom.scale(1.2, 0.55, 1.0);
      const hull = new THREE.Mesh(hullGeom, kayakHullMat);
      hull.castShadow = true;
      kayakGroup.add(hull);

      const bowGeom = new THREE.ConeGeometry(0.24, 0.7, 5);
      bowGeom.rotateX(-Math.PI / 2);
      bowGeom.scale(1.2, 0.55, 1.0);
      const bow = new THREE.Mesh(bowGeom, kayakHullMat);
      bow.position.set(0, 0, 1.65);
      kayakGroup.add(bow);

      const stern = bow.clone();
      stern.rotateX(Math.PI);
      stern.position.z = -1.65;
      kayakGroup.add(stern);

      // Cockpit recess
      const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.75), trimMat);
      cockpit.position.set(0, 0.12, -0.1);
      kayakGroup.add(cockpit);

      // Double-ended paddle strapped across
      const paddleShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6).rotateZ(Math.PI / 2), chromeMat);
      paddleShaft.position.set(0, 0.22, 0);
      kayakGroup.add(paddleShaft);

      this.chassisMesh.add(kayakGroup);
    } else if (this.archetype === 'cooler') {
      // RETRO BLUE & WHITE COOLER BOX (Lead Yellow Truck in Image 2!)
      const coolerGroup = new THREE.Group();
      coolerGroup.position.set(0.35, 1.34, -0.2);
      const coolerBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.42), coolerBodyMat);
      coolerGroup.add(coolerBody);
      const coolerLid = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.45), coolerLidMat);
      coolerLid.position.set(0, 0.2, 0);
      coolerGroup.add(coolerLid);
      this.chassisMesh.add(coolerGroup);

      const swagGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.72, 12).rotateZ(Math.PI / 2);
      const swag = new THREE.Mesh(swagGeom, campSwagMat);
      swag.position.set(-0.35, 1.34, 0.25);
      swag.castShadow = true;
      this.chassisMesh.add(swag);

      const trunkGeom = new THREE.BoxGeometry(0.65, 0.35, 0.65);
      const trunk = new THREE.Mesh(trunkGeom, cargoTrunkMat);
      trunk.position.set(-0.35, 1.34, -0.5);
      trunk.castShadow = true;
      this.chassisMesh.add(trunk);
    } else if (this.archetype === 'pickup') {
      // VINTAGE PICKUP ROLL BAR & REAR BED SETUP (Image 3)
      const rollBarGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.35, 6);
      const rollBarL = new THREE.Mesh(rollBarGeom, trimMat);
      rollBarL.position.set(-0.75, 1.15, -0.6);
      rollBarL.rotation.z = -0.15;
      this.chassisMesh.add(rollBarL);

      const rollBarR = rollBarL.clone();
      rollBarR.position.x = 0.75;
      rollBarR.rotation.z = 0.15;
      this.chassisMesh.add(rollBarR);

      const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6).rotateZ(Math.PI / 2), trimMat);
      crossBar.position.set(0, 1.75, -0.6);
      this.chassisMesh.add(crossBar);

      const kickerL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.15, 6), trimMat);
      kickerL.position.set(-0.75, 1.0, -1.05);
      kickerL.rotation.x = -0.65;
      this.chassisMesh.add(kickerL);

      const kickerR = kickerL.clone();
      kickerR.position.x = 0.75;
      this.chassisMesh.add(kickerR);
    } else {
      // FJ40 STANDARD EXPEDITION GEAR (Image 1 & 3)
      const trunkGeom = new THREE.BoxGeometry(0.65, 0.35, 0.65);
      const trunk = new THREE.Mesh(trunkGeom, cargoTrunkMat);
      trunk.position.set(-0.35, 1.34, -0.5);
      trunk.castShadow = true;
      this.chassisMesh.add(trunk);

      const swagGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.72, 12).rotateZ(Math.PI / 2);
      const swag = new THREE.Mesh(swagGeom, campSwagMat);
      swag.position.set(-0.35, 1.34, 0.25);
      swag.castShadow = true;
      this.chassisMesh.add(swag);

      const canGeom = new THREE.BoxGeometry(0.2, 0.35, 0.3);
      const canFuel = new THREE.Mesh(canGeom, jerryCanMat);
      canFuel.position.set(0.45, 1.34, 0.45);
      this.chassisMesh.add(canFuel);

      const canWater = new THREE.Mesh(canGeom, jerryCanWaterMat);
      canWater.position.set(0.45, 1.34, -0.65);
      this.chassisMesh.add(canWater);

      const boardGeom = new THREE.BoxGeometry(0.06, 0.22, 1.05);
      const boardL = new THREE.Mesh(boardGeom, tractionBoardMat);
      boardL.position.set(-0.85, 1.25, -0.22);
      this.chassisMesh.add(boardL);
    }

    // 11. Rear Tailgate Spare Tire with Silver Rim & Knobby Tread (Image 1 & 2)
    const spareGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 16);
    spareGeom.rotateX(Math.PI / 2);
    const spareTire = new THREE.Mesh(spareGeom, trimMat);
    spareTire.position.set(0, 0.46, -1.98);
    spareTire.castShadow = true;
    this.chassisMesh.add(spareTire);

    const spareRimGeom = new THREE.CylinderGeometry(0.26, 0.26, 0.28, 12);
    spareRimGeom.rotateX(Math.PI / 2);
    const spareRim = new THREE.Mesh(spareRimGeom, chromeMat);
    spareRim.position.set(0, 0.46, -1.98);
    this.chassisMesh.add(spareRim);

    // 12. Dynamic Rear Brake Lights & Turn Signals
    const brakeLightGeom = new THREE.BoxGeometry(0.18, 0.12, 0.04);
    const brakeLightL = new THREE.Mesh(brakeLightGeom, this.brakeLightsMat);
    brakeLightL.position.set(-0.78, 0.35, -1.89);
    this.chassisMesh.add(brakeLightL);

    const brakeLightR = brakeLightL.clone();
    brakeLightR.position.x = 0.78;
    this.chassisMesh.add(brakeLightR);

    // Mud flaps
    const flapGeom = new THREE.BoxGeometry(0.32, 0.28, 0.02);
    const flapL = new THREE.Mesh(flapGeom, trimMat);
    flapL.position.set(-0.95, -0.15, -1.9);
    this.chassisMesh.add(flapL);
    const flapR = flapL.clone();
    flapR.position.x = 0.95;
    this.chassisMesh.add(flapR);

    // Rear exhaust tailpipe
    const exhaustGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8);
    exhaustGeom.rotateX(Math.PI / 2);
    const exhaust = new THREE.Mesh(exhaustGeom, chromeMat);
    exhaust.position.set(-0.65, -0.05, -1.98);
    this.chassisMesh.add(exhaust);
  }

  private buildWheels(): void {
    for (let i = 0; i < 4; i++) {
      const wheelMesh = new WheelMesh(this.vehicle.wheelRadius);
      this.wheels.push(wheelMesh);
      this.group.add(wheelMesh.mesh);
    }
  }

  private buildHeadlightProjectors(scene: THREE.Scene): void {
    this.headlightSpotLeft = new THREE.SpotLight(0xfffae0, 2.5, 45, Math.PI / 6, 0.4, 1.2);
    this.headlightSpotRight = new THREE.SpotLight(0xfffae0, 2.5, 45, Math.PI / 6, 0.4, 1.2);

    this.headlightSpotLeft.castShadow = false;
    this.headlightSpotRight.castShadow = false;

    scene.add(this.headlightSpotLeft);
    scene.add(this.headlightSpotLeft.target);
    scene.add(this.headlightSpotRight);
    scene.add(this.headlightSpotRight.target);
  }

  /**
   * Cycle Vehicle Colorway Palette (matching Image 1, 2, and 3 convoy)
   */
  public cycleColorPalette(): string {
    this.currentPaletteIndex = (this.currentPaletteIndex + 1) % VehicleModel.COLOR_PALETTES.length;
    const p = VehicleModel.COLOR_PALETTES[this.currentPaletteIndex];

    // Re-generate mud splatter map with new base paint color
    this.bodyMat.map?.dispose();
    this.bodyMat.map = this.generateMudSplatterTexture(p.body);
    this.bodyMat.needsUpdate = true;

    this.roofMat.color.setHex(p.roof);
    this.roofMat.needsUpdate = true;

    return p.name;
  }

  /**
   * Set dynamic brake light glow (bright red when braking or in reverse)
   */
  public setBraking(isBraking: boolean): void {
    if (isBraking) {
      this.brakeLightsMat.color.setHex(0xff1100);
      this.brakeLightsMat.emissive.setHex(0xff0000);
      this.brakeLightsMat.emissiveIntensity = 2.2;
    } else {
      this.brakeLightsMat.color.setHex(0x771111);
      this.brakeLightsMat.emissive.setHex(0x440808);
      this.brakeLightsMat.emissiveIntensity = 0.4;
    }
  }

  /**
   * Synchronize 3D meshes with physics transforms
   */
  public update(): void {
    // 1. Chassis transform
    const trans = this.vehicle.chassisBody.translation();
    const rot = this.vehicle.chassisBody.rotation();
    this.chassisMesh.position.set(trans.x, trans.y, trans.z);
    this.chassisMesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // 2. Wheel transforms
    for (let i = 0; i < 4; i++) {
      const wheelState = this.vehicle.wheels[i];
      this.wheels[i].updateTransform(wheelState.worldPosition, wheelState.worldRotation);
    }

    // 3. Update Headlight Spotlights
    const chassisPos = this.chassisMesh.position;
    const chassisQuat = this.chassisMesh.quaternion;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(chassisQuat);

    const posLeft = new THREE.Vector3(-0.55, 0.44, 1.95).applyQuaternion(chassisQuat).add(chassisPos);
    const posRight = new THREE.Vector3(0.55, 0.44, 1.95).applyQuaternion(chassisQuat).add(chassisPos);

    this.headlightSpotLeft.position.copy(posLeft);
    this.headlightSpotLeft.target.position.copy(posLeft).addScaledVector(forward, 25).add(new THREE.Vector3(0, -1.8, 0));
    this.headlightSpotLeft.target.updateMatrixWorld();

    this.headlightSpotRight.position.copy(posRight);
    this.headlightSpotRight.target.position.copy(posRight).addScaledVector(forward, 25).add(new THREE.Vector3(0, -1.8, 0));
    this.headlightSpotRight.target.updateMatrixWorld();
  }

  public getBumperWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    const trans = this.vehicle.chassisBody.translation();
    const rot = this.vehicle.chassisBody.rotation();
    const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    return out.set(0, 0.25, 2.15).applyQuaternion(q).add(new THREE.Vector3(trans.x, trans.y, trans.z));
  }

  public getExhaustWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    const trans = this.vehicle.chassisBody.translation();
    const rot = this.vehicle.chassisBody.rotation();
    const q = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    return out.set(-0.65, -0.05, -2.0).applyQuaternion(q).add(new THREE.Vector3(trans.x, trans.y, trans.z));
  }

  public getPosition(): THREE.Vector3 {
    const t = this.vehicle.chassisBody.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }
}
