import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Winch } from '../../src/physics/Winch';

describe('Winch System', () => {
  it('attaches to anchor points within max cable range', () => {
    const winch = new Winch({ maxCableLength: 25 });
    const bumper = new THREE.Vector3(0, 1, 0);
    const anchor = new THREE.Vector3(0, 1, 15);

    const success = winch.attach(anchor, bumper);
    expect(success).toBe(true);
    expect(winch.isAttached).toBe(true);
    expect(winch.cableLength).toBeCloseTo(15);
  });

  it('rejects anchors beyond maximum reach', () => {
    const winch = new Winch({ maxCableLength: 20 });
    const bumper = new THREE.Vector3(0, 1, 0);
    const distantAnchor = new THREE.Vector3(0, 1, 50);

    const success = winch.attach(distantAnchor, bumper);
    expect(success).toBe(false);
    expect(winch.isAttached).toBe(false);
  });

  it('finds best forward anchor from a list of candidate points', () => {
    const winch = new Winch({ maxCableLength: 30 });
    const bumper = new THREE.Vector3(0, 1, 0);
    const forward = new THREE.Vector3(0, 0, 1);

    const behind = new THREE.Vector3(0, 1, -10);
    const side = new THREE.Vector3(20, 1, 0);
    const directFront = new THREE.Vector3(0, 1, 12);

    const best = winch.findBestAnchor(bumper, forward, [behind, side, directFront]);
    expect(best).not.toBeNull();
    expect(best?.z).toBe(12);
  });

  it('releases and zeroes tension', () => {
    const winch = new Winch();
    winch.attach(new THREE.Vector3(0, 1, 10), new THREE.Vector3(0, 1, 0));
    winch.currentTension = 5000;

    winch.release();
    expect(winch.isAttached).toBe(false);
    expect(winch.anchorPoint).toBeNull();
    expect(winch.currentTension).toBe(0);
  });
});
