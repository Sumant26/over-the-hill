# Architecture Specification: Over the Hill (Web)

This document outlines the architectural systems, game loop, data flow, memory design, and optimization techniques.

---

## 1. High-Level System Architecture

The game decouples simulation from presentation using an Entity-System data-oriented design:

```
[ Input System ] ---> [ Player Input State ]
                             |
                             v
+-----------------------------------------------------------+
|               Fixed-Timestep Physics Loop                 |
|                     (Step: 1/60s)                         |
|                                                           |
| 1. VehiclePhysicsSystem:                                  |
|    - Downward raycasts from chassis for 4 wheel mounts    |
|    - Suspension spring-damper reaction forces             |
|    - Engine RPM curve, gear ratio, and throttle torque    |
|    - Open / Locked differential torque splitter           |
|    - Pacejka slip and lateral counter-force calculation   |
| 2. WinchSystem:                                           |
|    - Distance constraint resolution                       |
|    - Motor spool velocity & tension vector calculations   |
| 3. TerrainSystem:                                         |
|    - Procedural height queries & surface splat lookup     |
| 4. Rapier World Step:                                     |
|    - Solves chassis rigid body impulses and collisions    |
+-----------------------------------------------------------+
                             |
                     Transform Alpha
                             |
                             v
+-----------------------------------------------------------+
|                   Variable Render Loop                    |
|                      (rAF @ 60-144Hz)                     |
|                                                           |
| 1. CameraSystem:                                          |
|    - Damped third-person orbit follow camera              |
|    - Dynamic elevation tilt during hill climbs            |
| 2. RenderSystem:                                          |
|    - Interpolates chassis & wheel visual mesh transforms  |
|    - Low-poly vertex colored terrain rendering            |
|    - Foliage instanced meshes                             |
|    - Winch cable line geometry update                     |
| 3. AudioSystem:                                           |
|    - Web Audio API node tree                              |
|    - Frequency modulation mapped to engine RPM            |
|    - Gain modulation mapped to wheel slip ratio           |
| 4. HUD / UI Layer:                                        |
|    - Inclinometer dial (Pitch & Roll)                     |
|    - Speedometer & Gear display                           |
|    - Winch status & warnings                              |
+-----------------------------------------------------------+
```

---

## 2. Fixed Timestep Physics Decoupling

Browsers execute `requestAnimationFrame` at unpredictable rates (30Hz on throttled devices, 60Hz standard, 120Hz/144Hz on gaming displays).

To prevent simulation instability and tunneling:
- Physics runs at a strict, deterministic `60 Hz` (`dt = 0.01666s`).
- The render loop accumulates elapsed frame time (`deltaTime`) and steps physics in integer chunks:

```typescript
accumulator += Math.min(deltaTime, 0.1); // clamp to prevent spiral of death
while (accumulator >= FIXED_TIMESTEP) {
  physicsWorld.step(FIXED_TIMESTEP);
  accumulator -= FIXED_TIMESTEP;
}
const alpha = accumulator / FIXED_TIMESTEP;
// Visual meshes render at: currentTransform * alpha + prevTransform * (1 - alpha)
```

---

## 3. Zero-Allocation Design (Garbage Collection Mitigation)

In high-performance WebGL applications, instantiating short-lived objects (`new THREE.Vector3()`) in the tick loop triggers JavaScript garbage collection sweeps, resulting in frame stutter.

### Strict Optimization Rules:
1. **Object Pools:** Pre-allocate vectors, quaternions, and raycast hit buffers at module load.
2. **Reuse Calculations:** All vector math methods use inplace chaining (e.g., `vecA.copy(vecB).addScaledVector(...)`).
3. **Array Views:** Wheel transforms and state arrays are backed by typed arrays (`Float32Array`) where possible.

---

## 4. Terrain & Splat-Mapping System

Terrain is structured in a chunk grid (e.g. $64\text{m} \times 64\text{m}$):
- **Collision:** Rapier `Heightfield` colliders generated directly from a 2D float height buffer.
- **Surface Types:**
  - `rock`: friction = 1.0, sink depth = 0.0
  - `dirt`: friction = 0.8, sink depth = 0.02
  - `mud`: friction = 0.35, sink depth = 0.15, drag multiplier = 2.5
  - `water`: friction = 0.2, sink depth = 0.35, buoyancy impulse applied

---

## 5. Web Audio Engine

Procedural audio is generated dynamically using Web Audio API nodes:
- **Engine Sound:** Sawtooth / Triangle oscillator routed through low-pass biquad filters with frequency scaling proportional to `engineRPM`.
- **Tire Skid:** White noise generator routed through a bandpass filter with gain scaled to tire `slipRatio`.
- **Winch Sound:** High-pitch modulated square oscillator active during cable spooling.

---

## 6. Directory Structure

```
over-the-hill/
├── .github/workflows/ci.yml       # CI workflow for typecheck, tests, and build
├── .husky/pre-commit             # Git hook running typecheck & unit tests
├── src/
│   ├── core/                      # Game loop, event bus, clock
│   ├── physics/                   # Rapier world, raycast vehicle, suspension, winch
│   ├── terrain/                   # Chunk manager, height generator, surface splats
│   ├── entities/                  # Vehicle visual model, wheel meshes, props
│   ├── camera/                    # Follow camera, tilt-shift controls
│   ├── audio/                     # Web Audio API engine, tire slip, winch sound
│   ├── ui/                        # Inclinometer, Speedometer, Gear, Winch HUD
│   ├── scene/                     # Three.js scene, lighting, fog, sky
│   └── main.ts                    # Entrypoint & bootstrap
├── tests/
│   ├── unit/                      # Math, suspension, drivetrain, winch logic tests
│   ├── integration/               # Physics simulation & determinism tests
│   └── e2e/                       # Playwright browser end-to-end tests
├── README.md                      # Project manual
├── ARCHITECTURE.md                # System design & loop documentation
├── PHYSICS.md                     # Mathematical derivations
└── CONTRIBUTING.md                # Contribution guidelines
```
