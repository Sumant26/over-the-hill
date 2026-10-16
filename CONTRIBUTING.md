# Contributing to Over the Hill (Web)

Thank you for your interest in contributing! This project adheres to strict performance, mathematical accuracy, and testing standards.

---

## 1. Development Workflow

1. Clone and install dependencies:
   ```bash
   git clone <repo-url>
   cd over-the-hill
   npm install
   ```
2. Start the development server with Hot Module Reload:
   ```bash
   npm run dev
   ```
3. Run tests frequently:
   ```bash
   npm run test:watch
   ```

---

## 2. Coding & Performance Standards

### Zero Allocations in the Hot Loop
Never instantiate objects (`new THREE.Vector3()`, `new THREE.Quaternion()`, closures) inside any function called per-tick (`update()`, `fixedUpdate()`, `render()`).
- Use scratch/module-level variables:
  ```typescript
  const _tempVec = new THREE.Vector3();
  export function computeForce(out: THREE.Vector3) {
    _tempVec.set(0, 1, 0);
    out.copy(_tempVec);
  }
  ```

### Fixed Timestep Determinism
All physics calculations must consume `FIXED_TIMESTEP = 1 / 60`. Do not mix variable frame `deltaTime` into suspension or constraint formulas.

---

## 3. Testing Requirements

Every new system or mathematical modification **must** include corresponding tests:
- **Unit Tests (`tests/unit/`):** Pure mathematical functions, state stores, suspension spring equations, and differential logic.
- **Integration Tests (`tests/integration/`):** Multi-tick Rapier physics simulations and deterministic replays.
- **E2E Tests (`tests/e2e/`):** Browser-level smoke tests, canvas instantiation, input handling, and HUD elements.

Run all tests prior to committing:
```bash
npm run typecheck
npm run test
npm run test:e2e
```

Husky pre-commit hooks will automatically enforce `typecheck` and `test`.

---

## 4. Git Commit Guidelines

Write clear, imperative commit messages:
- `feat(suspension): add progressive bump-stop damping curve`
- `fix(winch): resolve cable tension spike on anchor release`
- `perf(terrain): pool raycast hit buffers across chunk queries`
- `test(drivetrain): add unit tests for locked differential torque split`
