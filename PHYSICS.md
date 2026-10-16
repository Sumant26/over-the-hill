# Physics Specification & Mathematical Models

This document details the analytical physics formulas applied in the 4x4 Off-Road Raycast Vehicle and Winch simulations.

---

## 1. Raycast Suspension Model

The vehicle chassis is a single rigid body of mass $M$ with dimensions $(w, h, l)$ and inertia tensor $I$. Four independent suspension units are located at fixed mount points $P_{\text{mount}, i}$ relative to the chassis origin.

### 1.1 Suspension Compression
For wheel $i \in \{0, 1, 2, 3\}$:
A ray is cast from $P_{\text{mount}, i}$ along the chassis downward unit vector $\hat{D}$.

$$\text{Ray Start} = P_{\text{mount}, i}$$
$$\text{Ray Direction} = \hat{D}_{\text{world}}$$
$$\text{Max Ray Distance} = L_{\text{rest}} + R_{\text{wheel}}$$

If a hit occurs at distance $d_{\text{hit}}$:
$$\text{Suspension Length } L_i = d_{\text{hit}} - R_{\text{wheel}}$$
$$\text{Compression } x_i = L_{\text{rest}} - L_i$$

Where:
- $L_{\text{rest}}$ = Rest length of the suspension spring (e.g., $0.55\text{ m}$)
- $R_{\text{wheel}}$ = Radius of the wheel (e.g., $0.42\text{ m}$)
- $x_i \in [0, x_{\text{max}}]$ (clamped to prevent inversion)

### 1.2 Spring-Damper Force (Voigt-Kelvin Model)
The force exerted along the suspension axis is given by:

$$F_{\text{susp}, i} = k_{\text{spring}} \cdot x_i + c_{\text{damper}} \cdot v_{\text{susp}, i}$$

Where:
- $k_{\text{spring}}$ = Spring stiffness constant ($\text{N/m}$, e.g. $28,000\text{ N/m}$)
- $c_{\text{damper}}$ = Damping coefficient ($\text{N}\cdot\text{s/m}$, e.g. $2,400\text{ N}\cdot\text{s/m}$)
- $v_{\text{susp}, i} = \frac{x_i(t) - x_i(t - \Delta t)}{\Delta t}$ = Suspension compression velocity

### 1.3 Anti-Roll Bar Force
To prevent excessive body roll around high-speed turns:
For each axle (Front: wheels 0,1; Rear: wheels 2,3):

$$F_{\text{arb}} = k_{\text{arb}} \cdot (x_{\text{left}} - x_{\text{right}})$$

$$F_{\text{susp, left}} \mathrel{-}= F_{\text{arb}}, \quad F_{\text{susp, right}} \mathrel{+}= F_{\text{arb}}$$

---

## 2. Tire Friction & Traction (Pacejka Magic Formula Approximation)

Tire forces are decomposed into **Longitudinal Force** ($F_x$, driving/braking) and **Lateral Force** ($F_y$, cornering/skid resistance).

### 2.1 Normal Force & Friction Ellipse
The maximum grip available to each tire is governed by the normal load:

$$F_{N, i} = \max(0, F_{\text{susp}, i})$$
$$F_{\text{max}, i} = \mu_{\text{surface}} \cdot F_{N, i}$$

Where $\mu_{\text{surface}}$ is the ground friction coefficient (Rock $= 1.0$, Mud $= 0.35$).

### 2.2 Longitudinal Force ($F_x$)
With wheel angular velocity $\omega$, ground linear forward speed $v_x$, and wheel radius $R$:

$$\text{Slip Ratio } s = \frac{\omega \cdot R - v_x}{\max(|v_x|, 0.1)}$$

$$F_x = F_{\text{max}} \cdot \tanh(2.5 \cdot s)$$

### 2.3 Lateral Counter-Force ($F_y$)
With lateral wheel velocity $v_y$:

$$\text{Slip Angle } \alpha \approx -\arctan\left(\frac{v_y}{|v_x| + 0.1}\right)$$

$$F_y = F_{\text{max}} \cdot \sin(1.8 \cdot \arctan(1.5 \cdot \alpha))$$

Combined traction is normalized to stay within the friction circle:

$$\sqrt{F_x^2 + F_y^2} \le F_{\text{max}}$$

---

## 3. Drivetrain & Differential Model

### 3.1 Transfer Case Ratios
- **High Range (4H):** $R_{\text{tcase}} = 1.0$ (standard trail cruising)
- **Low Range (4L):** $R_{\text{tcase}} = 2.6$ (rock crawling & mud recovery)

Total drive torque delivered to the wheels:

$$\tau_{\text{total}} = \tau_{\text{engine}}(\text{RPM}) \cdot R_{\text{gear}} \cdot R_{\text{tcase}} \cdot R_{\text{diff}}$$

### 3.2 Differential Locking
- **Open Differential:** Torque is split equally ($50\% / 50\%$) between left and right wheels. If one wheel slips on ice or mud, both wheels lose driving force.
- **Locked Differential:** Forces both left and right wheels to rotate at identical angular velocities:
  $$\omega_{\text{left}} = \omega_{\text{right}} = \frac{\omega_{\text{left}} + \omega_{\text{right}}}{2}$$
  Torque shifts dynamically to the wheel with higher traction, allowing recovery from deep mud.

---

## 4. Mechanical Winch Elasticity

The winch cable is modeled as a damped tension spring with variable rest length $L_{\text{cable}}$:

$$\vec{D} = \vec{P}_{\text{anchor}} - \vec{P}_{\text{bumper}}$$
$$\text{Current Distance } d = \|\vec{D}\|, \quad \hat{u} = \frac{\vec{D}}{d}$$

When $d > L_{\text{cable}}$:

$$\text{Tension } T = k_{\text{cable}} \cdot (d - L_{\text{cable}}) + c_{\text{cable}} \cdot (\vec{V}_{\text{rel}} \cdot \hat{u})$$

Force applied to the vehicle bumper:

$$\vec{F}_{\text{winch}} = \min(T, T_{\text{max}}) \cdot \hat{u}$$

When spooling in (key `F`):
$$L_{\text{cable}}(t + \Delta t) = \max(L_{\text{min}}, L_{\text{cable}}(t) - v_{\text{spool}} \cdot \Delta t)$$
