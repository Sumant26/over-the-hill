import * as THREE from 'three';

export interface TimePreset {
  name: string;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  sunOffset: THREE.Vector3;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  skyZenith: string;
  skyHorizon: string;
}

export class Environment {
  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public currentPresetIndex = 0;

  private skyMesh: THREE.Mesh;
  private ambientMotes!: THREE.Points;
  private motePositions!: Float32Array;
  private moteCount = 140;

  public presets: TimePreset[] = [
    {
      name: 'Over the Hill Golden Hour',
      fogColor: 0xf7cfb2, // Soft warm peach/apricot haze
      fogDensity: 0.005,
      sunColor: 0xffdfa8, // Warm rich golden sunlight
      sunIntensity: 2.6,
      sunOffset: new THREE.Vector3(70, 48, 42),
      hemiSkyColor: 0x62b9f3, // Crisp cyan/sky blue ambient skylight
      hemiGroundColor: 0x734825, // Warm golden-amber ground bounce
      hemiIntensity: 1.1,
      skyZenith: '#3a9ee6',
      skyHorizon: '#ffd5a4'
    },
    {
      name: 'Alpine Clear Sky',
      fogColor: 0xd8eaf7,
      fogDensity: 0.004,
      sunColor: 0xfff6dd,
      sunIntensity: 2.3,
      sunOffset: new THREE.Vector3(45, 80, 50),
      hemiSkyColor: 0x7ac1f7,
      hemiGroundColor: 0x6b5336,
      hemiIntensity: 1.0,
      skyZenith: '#298be0',
      skyHorizon: '#e4f3ff'
    },
    {
      name: 'Midnight Expedition',
      fogColor: 0x0a101d,
      fogDensity: 0.0085,
      sunColor: 0x829cff,
      sunIntensity: 0.5,
      sunOffset: new THREE.Vector3(30, 75, 25),
      hemiSkyColor: 0x1b2854,
      hemiGroundColor: 0x080c14,
      hemiIntensity: 0.4,
      skyZenith: '#060a14',
      skyHorizon: '#162238'
    }
  ];

  constructor(private scene: THREE.Scene) {
    const p = this.presets[0];

    // 1. Atmospheric Fog
    const fogColor = new THREE.Color(p.fogColor);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.FogExp2(fogColor, p.fogDensity);

    // 2. Stylized Gradient Sky Dome
    const skyGeom = new THREE.SphereGeometry(650, 32, 16);
    skyGeom.scale(-1, 1, 1);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.generateSkyTexture(p.skyZenith, p.skyHorizon),
      fog: false,
      depthWrite: false
    });
    this.skyMesh = new THREE.Mesh(skyGeom, skyMat);
    this.scene.add(this.skyMesh);

    // 3. Hemisphere Ambient Skylight
    this.hemiLight = new THREE.HemisphereLight(p.hemiSkyColor, p.hemiGroundColor, p.hemiIntensity);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // 4. Directional Sunlight
    this.dirLight = new THREE.DirectionalLight(p.sunColor, p.sunIntensity);
    this.dirLight.position.copy(p.sunOffset);
    this.dirLight.castShadow = true;

    // Focused shadow frustum around the vehicle
    const d = 42;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 190;

    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.bias = -0.0003;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 5. Floating Ambient Sun Dust & Pollen Motes (Image 2 & 3)
    this.createAmbientMotes();
  }

  private generateSkyTexture(zenithColor: string, horizonColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, zenithColor);
    grad.addColorStop(0.55, zenithColor);
    grad.addColorStop(0.85, horizonColor);
    grad.addColorStop(1.0, horizonColor);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private createAmbientMotes(): void {
    const geom = new THREE.BufferGeometry();
    this.motePositions = new Float32Array(this.moteCount * 3);

    for (let i = 0; i < this.moteCount; i++) {
      this.motePositions[i * 3] = (Math.random() - 0.5) * 50;
      this.motePositions[i * 3 + 1] = Math.random() * 18;
      this.motePositions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(this.motePositions, 3));

    // Circular glowing dot texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255, 245, 200, 0.95)');
    g.addColorStop(0.3, 'rgba(255, 210, 130, 0.6)');
    g.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    const mat = new THREE.PointsMaterial({
      size: 0.9,
      map: texture,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.ambientMotes = new THREE.Points(geom, mat);
    this.ambientMotes.frustumCulled = false;
    this.scene.add(this.ambientMotes);
  }

  public cycleTimeOfDay(): string {
    this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presets.length;
    const p = this.presets[this.currentPresetIndex];

    const fogCol = new THREE.Color(p.fogColor);
    this.scene.background = fogCol;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color = fogCol;
      this.scene.fog.density = p.fogDensity;
    }

    // Update Sky Texture
    if (this.skyMesh.material instanceof THREE.MeshBasicMaterial) {
      this.skyMesh.material.map?.dispose();
      this.skyMesh.material.map = this.generateSkyTexture(p.skyZenith, p.skyHorizon);
      this.skyMesh.material.needsUpdate = true;
    }

    this.hemiLight.color.setHex(p.hemiSkyColor);
    this.hemiLight.groundColor.setHex(p.hemiGroundColor);
    this.hemiLight.intensity = p.hemiIntensity;

    this.dirLight.color.setHex(p.sunColor);
    this.dirLight.intensity = p.sunIntensity;

    return p.name;
  }

  public getTimePresetName(): string {
    return this.presets[this.currentPresetIndex].name;
  }

  public update(playerPos: THREE.Vector3): void {
    const offset = this.presets[this.currentPresetIndex].sunOffset;
    this.dirLight.position.set(playerPos.x + offset.x, playerPos.y + offset.y, playerPos.z + offset.z);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();

    // Center sky dome on player
    this.skyMesh.position.copy(playerPos);

    // Slowly drift ambient motes around player
    if (this.ambientMotes) {
      const posAttr = this.ambientMotes.geometry.attributes.position as THREE.BufferAttribute;
      const t = performance.now() * 0.001;
      for (let i = 0; i < this.moteCount; i++) {
        let x = this.motePositions[i * 3];
        let y = this.motePositions[i * 3 + 1];
        let z = this.motePositions[i * 3 + 2];

        // Wrap around player
        if (Math.abs(x - playerPos.x) > 25) x = playerPos.x + (Math.random() - 0.5) * 45;
        if (y < playerPos.y - 2) y = playerPos.y + 12;
        if (y > playerPos.y + 15) y = playerPos.y + 1;
        if (Math.abs(z - playerPos.z) > 25) z = playerPos.z + (Math.random() - 0.5) * 45;

        // Gentle floating drift
        y -= 0.008;
        x += Math.sin(t + i) * 0.015;
        z += Math.cos(t + i) * 0.015;

        this.motePositions[i * 3] = x;
        this.motePositions[i * 3 + 1] = y;
        this.motePositions[i * 3 + 2] = z;
      }
      posAttr.needsUpdate = true;
    }
  }
}
