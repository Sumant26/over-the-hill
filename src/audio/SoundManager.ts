export class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private isUnlocked = false;

  // Engine Audio Nodes
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Tire Slip Noise Nodes
  private skidNoiseNode: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;

  // Winch Motor Nodes
  private winchOsc: OscillatorNode | null = null;
  private winchGain: GainNode | null = null;

  // Master Gain
  private masterGain: GainNode | null = null;

  constructor() {
    // Audio context will be unlocked on first user interaction
    const unlockHandler = () => {
      this.initContext();
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('pointerdown', unlockHandler);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', unlockHandler);
      window.addEventListener('pointerdown', unlockHandler);
    }
  }

  private initContext(): void {
    if (this.isUnlocked) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.isUnlocked = true;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSynth();
      this.setupSkidSynth();
      this.setupWinchSynth();
    } catch {
      // AudioContext not supported or blocked in headless environment
    }
  }

  private setupEngineSynth(): void {
    if (!this.ctx || !this.masterGain) return;

    // Dual oscillator engine generator
    this.engineOscA = this.ctx.createOscillator();
    this.engineOscA.type = 'sawtooth';

    this.engineOscB = this.ctx.createOscillator();
    this.engineOscB.type = 'triangle';

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    this.engineOscA.connect(this.engineFilter);
    this.engineOscB.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOscA.start();
    this.engineOscB.start();
  }

  private setupSkidSynth(): void {
    if (!this.ctx || !this.masterGain) return;

    // Generate 1-second white noise buffer
    const bufferSize = this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.skidNoiseNode = this.ctx.createBufferSource();
    this.skidNoiseNode.buffer = noiseBuffer;
    this.skidNoiseNode.loop = true;

    const skidFilter = this.ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    skidFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.skidNoiseNode.connect(skidFilter);
    skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.masterGain);

    this.skidNoiseNode.start();
  }

  private setupWinchSynth(): void {
    if (!this.ctx || !this.masterGain) return;

    this.winchOsc = this.ctx.createOscillator();
    this.winchOsc.type = 'square';
    this.winchOsc.frequency.setValueAtTime(420, this.ctx.currentTime);

    const winchFilter = this.ctx.createBiquadFilter();
    winchFilter.type = 'lowpass';
    winchFilter.frequency.setValueAtTime(700, this.ctx.currentTime);

    this.winchGain = this.ctx.createGain();
    this.winchGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.winchOsc.connect(winchFilter);
    winchFilter.connect(this.winchGain);
    this.winchGain.connect(this.masterGain);

    this.winchOsc.start();
  }

  /**
   * Update audio engine parameters based on vehicle telemetry
   */
  public update(rpm: number, maxSlip: number, isWinching: boolean): void {
    if (!this.ctx || !this.isUnlocked || this.isMuted) return;

    const now = this.ctx.currentTime;

    // 1. Modulate engine RPM pitch and filter
    if (this.engineOscA && this.engineOscB && this.engineFilter) {
      const baseFreq = 25 + (rpm / 5500) * 140;
      this.engineOscA.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.engineOscB.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

      const cutoff = 150 + (rpm / 5500) * 800;
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
    }

    // 2. Modulate tire slip noise
    if (this.skidGain) {
      const slipVolume = Math.min(0.4, Math.max(0, (maxSlip - 0.2) * 0.5));
      this.skidGain.gain.setTargetAtTime(slipVolume, now, 0.05);
    }

    // 3. Modulate winch motor whine
    if (this.winchGain) {
      const winchVol = isWinching ? 0.15 : 0.0;
      this.winchGain.gain.setTargetAtTime(winchVol, now, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}
