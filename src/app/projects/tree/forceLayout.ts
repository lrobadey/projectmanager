/**
 * A small, dependency-free force-directed layout for the living-tree dashboard.
 *
 * The tree grows upward from a conceptual trunk base at world-origin (0, 0),
 * with `up` being negative-Y. Three branches fan out from a fork a little way
 * up the trunk:
 *
 *        primary (up)
 *   secondary \  | /  tertiary
 *              \ | /
 *               fork
 *                |          <- trunk
 *              (0,0)  base  ~~ idea "seeds" glow in an arc just below
 *
 * Project nodes are pulled toward an anchor point along their branch ray, then
 * mutual repulsion bushes them out sideways. Sub-goal nodes have no fixed
 * anchor — they hang off their parent by a link spring and let repulsion carry
 * them into whatever open space is nearby, so they "find their own spot" every
 * time they bloom.
 *
 * The integrator is plain Verlet-ish velocity damping. There is no global alpha
 * baked into the forces; instead the render loop watches the peak speed and
 * stops ticking once everything settles (see `step`'s return value).
 */

import type { Project, ProjectTier, Subgoal } from "@/types/db";

export type NodeKind = "project" | "subgoal" | "idea";

export interface SimNode {
  id: string;
  kind: NodeKind;
  /** Parent node id (sub-goal → project). null for branch-rooted nodes. */
  parentId: string | null;
  tier: ProjectTier;
  radius: number;
  /** A point the node is softly pulled toward; null = positioned purely by links. */
  anchor: { x: number; y: number; k: number } | null;
  /** Rest length of the spring to the parent node (sub-goals only). */
  linkDist: number;
  // Physics state (world coordinates, +Y is down / toward the ground).
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Render payload.
  project?: Project;
  subgoal?: Subgoal;
}

// ---------------------------------------------------------------- tuning knobs
const TRUNK_LEN = 150; // distance from base (0,0) up to the branch fork
const BRANCH_BASE = 150; // first project sits this far out along its branch
const BRANCH_STEP = 132; // each further project steps out along the ray
const SEED_Y = 78; // idea seeds glow this far below the base
const SEED_SPREAD = 74; // horizontal spacing between idea seeds
const SEED_DEPTH = 0.5; // how much further the outer roots dive down

const REPULSION = 1500; // node-node push strength (force ~ REPULSION / dist)
const REPULSION_RANGE = 360; // beyond this, nodes ignore each other
const MAX_REPULSION = 36; // clamp so nothing rockets off screen
const ANCHOR_K = 0.018; // project pull toward its branch anchor
const SEED_K = 0.03; // idea seeds are held a bit more firmly to the base
const LINK_K = 0.05; // sub-goal spring toward its parent
const SUBGOAL_LINK = 92; // sub-goal rest length
const PARENT_RECOIL = 0.12; // how much a sub-goal tugs back on its parent
const FRICTION = 0.86;
const SETTLE_SPEED = 0.07; // peak speed under which we call it "asleep"

/** Unit branch directions. Visual order is secondary (left), primary, tertiary. */
const BRANCH_DIR: Record<ProjectTier, { x: number; y: number }> = {
  primary: { x: 0, y: -1 },
  secondary: norm(-0.62, -0.78),
  tertiary: norm(0.62, -0.78),
  idea: { x: 0, y: 1 },
};

function norm(x: number, y: number) {
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}

/** Where the three branches split off from the trunk. */
export const FORK = { x: 0, y: -TRUNK_LEN };
export const BASE = { x: 0, y: 0 };
export { BRANCH_DIR };

/**
 * Build the simulation node list for the current projects + expanded set,
 * carrying over physics state for nodes that already existed (matched by id)
 * so re-layouts don't teleport everything.
 */
