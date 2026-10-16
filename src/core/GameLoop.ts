export class GameLoop {
  public static readonly FIXED_TIMESTEP = 1 / 60; // 60Hz physics
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private onFixedUpdate: (dt: number) => void,
    private onRender: (alpha: number, dt: number) => void
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick(currentTime: number): void {
    if (!this.running) return;

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Clamp to 100ms max
    this.lastTime = currentTime;
    this.accumulator += frameTime;

    while (this.accumulator >= GameLoop.FIXED_TIMESTEP) {
      this.onFixedUpdate(GameLoop.FIXED_TIMESTEP);
      this.accumulator -= GameLoop.FIXED_TIMESTEP;
    }

    const alpha = this.accumulator / GameLoop.FIXED_TIMESTEP;
    this.onRender(alpha, frameTime);

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}
