import * as THREE from 'three';
import { HeightmapGenerator } from './HeightmapGenerator';

export interface RoadWaypoint {
  pos: THREE.Vector3;
  width: number;
}

export class RoadSystem {
  public group: THREE.Group;
  private roadMesh!: THREE.Mesh;
  public roadSplines: THREE.CatmullRomCurve3[] = [];

  constructor(private scene: THREE.Scene, private heightmap: HeightmapGenerator) {
    this.group = new THREE.Group();
    this.buildRoads();
    this.buildRoadsideProps();
    this.scene.add(this.group);
  }

  private generateRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Earthy trail base
    ctx.fillStyle = '#674a32';
    ctx.fillRect(0, 0, 256, 512);

    // Gravel speckles
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 512;
      const r = 1 + Math.random() * 2.5;
      ctx.fillStyle = Math.random() > 0.5 ? '#7d6148' : '#523a26';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Two parallel compacted wheel rut tracks
    const rutL = 68;
    const rutR = 188;
    const rutWidth = 44;

    const gradL = ctx.createLinearGradient(rutL - rutWidth / 2, 0, rutL + rutWidth / 2, 0);
    gradL.addColorStop(0, 'rgba(60, 40, 25, 0)');
    gradL.addColorStop(0.5, 'rgba(45, 28, 16, 0.65)');
    gradL.addColorStop(1, 'rgba(60, 40, 25, 0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(rutL - rutWidth / 2, 0, rutWidth, 512);

    const gradR = ctx.createLinearGradient(rutR - rutWidth / 2, 0, rutR + rutWidth / 2, 0);
    gradR.addColorStop(0, 'rgba(60, 40, 25, 0)');
    gradR.addColorStop(0.5, 'rgba(45, 28, 16, 0.65)');
    gradR.addColorStop(1, 'rgba(60, 40, 25, 0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(rutR - rutWidth / 2, 0, rutWidth, 512);

    // Grassy center strip weeds
    for (let i = 0; i < 80; i++) {
      const x = 115 + Math.random() * 26;
      const y = Math.random() * 512;
      ctx.fillStyle = 'rgba(195, 150, 45, 0.45)';
      ctx.fillRect(x, y, 3, 7);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 18);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private buildRoads(): void {
    // 1. Lake & Bear Creek Trail Spline Points
    const lakePoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(4, 0, 10),
      new THREE.Vector3(8, 0, 24),
      new THREE.Vector3(10, 0, 36),
      new THREE.Vector3(2, 0, 48),
      new THREE.Vector3(-14, 0, 42),
      new THREE.Vector3(-28, 0, 36), // Near Ranger Cabin
      new THREE.Vector3(-35, 0, 15),
      new THREE.Vector3(-25, 0, -5),
      new THREE.Vector3(-5, 0, -12),
      new THREE.Vector3(12, 0, -15), // Bear Creek Bridge entrance
      new THREE.Vector3(26, 0, -22),
      new THREE.Vector3(38, 0, -32),
      new THREE.Vector3(45, 0, -48),
      new THREE.Vector3(30, 0, -65),
      new THREE.Vector3(5, 0, -68),
      new THREE.Vector3(-25, 0, -62),
      new THREE.Vector3(-55, 0, 20),
      new THREE.Vector3(-65, 0, 52)  // Silver Cascades Waterfall
    ];

    // 2. Eagle Ridge Summit Climb Switchback Trail
    const summitPoints = [
      new THREE.Vector3(8, 0, 24), // Fork off valley trail
      new THREE.Vector3(22, 0, 22),
      new THREE.Vector3(36, 0, 14),
      new THREE.Vector3(42, 0, -5),
      new THREE.Vector3(48, 0, -22),
      new THREE.Vector3(52, 0, -42)  // Eagle Ridge Lookout Watchtower
    ];

    // Project points to terrain elevation
    for (const pt of lakePoints) {
      pt.y = this.heightmap.getHeight(pt.x, pt.z) + 0.08;
    }
    for (const pt of summitPoints) {
      pt.y = this.heightmap.getHeight(pt.x, pt.z) + 0.08;
    }

    const curveLake = new THREE.CatmullRomCurve3(lakePoints, false, 'centripetal');
    const curveSummit = new THREE.CatmullRomCurve3(summitPoints, false, 'centripetal');
    this.roadSplines.push(curveLake, curveSummit);

    const roadTexture = this.generateRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true
    });

    const combinedGeom = this.createRibbonGeometry([
      { curve: curveLake, width: 3.4, steps: 180 },
      { curve: curveSummit, width: 3.0, steps: 110 }
    ]);