export function buildNodes(
  projects: Project[],
  expanded: Set<string>,
  prev: Map<string, SimNode>,
): SimNode[] {
  const nodes: SimNode[] = [];

  const byTier: Record<ProjectTier, Project[]> = {
    primary: [],
    secondary: [],
    tertiary: [],
    idea: [],
  };
  for (const p of projects) byTier[p.tier].push(p);

  // Branch-rooted project nodes.
  for (const tier of ["primary", "secondary", "tertiary"] as const) {
    const dir = BRANCH_DIR[tier];
    byTier[tier].forEach((project, i) => {
      const dist = BRANCH_BASE + i * BRANCH_STEP;
      const anchor = {
        x: FORK.x + dir.x * dist,
        y: FORK.y + dir.y * dist,
        k: ANCHOR_K,
      };
      const carried = prev.get(project.id);
      nodes.push({
        id: project.id,
        kind: "project",
        parentId: null,
        tier,
        radius: tier === "primary" ? 34 : 30,
        anchor,
        linkDist: 0,
        x: carried?.x ?? anchor.x + rand(),
        y: carried?.y ?? anchor.y + rand(),
        vx: carried?.vx ?? 0,
        vy: carried?.vy ?? 0,
        project,
      });
    });
  }

  // Idea "seeds" glowing in an arc at the base.
  byTier.idea.forEach((project, i) => {
    const n = byTier.idea.length;
    const offset = (i - (n - 1) / 2) * SEED_SPREAD;
    const anchor = {
      x: offset,
      y: SEED_Y + Math.abs(offset) * SEED_DEPTH,
      k: SEED_K,
    };
    const carried = prev.get(project.id);
    nodes.push({
      id: project.id,
      kind: "idea",
      parentId: null,
      tier: "idea",
      radius: 13,
      anchor,
      linkDist: 0,
      x: carried?.x ?? anchor.x + rand(),
      y: carried?.y ?? anchor.y + rand(),
      vx: carried?.vx ?? 0,
      vy: carried?.vy ?? 0,
      project,
    });
  });

  // Sub-goal nodes for every expanded project.
  for (const project of projects) {
    if (!expanded.has(project.id)) continue;
    const parent = prev.get(project.id);
    const subs = project.subgoals ?? [];
    subs.forEach((sg, i) => {
      const carried = prev.get(sg.id);
      // Seed new sub-goals in a ring around the parent so they spring outward.
      const a = (i / Math.max(subs.length, 1)) * Math.PI * 2;
      const seedX = (parent?.x ?? 0) + Math.cos(a) * 24;
      const seedY = (parent?.y ?? 0) + Math.sin(a) * 24;
      nodes.push({
        id: sg.id,
        kind: "subgoal",
        parentId: project.id,
        tier: project.tier,
        radius: 11,
        anchor: null,
        linkDist: SUBGOAL_LINK,
        x: carried?.x ?? seedX,
        y: carried?.y ?? seedY,
        vx: carried?.vx ?? 0,
        vy: carried?.vy ?? 0,
        subgoal: sg,
      });
    });
  }

  return nodes;
}

/**
 * Advance the simulation one tick in place. Returns the peak node speed so the
 * caller can stop the animation loop once the tree has settled.
 */
export function step(nodes: SimNode[]): number {
  const n = nodes.length;
  if (n === 0) return 0;

  const fx = new Float64Array(n);
  const fy = new Float64Array(n);
  const index = new Map<string, number>();
  for (let i = 0; i < n; i++) index.set(nodes[i].id, i);

  // Pairwise repulsion (O(n²) — node counts here are small).
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dx = nodes[i].x - nodes[j].x;
      let dy = nodes[i].y - nodes[j].y;
      let dist = Math.hypot(dx, dy);
      if (dist > REPULSION_RANGE) continue;
      if (dist < 0.01) {
        // Perfectly overlapping — nudge apart deterministically.
        dx = (i % 2 === 0 ? 1 : -1) * 0.5;
        dy = 0.5;
        dist = 0.7;
      }
      const minGap = nodes[i].radius + nodes[j].radius + 14;
      // Base inverse-distance push, with extra shove when nodes overlap.
      let f = REPULSION / (dist * dist);
      if (dist < minGap) f += (minGap - dist) * 0.4;
      f = Math.min(f, MAX_REPULSION);
      const ux = dx / dist;
      const uy = dy / dist;
      fx[i] += ux * f;
      fy[i] += uy * f;
      fx[j] -= ux * f;
      fy[j] -= uy * f;
    }
  }

  // Anchor springs (projects → branch ray, ideas → base arc).
  for (let i = 0; i < n; i++) {
    const a = nodes[i].anchor;
    if (!a) continue;
    fx[i] += (a.x - nodes[i].x) * a.k;
    fy[i] += (a.y - nodes[i].y) * a.k;
  }

  // Link springs (sub-goal ↔ parent), pulling toward the rest length.
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    if (node.parentId == null) continue;
    const pj = index.get(node.parentId);
    if (pj == null) continue;
    const parent = nodes[pj];
    const dx = node.x - parent.x;
    const dy = node.y - parent.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const f = (node.linkDist - dist) * LINK_K;
    const ux = dx / dist;
    const uy = dy / dist;
    fx[i] += ux * f;
    fy[i] += uy * f;
    // The parent feels a gentler tug back so branches don't drift off-anchor.
    fx[pj] -= ux * f * PARENT_RECOIL;
    fy[pj] -= uy * f * PARENT_RECOIL;
  }

  // Integrate + measure peak speed.
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    node.vx = (node.vx + fx[i]) * FRICTION;
    node.vy = (node.vy + fy[i]) * FRICTION;
    node.x += node.vx;
    node.y += node.vy;
    const speed = Math.hypot(node.vx, node.vy);
    if (speed > peak) peak = speed;
  }
  return peak;
}

/** Peak-speed threshold under which the render loop may stop ticking. */
export const SETTLE_THRESHOLD = SETTLE_SPEED;

function rand() {
  return (Math.random() - 0.5) * 12;
}
