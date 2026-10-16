export interface ControlInputs {
  throttle: number;      // 0 to 1 (Player 1)
  brake: number;         // 0 to 1 (Player 1)
  steer: number;         // -1 to 1 (Player 1)
  handbrake: boolean;

  // Player 2 / 2-Player Co-op Inputs
  p2Throttle: number;    // 0 to 1
  p2Brake: number;       // 0 to 1
  p2Steer: number;       // -1 to 1
  p2Handbrake: boolean;

  // Convoy & Multi-Vehicle Controls
  switchNextVehicle: boolean;
  selectVehicleIndex: number | null; // 0, 1, 2, 3
  toggleCoop: boolean;

  toggleDiffLock: boolean;
  toggleLowRange: boolean;
  winchAttachToggle: boolean;
  winchPull: boolean;
  winchRelease: boolean;
  resetVehicle: boolean;
  toggleAudio: boolean;
  toggleCamera: boolean;
  toggleTimeOfDay: boolean;
  toggleRecoveryBoards: boolean;
  togglePaintColor: boolean;
}

export class InputManager {
  private keys: Record<string, boolean> = {};
  private justPressed: Set<string> = new Set();
  private prevGpButtons: Record<number, boolean> = {};

  private activeInputs: ControlInputs = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    p2Throttle: 0,
    p2Brake: 0,
    p2Steer: 0,
    p2Handbrake: false,
    switchNextVehicle: false,
    selectVehicleIndex: null,
    toggleCoop: false,
    toggleDiffLock: false,
    toggleLowRange: false,
    winchAttachToggle: false,
    winchPull: false,
    winchRelease: false,
    resetVehicle: false,
    toggleAudio: false,
    toggleCamera: false,
    toggleTimeOfDay: false,
    toggleRecoveryBoards: false,
    togglePaintColor: false
  };

  private gameKeyCodes = new Set([
    'KeyW', 'KeyS', 'KeyA', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'Tab', 'KeyK', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
    'KeyL', 'KeyH', 'KeyE', 'KeyF', 'KeyV', 'KeyR', 'KeyM', 'KeyC', 'KeyT', 'KeyB', 'KeyP'
  ]);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
      window.addEventListener('keyup', (e) => this.onKeyUp(e));
      window.addEventListener('blur', () => this.clearKeys());
    }
  }

  public clearKeys(): void {
    this.keys = {};
    this.justPressed.clear();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.gameKeyCodes.has(e.code) || e.key === ' ' || e.code === 'Tab' || e.key.startsWith('Arrow')) {
      e.preventDefault();
    }
    // Record rising edge for single-press toggles
    if (!e.repeat && !this.keys[e.code]) {
      this.justPressed.add(e.code);
      if (e.key) {
        this.justPressed.add(e.key.toLowerCase());
      }
    }
    this.keys[e.code] = true;
    if (e.key) {
      this.keys[e.key.toLowerCase()] = true;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
    if (e.key) {
      this.keys[e.key.toLowerCase()] = false;
    }
  }

  private isPressed(...names: string[]): boolean {
    return names.some((k) => !!this.keys[k]);
  }

  private consumeJustPressed(...names: string[]): boolean {
    let triggered = false;
    for (const name of names) {
      if (this.justPressed.has(name)) {
        triggered = true;
        this.justPressed.delete(name);
      }
    }
    return triggered;
  }

  private checkGpPressed(gp: Gamepad | null, buttonIndex: number): boolean {
    if (!gp) return false;
    const isDown = !!gp.buttons[buttonIndex]?.pressed;
    const wasDown = !!this.prevGpButtons[buttonIndex];
    this.prevGpButtons[buttonIndex] = isDown;
    return isDown && !wasDown;
  }

  /**
   * Sample keyboard and standard Gamepad inputs
   */
  public update(): ControlInputs {
    // Player 1 controls
    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let handbrake = false;

    // Player 2 controls (Arrow keys or 2nd gamepad)
    let p2Throttle = 0;
    let p2Brake = 0;
    let p2Steer = 0;
    let p2Handbrake = false;

    let winchPull = false;
    let winchRelease = false;

    // 1. Keyboard: Player 1 (W, S, A, D, Space)
    if (this.isPressed('KeyW', 'w', 'z')) throttle = 1.0;
    if (this.isPressed('KeyS', 's')) brake = 1.0;
    if (this.isPressed('KeyA', 'a', 'q')) steer -= 1.0;
    if (this.isPressed('KeyD', 'd')) steer += 1.0;
    if (this.isPressed('Space', ' ')) handbrake = true;

    // 2. Keyboard: Player 2 (Arrow keys, Numpad 0 / ShiftRight)
    if (this.isPressed('ArrowUp')) p2Throttle = 1.0;
    if (this.isPressed('ArrowDown')) p2Brake = 1.0;
    if (this.isPressed('ArrowLeft')) p2Steer -= 1.0;
    if (this.isPressed('ArrowRight')) p2Steer += 1.0;
    if (this.isPressed('Numpad0', 'ShiftRight')) p2Handbrake = true;

    // Accessibility fallback: If no WASD pressed and Arrow keys pressed without Co-op mode,
    // allow Arrow keys to also drive Player 1!
    if (throttle === 0 && brake === 0 && steer === 0) {
      if (p2Throttle > 0) throttle = p2Throttle;
      if (p2Brake > 0) brake = p2Brake;
      if (p2Steer !== 0) steer = p2Steer;
      if (p2Handbrake) handbrake = true;
    }

    if (this.isPressed('KeyF', 'f')) winchPull = true;
    if (this.isPressed('KeyV', 'v')) winchRelease = true;

    // Direct vehicle number selection [1], [2], [3], [4]
    let selectedNum: number | null = null;
    const digitCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    for (let i = 0; i < digitCodes.length; i++) {
      if (this.consumeJustPressed(digitCodes[i], (i + 1).toString())) {
        selectedNum = i;
      }
    }

    // 3. Gamepad API
    let gp: Gamepad | null = null;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      gp = gamepads[0] ?? null;
      if (gp && gp.connected) {
        const axisX = gp.axes[0] ?? 0;
        if (Math.abs(axisX) > 0.12) steer = axisX;

        const rt = gp.buttons[7]?.value ?? 0;
        const lt = gp.buttons[6]?.value ?? 0;
        if (rt > 0.05) throttle = Math.max(throttle, rt);
        if (lt > 0.05) brake = Math.max(brake, lt);

        if (gp.buttons[0]?.pressed) handbrake = true;
        if (gp.buttons[5]?.pressed) winchPull = true;
        if (gp.buttons[4]?.pressed) winchRelease = true;
      }

      // Gamepad 2 for Player 2
      const gp2 = gamepads[1];
      if (gp2 && gp2.connected) {
        const axisX = gp2.axes[0] ?? 0;
        if (Math.abs(axisX) > 0.12) p2Steer = axisX;
        const rt = gp2.buttons[7]?.value ?? 0;
        const lt = gp2.buttons[6]?.value ?? 0;
        if (rt > 0.05) p2Throttle = Math.max(p2Throttle, rt);
        if (lt > 0.05) p2Brake = Math.max(p2Brake, lt);
        if (gp2.buttons[0]?.pressed) p2Handbrake = true;
      }
    }

    // Assign Active Inputs
    this.activeInputs.throttle = throttle;
    this.activeInputs.brake = brake;
    this.activeInputs.steer = steer;
    this.activeInputs.handbrake = handbrake;

    this.activeInputs.p2Throttle = p2Throttle;
    this.activeInputs.p2Brake = p2Brake;
    this.activeInputs.p2Steer = p2Steer;
    this.activeInputs.p2Handbrake = p2Handbrake;

    this.activeInputs.switchNextVehicle = this.consumeJustPressed('Tab');
    this.activeInputs.selectVehicleIndex = selectedNum;
    this.activeInputs.toggleCoop = this.consumeJustPressed('KeyK', 'k');

    this.activeInputs.toggleDiffLock = this.consumeJustPressed('KeyL', 'l') || this.checkGpPressed(gp, 3);
    this.activeInputs.toggleLowRange = this.consumeJustPressed('KeyH', 'h') || this.checkGpPressed(gp, 2);
    this.activeInputs.winchAttachToggle = this.consumeJustPressed('KeyE', 'e') || this.checkGpPressed(gp, 1);
    this.activeInputs.winchPull = winchPull;
    this.activeInputs.winchRelease = winchRelease;
    this.activeInputs.resetVehicle = this.consumeJustPressed('KeyR', 'r') || this.checkGpPressed(gp, 8) || this.checkGpPressed(gp, 9);
    this.activeInputs.toggleAudio = this.consumeJustPressed('KeyM', 'm');
    this.activeInputs.toggleCamera = this.consumeJustPressed('KeyC', 'c') || this.checkGpPressed(gp, 10);
    this.activeInputs.toggleTimeOfDay = this.consumeJustPressed('KeyT', 't');
    this.activeInputs.toggleRecoveryBoards = this.consumeJustPressed('KeyB', 'b');
    this.activeInputs.togglePaintColor = this.consumeJustPressed('KeyP', 'p');

    return this.activeInputs;
  }
}
