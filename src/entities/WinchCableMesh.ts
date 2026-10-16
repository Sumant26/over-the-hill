import * as THREE from 'three';

export class WinchCableMesh {
  private lineMesh: THREE.Line;
  private positions: Float32Array;
  private geometry: THREE.BufferGeometry;
  private material: THREE.LineBasicMaterial;
  private numPoints = 12;

  constructor(private scene: THREE.Scene) {
    this.positions = new Float32Array(this.numPoints * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.LineBasicMaterial({
      color: 0xcccccc,
      linewidth: 3
    });

    this.lineMesh = new THREE.Line(this.geometry, this.material);
    this.lineMesh.visible = false;
    this.scene.add(this.lineMesh);
  }

  /**
   * Update 3D cable visualization with catenary sag and tension color
   */
  public update(
    bumperPos: THREE.Vector3,
    anchorPos: THREE.Vector3 | null,
    isAttached: boolean,
    tensionRatio: number // 0 to 1
  ): void {
    if (!isAttached || !anchorPos) {
      this.lineMesh.visible = false;
      return;
    }

    this.lineMesh.visible = true;

    // Cable sag depends on slack (1 - tensionRatio)
    const sag = (1 - Math.min(1, tensionRatio)) * 0.8;

    for (let i = 0; i < this.numPoints; i++) {
      const t = i / (this.numPoints - 1);
      const x = THREE.MathUtils.lerp(bumperPos.x, anchorPos.x, t);
      const z = THREE.MathUtils.lerp(bumperPos.z, anchorPos.z, t);

      // Catenary sag curve: parabolic drop in the middle
      const yLinear = THREE.MathUtils.lerp(bumperPos.y, anchorPos.y, t);
      const sagOffset = Math.sin(t * Math.PI) * sag;
      const y = yLinear - sagOffset;

      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
    }

    this.geometry.attributes.position.needsUpdate = true;

    // Color shift based on tension: Gray -> Yellow -> Orange -> Red
    if (tensionRatio > 0.7) {
      this.material.color.setHex(0xff3322); // Critical strain
    } else if (tensionRatio > 0.3) {
      this.material.color.setHex(0xffaa22); // Active pulling
    } else {
      this.material.color.setHex(0xaaaaaa); // Slack
    }
  }

  public dispose(): void {
    this.scene.remove(this.lineMesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
