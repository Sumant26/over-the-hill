# Over the Hill (Web Edition) 🚙⛰️

A high-performance, stylized 3D open-world 4x4 off-roading browser game inspired by *Over the Hill* and *art of rally* by Funselektor Labs.

Built with **TypeScript**, **Three.js**, and **Rapier3D (WebAssembly)** with zero-allocation physics loops, realistic analytical raycast suspension, terrain friction splat-mapping, mechanical winch recovery, analog cockpit HUD, dynamic weather, and synthesized engine audio.

---

## 🎮 Features

- **Realistic 4x4 Raycast Suspension**:
  - Independent 4-wheel suspension with spring stiffness ($k$), damping coefficients ($c$), bump stops, and anti-roll bars.
  - Pacejka-derived tire slip curves (longitudinal traction for acceleration/braking, lateral grip for cornering).
  - Selectable **4WD High (H)** and **4WD Low (L)** crawl-range transfer case.
  - Switchable **Locked Center/Axle Differential** to overcome mud pits and rocky crests.
- **Dynamic Terrain & Mud Physics**:
  - Chunked procedural heightmap terrain with multi-biome surface friction (rock: $1.0\mu$, dry dirt: $0.8\mu$, slick mud: $0.35\mu$, water: $0.2\mu$).
  - Physical mud sink depth resistance and wheel slip simulation.
- **Mechanical Winch System**:
  - Distance-spring cable with dynamic motorized spooling.
  - Dynamic attachment to world anchor points (trees, rocks, winch posts).
  - Interactive cable rendering with realistic sag, tension coloring, and recovery forces.
- **Cockpit Gauges & Analog HUD**:
  - Real-time **Inclinometer** showing vehicle Pitch & Roll with critical tip-over angle warnings ($>35^\circ$).
  - Speedometer & Tachometer (Engine RPM with gear shifting).
  - Status indicators for Diff-Lock, Low-Range, and Winch tension.
- **Stylized Visual Pipeline**:
  - Low-poly minimalist aesthetic with warm golden hour directional lighting and soft shadows.
  - Atmospheric height fog and dynamic day/night cycle.
  - Dynamic cinematic chase camera with elevation damping and tilt-shift depth of field.
- **Procedural Audio Synthesis**:
  - Web Audio API engine sound generator with RPM frequency modulation and gear shift pop.
  - Tire skid and surface crunch loops scaled to tire slip ratio.
  - Winch motor whine and suspension spring creaks.

---

## 🕹️ Controls

| Action | Keyboard | Gamepad (Xbox/PlayStation) |
| :--- | :--- | :--- |
| **Throttle (Gas)** | `W` or `Arrow Up` | Right Trigger (`RT` / `R2`) |
| **Brake / Reverse** | `S` or `Arrow Down` | Left Trigger (`LT` / `L2`) |
| **Steering** | `A` / `D` or `Left` / `Right` | Left Thumbstick (Horizontal) |
| **Handbrake** | `Spacebar` | Button `A` / `Cross` |
| **Differential Lock** | `L` | Button `Y` / `Triangle` |
| **Transfer Case (High/Low)** | `H` | Button `X` / `Square` |
| **Attach / Detach Winch** | `E` | Button `B` / `Circle` |
| **Winch In (Pull)** | `F` | Right Bumper (`RB` / `R1`) |
| **Winch Out (Slack)** | `V` | Left Bumper (`LB` / `L1`) |
| **Reset Vehicle** | `R` | Select / Back |
| **Camera Orbit** | Mouse Drag | Right Thumbstick |
| **Toggle Audio** | `M` | - |

---

## 🛠️ Tech Stack & Architecture

- **Core**: TypeScript + Three.js (WebGL2)
- **Physics**: `@dimforge/rapier3d-compat` (WASM with SIMD)
- **Audio**: Web Audio API (real-time synthesized waveforms and audio nodes)
- **Build**: Vite 6
- **Testing**: Vitest (Unit & Integration tests) + Playwright (E2E browser tests)
- **Quality**: Husky pre-commit hooks + GitHub Actions CI

For architecture and physics deep dives, see:
- [`ARCHITECTURE.md`](file:///home/sumant/Downloads/Work/Projects/Javascript%20projects/over-the-hill/ARCHITECTURE.md)
- [`PHYSICS.md`](file:///home/sumant/Downloads/Work/Projects/Javascript%20projects/over-the-hill/PHYSICS.md)
- [`CONTRIBUTING.md`](file:///home/sumant/Downloads/Work/Projects/Javascript%20projects/over-the-hill/CONTRIBUTING.md)

---

## 🚀 Getting Started

### Prerequisites
- Node.js $\ge 20$ (Recommended: Node 22+)
- npm $\ge 10$

### Installation
```bash
git clone <repo-url>
cd over-the-hill
npm install
```

### Running Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Running Tests
```bash
# Unit & Integration tests
npm run test

# Type checking
npm run typecheck

# End-to-End browser tests (requires server or runs via playwright config)
npm run test:e2e
```
# over-the-hill
