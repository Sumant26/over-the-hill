import * as THREE from 'three';

export class WheelMesh {
  public mesh: THREE.Group;
  private tireMesh: THREE.Mesh;
  private rimMesh: THREE.Mesh;

  constructor(radius = 0.42, width = 0.32) {
    this.mesh = new THREE.Group();

    // 1. Tire Rubber (Deep charcoal/black with flat shading)
    const tireGeom = new THREE.CylinderGeometry(radius, radius, width, 18);
    tireGeom.rotateZ(Math.PI / 2); // Orient axle along X axis

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x161719,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true
    });
    this.tireMesh = new THREE.Mesh(tireGeom, tireMat);
    this.tireMesh.castShadow = true;
    this.mesh.add(this.tireMesh);

    // Aggressive Knobby Mud-Terrain Tread Lugs
    const lugGeom = new THREE.BoxGeometry(width * 0.9, radius * 0.14, radius * 0.18);
    const lugCount = 14;
    for (let i = 0; i < lugCount; i++) {
      const angle = (i / lugCount) * Math.PI * 2;
      const lug = new THREE.Mesh(lugGeom, tireMat);
      lug.position.set(0, Math.sin(angle) * (radius + 0.022), Math.cos(angle) * (radius + 0.022));
      lug.rotation.x = -angle;
      this.mesh.add(lug);
    }

    // 2. Off-Road Deep Dish Rim (Polished silver / machined alloy steelie matching Image 1)
    const rimGeom = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 1.02, 16);
    rimGeom.rotateZ(Math.PI / 2);

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd8dde3, // Silver/chrome off-road rim
      roughness: 0.22,
      metalness: 0.75,
      flatShading: true
    });
    this.rimMesh = new THREE.Mesh(rimGeom, rimMat);
    this.mesh.add(this.rimMesh);

    // 3. Center Hub Cap & Lug Nuts
    const hubGeom = new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width * 1.08, 10);
    hubGeom.rotateZ(Math.PI / 2);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x222225,
      metalness: 0.8,
      roughness: 0.25
    });
    const hubMesh = new THREE.Mesh(hubGeom, hubMat);
    this.mesh.add(hubMesh);

    // Lug nuts ring
    const nutGeom = new THREE.CylinderGeometry(0.025, 0.025, width * 1.1, 6);
    nutGeom.rotateZ(Math.PI / 2);
    const nutMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
    for (let i = 0; i < 5; i++) {
      const nutAngle = (i / 5) * Math.PI * 2;
      const nut = new THREE.Mesh(nutGeom, nutMat);
      nut.position.set(0, Math.sin(nutAngle) * (radius * 0.38), Math.cos(nutAngle) * (radius * 0.38));
      this.mesh.add(nut);
    }
  }

  public updateTransform(position: THREE.Vector3, rotation: THREE.Quaternion): void {
    this.mesh.position.copy(position);
    this.mesh.quaternion.copy(rotation);
  }
}
