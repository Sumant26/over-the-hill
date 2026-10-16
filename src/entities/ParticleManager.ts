import * as THREE from 'three';

export interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  alpha: number;
}

export class ParticleManager {
  private particles: Particle[] = [];
  private maxParticles = 300;
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private pointsMesh: THREE.Points;

  // Reusable colors matching golden hour aesthetic
  private dustColor = new THREE.Color(0xf0c65c); // Warm golden trail dust
  private mudColor = new THREE.Color(0x4a321e);  // Rich damp silt
  private waterColor = new THREE.Color(0xcbe6ff); // Glacial water spray
  private exhaustColor = new THREE.Color(0xb0b8c0);

  constructor(private scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Create a circular particle texture procedurally
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.4)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.pointsMesh = new THREE.Points(this.geometry, material);
    this.pointsMesh.frustumCulled = false;
    this.scene.add(this.pointsMesh);
  }

  public emitDust(origin: THREE.Vector3, slipRatio: number, surfaceType: string): void {
    if (this.particles.length >= this.maxParticles) return;
    if (slipRatio < 0.15 && Math.random() > 0.3) return;

    const count = Math.min(3, Math.ceil(slipRatio * 4));
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      let color = this.dustColor;
      let pSize = 0.8 + Math.random() * 0.8;
      let life = 0.6 + Math.random() * 0.5;

      if (surfaceType === 'mud') {
        color = this.mudColor;
        pSize *= 1.2;
      } else if (surfaceType === 'water') {
        color = this.waterColor;
        pSize *= 1.4;
      }

      this.particles.push({
        pos: new THREE.Vector3(
          origin.x + (Math.random() - 0.5) * 0.4,
          origin.y + 0.1 + Math.random() * 0.2,
          origin.z + (Math.random() - 0.5) * 0.4
        ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          0.8 + Math.random() * 1.5,
          (Math.random() - 0.5) * 1.5
        ),
        life: 0,
        maxLife: life,
        size: pSize,
        color: color.clone(),
        alpha: 0.7
      });
    }
  }

  public emitExhaust(origin: THREE.Vector3, forwardDir: THREE.Vector3, throttle: number): void {
    if (this.particles.length >= this.maxParticles) return;
    if (throttle <= 0.05 && Math.random() > 0.15) return;

    this.particles.push({
      pos: origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1)),
      vel: new THREE.Vector3(
        -forwardDir.x * (0.8 + throttle * 2.0) + (Math.random() - 0.5) * 0.4,
        0.4 + Math.random() * 0.6,
        -forwardDir.z * (0.8 + throttle * 2.0) + (Math.random() - 0.5) * 0.4
      ),
      life: 0,
      maxLife: 0.5 + Math.random() * 0.4,
      size: 0.5 + Math.random() * 0.5,
      color: this.exhaustColor.clone(),
      alpha: 0.4 + throttle * 0.3
    });
  }

  public update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.pos.addScaledVector(p.vel, dt);
      p.vel.y += 0.3 * dt; // slight upward drift
      p.size += dt * 0.8;  // expand as it dissipates
    }

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    let idx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const fade = 1 - p.life / p.maxLife;

      this.positions[idx * 3] = p.pos.x;
      this.positions[idx * 3 + 1] = p.pos.y;
      this.positions[idx * 3 + 2] = p.pos.z;

      this.colors[idx * 3] = p.color.r * fade;
      this.colors[idx * 3 + 1] = p.color.g * fade;
      this.colors[idx * 3 + 2] = p.color.b * fade;

      idx++;
    }

    // Hide remainder
    for (let i = idx; i < this.maxParticles; i++) {
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = -9999;
      this.positions[i * 3 + 2] = 0;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}
