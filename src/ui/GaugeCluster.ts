export interface GaugeData {
  speedKmh: number;
  rpm: number;
  gear: number;
  isLowRange: boolean;
  isDiffLocked: boolean;
  winchAttached: boolean;
  winchLength: number;
  winchTension: number;
  surfaceType: string;
  cameraModeName?: string;
  timePresetName?: string;
  headingDeg?: number;
  winchAnchorDist?: number | null;
}

export class GaugeCluster {
  private container: HTMLElement;
  private speedEl: HTMLElement | null = null;
  private rpmBarEl: HTMLElement | null = null;
  private rpmValEl: HTMLElement | null = null;
  private gearEl: HTMLElement | null = null;
  private tcaseEl: HTMLElement | null = null;
  private diffLockEl: HTMLElement | null = null;
  private winchStatusEl: HTMLElement | null = null;
  private surfaceBadgeEl: HTMLElement | null = null;
  private cameraBadgeEl: HTMLElement | null = null;
  private timeBadgeEl: HTMLElement | null = null;
  private compassEl: HTMLElement | null = null;
  private notificationEl: HTMLElement | null = null;
  private notifTimeout: any = null;

  constructor(parent: HTMLElement = document.body) {
    this.container = document.createElement('div');
    this.container.className = 'gauge-cluster glass-panel';
    this.container.id = 'gauge-cluster';
    this.container.innerHTML = `
      <div class="gauge-top-row">
        <div class="compass-badge" id="gauge-compass">🧭 N 0°</div>
        <div class="mode-badge" id="gauge-time">SUNSET</div>
        <div class="mode-badge" id="gauge-cam">CINEMATIC</div>
      </div>

      <div class="gauge-main">
        <div class="speed-display">
          <span class="speed-number" id="gauge-speed">0</span>
          <span class="speed-unit">KM/H</span>
        </div>
        <div class="gear-display" id="gauge-gear">1</div>
      </div>

      <div class="rpm-meter">
        <div class="rpm-bar-container">
          <div class="rpm-bar" id="rpm-fill"></div>
        </div>
        <div class="rpm-label">
          <span>RPM</span>
          <span id="rpm-text">800</span>
        </div>
      </div>

      <div class="badges-row">
        <div class="badge badge-tcase" id="badge-tcase">4H</div>
        <div class="badge badge-diff" id="badge-diff">DIFF OPEN</div>
        <div class="badge badge-surface" id="badge-surface">DIRT</div>
      </div>

      <div class="winch-bar" id="winch-hud">
        <span class="winch-title">🪝 WINCH</span>
        <span class="winch-info" id="winch-info">READY [E]</span>
      </div>
    `;

    parent.appendChild(this.container);

    // Create discovery toast overlay
    this.notificationEl = document.createElement('div');
    this.notificationEl.className = 'discovery-banner glass-panel';
    this.notificationEl.id = 'discovery-banner';
    this.notificationEl.style.display = 'none';
    parent.appendChild(this.notificationEl);

    this.speedEl = this.container.querySelector('#gauge-speed');
    this.rpmBarEl = this.container.querySelector('#rpm-fill');
    this.rpmValEl = this.container.querySelector('#rpm-text');
    this.gearEl = this.container.querySelector('#gauge-gear');
    this.tcaseEl = this.container.querySelector('#badge-tcase');
    this.diffLockEl = this.container.querySelector('#badge-diff');
    this.winchStatusEl = this.container.querySelector('#winch-info');
    this.surfaceBadgeEl = this.container.querySelector('#badge-surface');
    this.cameraBadgeEl = this.container.querySelector('#gauge-cam');
    this.timeBadgeEl = this.container.querySelector('#gauge-time');
    this.compassEl = this.container.querySelector('#gauge-compass');
  }

  public showNotification(title: string, subtitle = 'New Trail Landmark Discovered!'): void {
    if (!this.notificationEl) return;
    if (this.notifTimeout) clearTimeout(this.notifTimeout);

    this.notificationEl.innerHTML = `
      <div class="banner-icon">📍</div>
      <div class="banner-text">
        <div class="banner-title">${title}</div>
        <div class="banner-sub">${subtitle}</div>
      </div>
    `;
    this.notificationEl.style.display = 'flex';
    this.notificationEl.classList.add('banner-pop');

    this.notifTimeout = setTimeout(() => {
      if (this.notificationEl) {
        this.notificationEl.style.display = 'none';
        this.notificationEl.classList.remove('banner-pop');
      }
    }, 4500);
  }

  public update(data: GaugeData): void {
    if (this.speedEl) this.speedEl.textContent = `${data.speedKmh}`;

    if (this.gearEl) {
      this.gearEl.textContent = data.gear === -1 ? 'R' : `${data.gear}`;
      if (data.gear === -1) {
        this.gearEl.classList.add('reverse');
      } else {
        this.gearEl.classList.remove('reverse');
      }
    }

    if (this.rpmBarEl && this.rpmValEl) {
      const pct = Math.min(100, Math.max(0, ((data.rpm - 800) / (5500 - 800)) * 100));
      this.rpmBarEl.style.width = `${pct}%`;
      this.rpmValEl.textContent = `${data.rpm}`;
      if (pct > 78) {
        this.rpmBarEl.classList.add('redline');
      } else {
        this.rpmBarEl.classList.remove('redline');
      }
    }

    if (this.tcaseEl) {
      this.tcaseEl.textContent = data.isLowRange ? '4L (LOW)' : '4H (HIGH)';
      if (data.isLowRange) {
        this.tcaseEl.classList.add('active-low');
      } else {
        this.tcaseEl.classList.remove('active-low');
      }
    }

    if (this.diffLockEl) {
      this.diffLockEl.textContent = data.isDiffLocked ? 'DIFF LOCKED' : 'DIFF OPEN';
      if (data.isDiffLocked) {
        this.diffLockEl.classList.add('active-lock');
      } else {
        this.diffLockEl.classList.remove('active-lock');
      }
    }

    if (this.surfaceBadgeEl) {
      this.surfaceBadgeEl.textContent = data.surfaceType.toUpperCase();
    }

    if (this.cameraBadgeEl && data.cameraModeName) {
      this.cameraBadgeEl.textContent = data.cameraModeName.toUpperCase().replace('OVER THE HILL ', '');
    }

    if (this.timeBadgeEl && data.timePresetName) {
      this.timeBadgeEl.textContent = data.timePresetName.toUpperCase();
    }

    if (this.compassEl && data.headingDeg !== undefined) {
      const deg = Math.round((data.headingDeg % 360 + 360) % 360);
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const dir = dirs[Math.round(deg / 45) % 8];
      this.compassEl.textContent = `🧭 ${dir} ${deg}°`;
    }

    if (this.winchStatusEl) {
      if (data.winchAttached) {
        this.winchStatusEl.textContent = `${data.winchLength.toFixed(1)}m | ${(data.winchTension / 1000).toFixed(1)}kN [F/V]`;
        this.winchStatusEl.classList.add('attached');
      } else if (data.winchAnchorDist !== null && data.winchAnchorDist !== undefined) {
        this.winchStatusEl.textContent = `LOCK ${data.winchAnchorDist.toFixed(1)}m [E]`;
        this.winchStatusEl.classList.add('attached');
      } else {
        this.winchStatusEl.textContent = 'READY [E]';
        this.winchStatusEl.classList.remove('attached');
      }
    }
  }

  public destroy(): void {
    this.container.remove();
    if (this.notificationEl) this.notificationEl.remove();
  }
}
