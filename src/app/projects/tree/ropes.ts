/**
 * Verlet "rope" connectors for the living tree.
 *
 * Every link in the tree — trunk, branch, twig — is a little chain of points
 * integrated with position Verlet. The two ends are pinned to live anchor
 * points (the trunk fork, a project orb, a sub-goal orb) and re-pinned every
 * frame, while the interior points fall under gravity, get blown sideways by a
 * gentle wind, and are pulled back toward a slightly-slack rest length. The
 * result is a rope that sags into a catenary, lags and whips when its endpoint
 * moves, and keeps swaying softly even after the layout has settled.
 */

export interface RopePoint {
  x: number;
  y: number;
  ox: number; // previous position (Verlet velocity is x - ox)
  oy: number;
}

export interface Rope {
  pts: RopePoint[];
  phase: number; // per-rope wind offset so they don't sway in lockstep
}

export interface RopeOpts {
  gravity?: number;
  wind?: number;
  slack?: number; // rest length multiplier; >1 lets the rope droop
  damping?: number;
  iterations?: number;
}

/** Create a rope of `segments` segments laid straight between two points. */
export function makeRope(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  segments: number,
  phase: number,
): Rope {
  const pts: RopePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    pts.push({ x, y, ox: x, oy: y });
  }
  return { pts, phase };
}

/**
 * Advance a rope one frame. `ax,ay` / `bx,by` are the current (live) endpoint
 * anchors; `t` is a monotonic clock in ms used for the wind. Mutates in place.
 */
export function stepRope(
  rope: Rope,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: number,
  opts: RopeOpts = {},
): void {
  const {
    gravity = 0.04,
    wind = 0.25,
    slack = 1.06,
    damping = 0.98,
    iterations = 3,
  } = opts;

  const pts = rope.pts;
  const n = pts.length;
  if (n < 2) return;

  // Integrate interior points (endpoints are driven, not simulated).
  for (let i = 1; i < n - 1; i++) {
    const p = pts[i];
    const vx = (p.x - p.ox) * damping;
    const vy = (p.y - p.oy) * damping;
    p.ox = p.x;
    p.oy = p.y;
    p.x += vx + Math.sin(t * 0.0016 + i * 0.6 + rope.phase) * wind;
    p.y += vy + gravity;
  }

  // Per-segment rest length tracks the live endpoint distance, with slack so
  // the rope always has a little extra to droop with.
  const dist = Math.hypot(bx - ax, by - ay);
  const rest = (dist / (n - 1)) * slack;

  // Relax distance constraints, re-pinning the endpoints each pass.
  for (let k = 0; k < iterations; k++) {
    pts[0].x = ax;
    pts[0].y = ay;
    pts[n - 1].x = bx;
    pts[n - 1].y = by;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = ((d - rest) / d) * 0.5;
      const mx = dx * diff;
      const my = dy * diff;
      const aPinned = i === 0;
      const bPinned = i + 1 === n - 1;
      // Pinned endpoints don't move; their share of the correction is handed
      // to the free neighbour so segment lengths still resolve.
      if (aPinned && !bPinned) {
        b.x -= mx * 2;
        b.y -= my * 2;
      } else if (bPinned && !aPinned) {
        a.x += mx * 2;
        a.y += my * 2;
      } else if (!aPinned && !bPinned) {
        a.x += mx;
        a.y += my;
        b.x -= mx;
        b.y -= my;
      }
    }
  }
  // Final hard pin so the ends never drift off their anchors.
  pts[0].x = ax;
  pts[0].y = ay;
  pts[n - 1].x = bx;
  pts[n - 1].y = by;
}

/** Smooth SVG path through the rope's points (quadratic midpoint smoothing). */
export function ropePath(rope: Rope): string {
  const p = rope.pts;
  const n = p.length;
  if (n < 2) return "";
  let d = `M ${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (p[i].x + p[i + 1].x) / 2;
    const my = (p[i].y + p[i + 1].y) / 2;
    d += ` Q ${p[i].x.toFixed(1)} ${p[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  d += ` L ${p[n - 1].x.toFixed(1)} ${p[n - 1].y.toFixed(1)}`;
  return d;
}
