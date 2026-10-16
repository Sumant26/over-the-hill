import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeightmapGenerator } from './HeightmapGenerator';
import { SurfaceProperties } from './SurfaceTypes';

export interface TerrainChunk {
  coordKey: string;
  chunkX: number;
  chunkZ: number;
  mesh: THREE.Mesh;
  collider: RAPIER.Collider;
  rigidBody: RAPIER.RigidBody;
}

export class TerrainManager {
  public chunkSize = 64; // 64 meters per chunk
  public segments = 32;  // 32x32 vertex grid per chunk
  public heightmap: HeightmapGenerator;

  private chunks = new Map<string, TerrainChunk>();
  private terrainGroup = new THREE.Group();
  private sharedMaterial: THREE.MeshStandardMaterial;
  public waterMesh: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    private physics: PhysicsWorld,
    seed = 42
  ) {
    this.heightmap = new HeightmapGenerator(seed);
    this.scene.add(this.terrainGroup);

    // Flat-shaded vertex-colored material for the stylized aesthetic
    this.sharedMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.05
    });

    // Glassy stylized alpine lake water plane matching Image 3
    const waterGeom = new THREE.PlaneGeometry(600, 600, 8, 8);
    waterGeom.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x3d88b0, // Vibrant alpine lake turquoise
      roughness: 0.08,
      metalness: 0.25,
      transparent: true,
      opacity: 0.86,
      flatShading: true
    });
    this.waterMesh = new THREE.Mesh(waterGeom, waterMat);
    this.waterMesh.position.set(0, -0.5, 0);
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  /**
   * Update active chunks around target position (e.g. player vehicle)
   */
  public updatePlayerPosition(playerPos: THREE.Vector3, radius = 2): void {
    this.waterMesh.position.x = playerPos.x;
    this.waterMesh.position.z = playerPos.z;

    const centerChunkX = Math.floor(playerPos.x / this.chunkSize);
    const centerChunkZ = Math.floor(playerPos.z / this.chunkSize);

    const neededKeys = new Set<string>();

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.chunks.has(key)) {
          this.createChunk(cx, cz);
        }
      }
    }

    // Unload distant chunks to save memory
    for (const [key, chunk] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.destroyChunk(chunk);
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Create a single terrain chunk with Three.js mesh & Rapier trimesh collider
   */
  public createChunk(chunkX: number, chunkZ: number): TerrainChunk {
    const key = `${chunkX},${chunkZ}`;
    if (this.chunks.has(key)) {
      return this.chunks.get(key)!;
    }

    const worldOffsetX = chunkX * this.chunkSize;
    const worldOffsetZ = chunkZ * this.chunkSize;

    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.segments,
      this.segments
    );

    // Rotate plane to lie on XZ plane
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const vertexCount = posAttr.count;
    const colors = new Float32Array(vertexCount * 3);

    // Displace vertices and calculate rich stylized colors based on surface type & elevation
    for (let i = 0; i < vertexCount; i++) {
      const localX = posAttr.getX(i);
      const localZ = posAttr.getZ(i);

      const worldX = localX + worldOffsetX + this.chunkSize / 2;
      const worldZ = localZ + worldOffsetZ + this.chunkSize / 2;

      const height = this.heightmap.getHeight(worldX, worldZ);
      posAttr.setY(i, height);

      // Shift position so local vertices align with world offset
      posAttr.setX(i, localX + this.chunkSize / 2);
      posAttr.setZ(i, localZ + this.chunkSize / 2);

      // Vertex color assignment with natural painterly hue variations
      const surface = this.heightmap.getSurface(worldX, worldZ, height);
      let r = surface.color.r;
      let g = surface.color.g;
      let b = surface.color.b;

      if (surface.name === 'grass') {
        // Multi-frequency tonal shift for rich golden alpine grass
        const hueShift = Math.sin(worldX * 0.08) * Math.cos(worldZ * 0.08) * 0.08;
        const tipGlow = Math.min(0.08, Math.max(-0.06, (height - 2.0) * 0.02));
        r = Math.min(1.0, Math.max(0.65, r + hueShift + tipGlow));
        g = Math.min(1.0, Math.max(0.55, g + hueShift * 0.8 + tipGlow * 0.9));
        b = Math.min(0.45, Math.max(0.12, b - hueShift * 0.3));
      } else if (surface.name === 'rock') {
        const rockNoise = (Math.sin(worldX * 0.3) + Math.cos(worldZ * 0.3)) * 0.04;
        r = Math.min(1.0, Math.max(0.3, r + rockNoise));
        g = Math.min(1.0, Math.max(0.3, g + rockNoise));
        b = Math.min(1.0, Math.max(0.35, b + rockNoise * 1.2));
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, this.sharedMaterial);
    mesh.position.set(worldOffsetX, 0, worldOffsetZ);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.terrainGroup.add(mesh);

    // Create Rapier physics trimesh collider
    const vertices = posAttr.array as Float32Array;
    const rawIndices = geometry.index ? geometry.index.array : new Uint32Array();
    const indices = rawIndices instanceof Uint32Array ? rawIndices : new Uint32Array(rawIndices);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(worldOffsetX, 0, worldOffsetZ);
    const rigidBody = this.physics.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
    const collider = this.physics.world.createCollider(colliderDesc, rigidBody);

    const chunk: TerrainChunk = {
      coordKey: key,
      chunkX,
      chunkZ,
      mesh,
      collider,
      rigidBody
    };

    this.chunks.set(key, chunk);
    return chunk;
  }

  private destroyChunk(chunk: TerrainChunk): void {
    this.terrainGroup.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    this.physics.world.removeCollider(chunk.collider, true);
    this.physics.world.removeRigidBody(chunk.rigidBody);
  }

  /**
   * Sample surface properties at any world coordinate (x, z)
   */
  public getSurfaceAt(x: number, z: number): SurfaceProperties {
    const height = this.heightmap.getHeight(x, z);
    return this.heightmap.getSurface(x, z, height);
  }

  public getHeightAt(x: number, z: number): number {
    return this.heightmap.getHeight(x, z);
  }

  public getActiveChunkCount(): number {
    return this.chunks.size;
  }
}
