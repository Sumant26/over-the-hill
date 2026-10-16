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
  private prevDiffLockKey = false;
  private prevLowRangeKey = false;
  private prevWinchKey = false;
  private prevResetKey = false;
  private prevAudioKey = false;
  private prevCameraKey = false;
  private prevTimeKey = false;
  private prevBoardsKey = false;
  private prevPaintKey = false;
  private prevTabKey = false;
  private prevCoopKey = false;
  private prevDigitKeys: Record<string, boolean> = {};

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
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.gameKeyCodes.has(e.code) || e.key === ' ' || e.code === 'Tab' || e.key.startsWith('Arrow')) {
      e.preventDefault();
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

    let diffLockPress = false;
    let lowRangePress = false;
    let winchPress = false;
    let winchPull = false;
    let winchRelease = false;
    let resetPress = false;
    let audioPress = false;
    let cameraPress = false;
    let timePress = false;
    let boardsPress = false;
    let paintPress = false;
    let tabPress = false;
    let coopPress = false;

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

    if (this.isPressed('KeyL', 'l')) diffLockPress = true;
    if (this.isPressed('KeyH', 'h')) lowRangePress = true;
    if (this.isPressed('KeyE', 'e')) winchPress = true;
    if (this.isPressed('KeyF', 'f')) winchPull = true;
    if (this.isPressed('KeyV', 'v')) winchRelease = true;
    if (this.isPressed('KeyR', 'r')) resetPress = true;
    if (this.isPressed('KeyM', 'm')) audioPress = true;
    if (this.isPressed('KeyC', 'c')) cameraPress = true;
    if (this.isPressed('KeyT', 't')) timePress = true;
    if (this.isPressed('KeyB', 'b')) boardsPress = true;
    if (this.isPressed('KeyP', 'p')) paintPress = true;
    if (this.isPressed('Tab')) tabPress = true;
    if (this.isPressed('KeyK', 'k')) coopPress = true;

    // Direct vehicle number selection [1], [2], [3], [4]
    let selectedNum: number | null = null;
    const digitCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    for (let i = 0; i < digitCodes.length; i++) {
      const code = digitCodes[i];
      const pressed = this.isPressed(code, (i + 1).toString());
      if (pressed && !this.prevDigitKeys[code]) {
        selectedNum = i;
      }
      this.prevDigitKeys[code] = pressed;
    }

    // 3. Gamepad API
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];
      if (gp && gp.connected) {
        const axisX = gp.axes[0] ?? 0;
        if (Math.abs(axisX) > 0.12) steer = axisX;

        const rt = gp.buttons[7]?.value ?? 0;
        const lt = gp.buttons[6]?.value ?? 0;
        if (rt > 0.05) throttle = Math.max(throttle, rt);
        if (lt > 0.05) brake = Math.max(brake, lt);

        if (gp.buttons[0]?.pressed) handbrake = true;
        if (gp.buttons[3]?.pressed) diffLockPress = true;
        if (gp.buttons[2]?.pressed) lowRangePress = true;
        if (gp.buttons[1]?.pressed) winchPress = true;
        if (gp.buttons[5]?.pressed) winchPull = true;
        if (gp.buttons[4]?.pressed) winchRelease = true;
        if (gp.buttons[8]?.pressed || gp.buttons[9]?.pressed) resetPress = true;
        if (gp.buttons[10]?.pressed) cameraPress = true;
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

    this.activeInputs.switchNextVehicle = tabPress && !this.prevTabKey;
    this.activeInputs.selectVehicleIndex = selectedNum;
    this.activeInputs.toggleCoop = coopPress && !this.prevCoopKey;

    this.activeInputs.toggleDiffLock = diffLockPress && !this.prevDiffLockKey;
    this.activeInputs.toggleLowRange = lowRangePress && !this.prevLowRangeKey;
    this.activeInputs.winchAttachToggle = winchPress && !this.prevWinchKey;
    this.activeInputs.winchPull = winchPull;
    this.activeInputs.winchRelease = winchRelease;
    this.activeInputs.resetVehicle = resetPress && !this.prevResetKey;
    this.activeInputs.toggleAudio = audioPress && !this.prevAudioKey;
    this.activeInputs.toggleCamera = cameraPress && !this.prevCameraKey;
    this.activeInputs.toggleTimeOfDay = timePress && !this.prevTimeKey;
    this.activeInputs.toggleRecoveryBoards = boardsPress && !this.prevBoardsKey;
    this.activeInputs.togglePaintColor = paintPress && !this.prevPaintKey;

    this.prevDiffLockKey = diffLockPress;
    this.prevLowRangeKey = lowRangePress;
    this.prevWinchKey = winchPress;
    this.prevResetKey = resetPress;
    this.prevAudioKey = audioPress;
    this.prevCameraKey = cameraPress;
    this.prevTimeKey = timePress;
    this.prevBoardsKey = boardsPress;
    this.prevPaintKey = paintPress;
    this.prevTabKey = tabPress;
    this.prevCoopKey = coopPress;

    return this.activeInputs;
  }
}
