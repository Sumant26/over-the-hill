export class Inclinometer {
  private container: HTMLElement;
  private rollAngleEl: HTMLElement | null = null;
  private pitchAngleEl: HTMLElement | null = null;
  private truckIconEl: HTMLElement | null = null;
  private warningEl: HTMLElement | null = null;

  constructor(parent: HTMLElement = document.body) {
    this.container = document.createElement('div');
    this.container.className = 'inclinometer-hud glass-panel';
    this.container.id = 'inclinometer-hud';
    this.container.innerHTML = `
      <div class="inclinometer-header">
        <span class="icon">🧭</span> INCLINOMETER
      </div>
      <div class="inclinometer-dial">
        <div class="horizon-line" id="incline-horizon"></div>
        <div class="truck-silhouette" id="incline-truck">🚙</div>
      </div>
      <div class="inclinometer-data">
        <div class="data-badge">
          <span class="label">PITCH</span>
          <span class="value" id="pitch-val">0°</span>
        </div>
        <div class="data-badge">
          <span class="label">ROLL</span>
          <span class="value" id="roll-val">0°</span>
        </div>
      </div>
      <div class="rollover-warning" id="rollover-warning" style="display: none;">
        ⚠️ ROLLOVER RISK
      </div>
    `;

    parent.appendChild(this.container);

    this.rollAngleEl = this.container.querySelector('#roll-val');
    this.pitchAngleEl = this.container.querySelector('#pitch-val');
    this.truckIconEl = this.container.querySelector('#incline-truck');
    this.warningEl = this.container.querySelector('#rollover-warning');
  }

  public update(pitchDeg: number, rollDeg: number): void {
    if (this.pitchAngleEl) {
      this.pitchAngleEl.textContent = `${pitchDeg > 0 ? '+' : ''}${pitchDeg}°`;
    }
    if (this.rollAngleEl) {
      this.rollAngleEl.textContent = `${rollDeg > 0 ? '+' : ''}${rollDeg}°`;
    }

    if (this.truckIconEl) {
      this.truckIconEl.style.transform = `rotate(${rollDeg}deg) translateY(${-pitchDeg * 0.8}px)`;
    }

    // Critical rollover threshold at 35 degrees
    const isCritical = Math.abs(rollDeg) >= 35 || Math.abs(pitchDeg) >= 38;
    if (this.warningEl) {
      this.warningEl.style.display = isCritical ? 'block' : 'none';
      if (isCritical) {
        this.container.classList.add('critical-tilt');
      } else {
        this.container.classList.remove('critical-tilt');
      }
    }
  }

  public destroy(): void {
    this.container.remove();
  }
}