    this.roadMesh = new THREE.Mesh(combinedGeom, roadMat);
    this.roadMesh.receiveShadow = true;
    this.group.add(this.roadMesh);
  }

  private createRibbonGeometry(
    paths: { curve: THREE.CatmullRomCurve3; width: number; steps: number }[]
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    const _up = new THREE.Vector3(0, 1, 0);
    const _tangent = new THREE.Vector3();
    const _side = new THREE.Vector3();

    for (const path of paths) {
      const { curve, width, steps } = path;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = curve.getPointAt(t);
        pt.y = this.heightmap.getHeight(pt.x, pt.z) + 0.06;

        curve.getTangentAt(t, _tangent);
        _side.crossVectors(_tangent, _up).normalize();

        const halfW = width * 0.5;

        // Left edge
        const lx = pt.x - _side.x * halfW;
        const lz = pt.z - _side.z * halfW;
        const ly = this.heightmap.getHeight(lx, lz) + 0.06;

        // Right edge
        const rx = pt.x + _side.x * halfW;
        const rz = pt.z + _side.z * halfW;
        const ry = this.heightmap.getHeight(rx, rz) + 0.06;

        positions.push(lx, ly, lz);
        positions.push(rx, ry, rz);

        const vCoord = t * 18;
        uvs.push(0, vCoord);
        uvs.push(1, vCoord);

        if (i < steps) {
          const v0 = vertexOffset + i * 2;
          const v1 = v0 + 1;
          const v2 = v0 + 2;
          const v3 = v0 + 3;

          indices.push(v0, v1, v2);
          indices.push(v1, v3, v2);
        }
      }
      vertexOffset += (steps + 1) * 2;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }

  private buildRoadsideProps(): void {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x543d2b, roughness: 0.9, flatShading: true });
    const reflectorMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });

    // 1. Wooden shoulder guide stakes along summit curve
    const summitCurve = this.roadSplines[1];
    for (let i = 0; i < 22; i++) {
      const t = 0.1 + (i / 22) * 0.85;
      const pt = summitCurve.getPointAt(t);
      const tangent = summitCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Post on outer cliff side
      const postX = pt.x + normal.x * 2.2;
      const postZ = pt.z + normal.z * 2.2;
      const postY = this.heightmap.getHeight(postX, postZ);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.2, 5), postMat);
      post.position.set(postX, postY + 0.6, postZ);
      post.castShadow = true;
      this.group.add(post);

      const ref = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), reflectorMat);
      ref.position.set(postX, postY + 1.05, postZ);
      this.group.add(ref);
    }

    // 2. Trailhead Fork Signpost (Base Camp Exit)
    this.createDirectionalSign(
      new THREE.Vector3(7, 0, 18),
      [
        { text: '↱ Bear Creek Bridge & Lake', dir: 'right' },
        { text: '↰ Eagle Ridge Summit (4L Crawl)', dir: 'left' }
      ]
    );

    // 3. Bridge Warning Signpost
    this.createWarningSign(new THREE.Vector3(8, 0, -12), 'Bear Creek Timber Bridge');

    // 4. Summit Switchbacks Warning Signpost
    this.createWarningSign(new THREE.Vector3(26, 0, 19), 'Eagle Ridge 4WD Low Range');
  }

  private createDirectionalSign(pos: THREE.Vector3, signs: { text: string; dir: string }[]): void {
    const signGroup = new THREE.Group();
    const groundY = this.heightmap.getHeight(pos.x, pos.z);
    signGroup.position.set(pos.x, groundY, pos.z);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x4e3629, roughness: 0.9, flatShading: true });
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xc8aa78, roughness: 0.8, flatShading: true });

    // Main post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 6), postMat);
    post.position.set(0, 1.4, 0);
    post.castShadow = true;
    signGroup.add(post);

    // Sign planks
    signs.forEach((s, idx) => {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 0.06), boardMat);
      plank.position.set(s.dir === 'right' ? 0.35 : -0.35, 2.2 - idx * 0.38, 0);
      plank.rotation.y = s.dir === 'right' ? 0.15 : -0.15;
      plank.castShadow = true;
      signGroup.add(plank);
    });

    this.group.add(signGroup);
  }

  private createWarningSign(pos: THREE.Vector3, label: string): void {
    const signGroup = new THREE.Group();
    signGroup.name = label;
    const groundY = this.heightmap.getHeight(pos.x, pos.z);
    signGroup.position.set(pos.x, groundY, pos.z);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x4e3629, roughness: 0.9, flatShading: true });
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0xf5a623,
      emissive: 0x8a5500,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      flatShading: true
    });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.4, 5), postMat);
    post.position.set(0, 1.2, 0);
    post.castShadow = true;
    signGroup.add(post);

    // Diamond yellow warning sign
    const diamond = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.04), diamondMat);
    diamond.position.set(0, 2.0, 0);
    diamond.rotation.z = Math.PI / 4;
    diamond.castShadow = true;
    signGroup.add(diamond);

    // Sub-plate under warning sign
    const subPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.22, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xc4a36e, roughness: 0.8, flatShading: true })
    );
    subPlate.position.set(0, 1.48, 0.02);
    subPlate.castShadow = true;
    signGroup.add(subPlate);

    this.group.add(signGroup);
  }

  /**
   * Check if a position is on the established dirt roads
   */
  public isNearRoad(x: number, z: number, threshold = 2.4): boolean {
    const testPt = new THREE.Vector3(x, 0, z);
    for (const curve of this.roadSplines) {
      // Coarse distance check to curve points
      for (let t = 0; t <= 1; t += 0.05) {
        const p = curve.getPointAt(t);
        const dSq = (p.x - testPt.x) * (p.x - testPt.x) + (p.z - testPt.z) * (p.z - testPt.z);
        if (dSq < threshold * threshold) return true;
      }
    }
    return false;
  }
}
