import { describe, it, expect, beforeEach } from 'vitest';
import { Inclinometer } from '../../src/ui/Inclinometer';
import { GaugeCluster, GaugeData } from '../../src/ui/GaugeCluster';

describe('UI HUD Components', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders and updates Inclinometer pitch and roll degrees', () => {
    const inclinometer = new Inclinometer();
    inclinometer.update(15, -22);

    const pitchEl = document.getElementById('pitch-val');
    const rollEl = document.getElementById('roll-val');
    const warningEl = document.getElementById('rollover-warning');

    expect(pitchEl?.textContent).toBe('+15°');
    expect(rollEl?.textContent).toBe('-22°');
    expect(warningEl?.style.display).toBe('none');

    // Trigger critical rollover
    inclinometer.update(10, 42);
    expect(warningEl?.style.display).toBe('block');
  });

  it('renders and updates GaugeCluster speedometer, tachometer, and badges', () => {
    const cluster = new GaugeCluster();
    const data: GaugeData = {
      speedKmh: 45,
      rpm: 3200,
      gear: 2,
      isLowRange: true,
      isDiffLocked: true,
      winchAttached: true,
      winchLength: 12.5,
      winchTension: 6200,
      surfaceType: 'mud'
    };

    cluster.update(data);

    const speedEl = document.getElementById('gauge-speed');
    const gearEl = document.getElementById('gauge-gear');
    const tcaseEl = document.getElementById('badge-tcase');
    const diffEl = document.getElementById('badge-diff');
    const surfaceEl = document.getElementById('badge-surface');

    expect(speedEl?.textContent).toBe('45');
    expect(gearEl?.textContent).toBe('2');
    expect(tcaseEl?.textContent).toContain('4L');
    expect(diffEl?.textContent).toBe('DIFF LOCKED');
    expect(surfaceEl?.textContent).toBe('MUD');
  });
});
