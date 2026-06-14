"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STATUSES, type Project } from "@/types/db";
import {
  BASE,
  FORK,
  SETTLE_THRESHOLD,
  buildNodes,
  step,
  type SimNode,
} from "./forceLayout";
import { makeRope, ropePath, stepRope, type Rope } from "./ropes";

/** A connector rendered by React only when topology changes. */
type RopeMeta = {
  id: string;
  kind: "trunk" | "branch" | "twig" | "root" | "sprout" | "crown";
  w: number;
};

// Stroke per rope kind. Roots glow violet (idea seeds), sprouts amber
// (incubating), twigs teal, the trunk and branches ride the violet→cyan→teal
// gradient.
function ropeStroke(kind: RopeMeta["kind"], glow: boolean): string {
  if (kind === "twig") return glow ? "#5eead4" : "#7defc8";
  if (kind === "root") return glow ? "#7c3aed" : "#a78bfa";
  if (kind === "sprout") return glow ? "#f59e0b" : "#fbbf24";
  if (kind === "crown") return glow ? "#15803d" : "#166534";
  return "url(#branchGrad)";
}

const TRUNK_ID = "__trunk__";

function ropeMetasFor(ns: SimNode[]): RopeMeta[] {
  const metas: RopeMeta[] = [{ id: TRUNK_ID, kind: "trunk", w: 9 }];
  for (const n of ns) {
    if (n.kind === "idea") metas.push({ id: n.id, kind: "root", w: 3 });
  }
  for (const n of ns) {
    if (n.kind === "incubating") {
      metas.push({ id: n.id, kind: "sprout", w: 3.5 });
    }
  }
  for (const n of ns) {
    if (n.kind === "project") {
      metas.push({
        id: n.id,
        kind: "branch",
        w: n.tier === "primary" ? 5 : 4,
      });
    }
  }
  for (const n of ns) {
    if (n.kind === "completed") {
      metas.push({ id: n.id, kind: "crown", w: 5 });
    }
  }
  for (const n of ns) {
    if (n.kind === "subgoal" && n.parentId) {
      metas.push({ id: n.id, kind: "twig", w: 1.6 });
    }
  }
  return metas;
}

// Stable per-rope wind phase so ropes don't all sway in lockstep.
function hashPhase(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 628) / 100;
}

/* ----------------------------------------------------------------- palette */

type Glow = { core: string; ring: string };

// Bioluminescent status hues. Active glows cyan, on-hold flickers amber,
// done settles to a calm emerald, archived is a dim slate ember.
const STATUS_GLOW: Record<string, Glow> = {
  active: { core: "#22d3ee", ring: "#22d3ee" },
  on_hold: { core: "#fbbf24", ring: "#f59e0b" },
  done: { core: "#34d399", ring: "#10b981" },
  archived: { core: "#64748b", ring: "#475569" },
};
const SEED_COLOR = "#a78bfa";
const INCUBATING_COLOR = "#fbbf24";
// Completed projects glow a deep, settled forest green — the calm dark canopy
// crowning the bright, living branches below.
const COMPLETED_GLOW: Glow = { core: "#16a34a", ring: "#15803d" };
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

// Each status breathes with its own rhythm so the tree never pulses in unison.
function haloAnimation(status: string): {
  className: string;
  duration: string;
} {
  switch (status) {
    case "on_hold":
      return { className: "tree-flicker", duration: "3.4s" };
    case "done":
      return { className: "tree-shimmer", duration: "5s" };
    case "archived":
      return { className: "tree-shimmer", duration: "6.5s" };
    default:
      return { className: "tree-breath", duration: "3.6s" };
  }
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Compute a camera {x, y, scale} that frames the whole tree — the trunk base,
 * the fork, and every live node (with padding for orbs + their labels) — inside
 * a container of size w×h. Returns null until the container has been measured.
 */
function computeFit(
  ns: SimNode[],
  w: number,
  h: number,
): { x: number; y: number; scale: number } | null {
  if (w === 0 || h === 0) return null;

  // Always include the trunk's base and fork so the spine is never clipped.
  let minX = Math.min(BASE.x, FORK.x);
  let maxX = Math.max(BASE.x, FORK.x);
  let minY = Math.min(BASE.y, FORK.y);
  let maxY = Math.max(BASE.y, FORK.y);

  for (const n of ns) {
    // Horizontal pad leaves room for centered titles (~150px wide); vertical
    // pad covers the orb radius plus the label that sits just below it.
    const padX = n.radius + (n.kind === "subgoal" ? 70 : 88);
    const padTop = n.radius + 14;
    const padBot = n.radius + (n.kind === "subgoal" ? 22 : 34);
    minX = Math.min(minX, n.x - padX);
    maxX = Math.max(maxX, n.x + padX);
    minY = Math.min(minY, n.y - padTop);
    maxY = Math.max(maxY, n.y + padBot);
  }

  const margin = 60; // breathing room around the whole tree, in screen px
  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const scale = clamp(
    Math.min((w - margin * 2) / worldW, (h - margin * 2) / worldH),
    0.2,
    1.15,
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { scale, x: w / 2 - cx * scale, y: h / 2 - cy * scale };
}

/* -------------------------------------------------------------- TreeView */

export default function TreeView({ projects }: { projects: Project[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);

  // The mutable physics + rope state lives in refs. React only renders topology
  // changes; the always-on living motion updates DOM/SVG attributes directly.
  const nodesRef = useRef<SimNode[]>([]);
  const nodeByIdRef = useRef<Map<string, SimNode>>(new Map());
  const nodeElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const ropesRef = useRef<Map<string, Rope>>(new Map());
  const glowPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const corePathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const ropeGroupRef = useRef<SVGGElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [ropeMetas, setRopeMetas] = useState<RopeMeta[]>([
    { id: TRUNK_ID, kind: "trunk", w: 9 },
  ]);
  // The force sim "sleeps" once settled; the rope loop keeps running so the
  // ropes sway in the wind forever.
  const hotRef = useRef(true);
  const settleRef = useRef(0);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  // Camera auto-fit: the view tracks the whole tree until the user grabs control
  // (pan/zoom), then stays put until "Reset view" re-engages it.
  const autoFitRef = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });
  const fittedRef = useRef(false); // snap the first frame, ease thereafter
  // Once the camera has eased onto a settled target it stops recomputing the
  // fit every frame; it re-engages when the sim reheats or the container resizes.
  const convergedRef = useRef(false);

  const applyView = useCallback((next: { x: number; y: number; scale: number }) => {
    viewRef.current = next;
    worldRef.current?.style.setProperty(
      "transform",
      `translate(${next.x}px, ${next.y}px) scale(${next.scale})`,
    );
    ropeGroupRef.current?.setAttribute(
      "transform",
      `translate(${next.x} ${next.y}) scale(${next.scale})`,
    );
  }, []);

  const registerNode = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodeElsRef.current.set(id, el);
    else nodeElsRef.current.delete(id);
  }, []);

  const setPathD = useCallback((id: string, d: string) => {
    glowPathRefs.current.get(id)?.setAttribute("d", d);
    corePathRefs.current.get(id)?.setAttribute("d", d);
  }, []);

  const reheat = useCallback(() => {
    hotRef.current = true;
    settleRef.current = 0;
    convergedRef.current = false; // re-engage the auto-fit camera
  }, []);

  // Rebuild nodes (carrying over positions) whenever the data or which nodes
  // are bloomed changes, then wake the simulation to re-settle.
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const next = buildNodes(projects, expanded, prev);
    const metas = ropeMetasFor(next);
    const liveRopes = new Set(metas.map((r) => r.id));

    nodesRef.current = next;
    nodeByIdRef.current = new Map(next.map((n) => [n.id, n]));
    for (const k of ropesRef.current.keys()) {
      if (!liveRopes.has(k)) ropesRef.current.delete(k);
    }
    setNodes(next.slice());
    setRopeMetas(metas);
    reheat();
  }, [projects, expanded, reheat]);

  // The animation loop: step the force sim while it's hot, then step every rope
  // (always) and publish. Runs for the lifetime of the view.
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const ns = nodesRef.current;

      if (hotRef.current) {
        const peak = step(ns);
        if (peak < SETTLE_THRESHOLD) {
          if (++settleRef.current > 24) hotRef.current = false;
        } else {
          settleRef.current = 0;
        }
      }

      // Drive every connector rope from the live node positions.
      const byId = nodeByIdRef.current;
      const map = ropesRef.current;

      // Trunk: base → fork (both ends fixed; it just sways in the wind).
      let trunk = map.get(TRUNK_ID);
      if (!trunk) {
        trunk = makeRope(BASE.x, BASE.y + 6, FORK.x, FORK.y, 10, 0.4);
        map.set(TRUNK_ID, trunk);
      }
      stepRope(trunk, BASE.x, BASE.y + 6, FORK.x, FORK.y, t, {
        gravity: 0.02,
        wind: 0.18,
        slack: 1.04,
      });
      setPathD(TRUNK_ID, ropePath(trunk));

      // Roots: every idea-vault seed is a root rope converging on the trunk
      // base, so the ideas all feed the trunk that rises and branches above.
      for (const n of ns) {
        if (n.kind !== "idea") continue;
        let rope = map.get(n.id);
        if (!rope) {
          rope = makeRope(BASE.x, BASE.y, n.x, n.y, 8, hashPhase(n.id));
          map.set(n.id, rope);
        }
        stepRope(rope, BASE.x, BASE.y, n.x, n.y, t, {
          gravity: 0.05,
          wind: 0.16,
          slack: 1.12,
        });
        setPathD(n.id, ropePath(rope));
      }

      // Sprouts: each incubating idea rises from the trunk base into the middle
      // of the tree, an amber connector slung between the roots and the canopy.
      for (const n of ns) {
        if (n.kind !== "incubating") continue;
        let rope = map.get(n.id);
        if (!rope) {
          rope = makeRope(BASE.x, BASE.y, n.x, n.y, 9, hashPhase(n.id));
          map.set(n.id, rope);
        }
        stepRope(rope, BASE.x, BASE.y, n.x, n.y, t, {
          gravity: 0.03,
          wind: 0.22,
          slack: 1.08,
        });
        setPathD(n.id, ropePath(rope));
      }

      // Branches: fork → each project orb.
      for (const n of ns) {
        if (n.kind !== "project") continue;
        let rope = map.get(n.id);
        if (!rope) {
          rope = makeRope(FORK.x, FORK.y, n.x, n.y, 12, hashPhase(n.id));
          map.set(n.id, rope);
        }
        stepRope(rope, FORK.x, FORK.y, n.x, n.y, t, {
          gravity: 0.05,
          wind: 0.28,
          slack: 1.07,
        });
        setPathD(n.id, ropePath(rope));
      }

      // Crown: fork → each completed orb, dark-green boughs rising above the
      // canopy into the finished-work crown.
      for (const n of ns) {
        if (n.kind !== "completed") continue;
        let rope = map.get(n.id);
        if (!rope) {
          rope = makeRope(FORK.x, FORK.y, n.x, n.y, 12, hashPhase(n.id));
          map.set(n.id, rope);
        }
        stepRope(rope, FORK.x, FORK.y, n.x, n.y, t, {
          gravity: 0.04,
          wind: 0.24,
          slack: 1.06,
        });
        setPathD(n.id, ropePath(rope));
      }

      // Twigs: parent orb → sub-goal orb. Bloomed sub-goals also get a gentle
      // organic drift (two summed sines per axis → a slow, non-repeating
      // wander) applied as a display offset so the orb and its twig sway
      // together without disturbing the settled physics.
      for (const n of ns) {
        if (n.kind !== "subgoal" || !n.parentId) continue;
        const p = byId.get(n.parentId);
        if (!p) continue;
        const ph = hashPhase(n.id);
        n.dx =
          Math.sin(t * 0.00104 + ph) * 6 +
          Math.sin(t * 0.0019 + ph * 1.7) * 3;
        n.dy =
          Math.cos(t * 0.0009 + ph * 1.3) * 6 +
          Math.sin(t * 0.0015 + ph) * 2.5;
        const nx = n.x + n.dx;
        const ny = n.y + n.dy;
        let rope = map.get(n.id);
        if (!rope) {
          rope = makeRope(p.x, p.y, nx, ny, 7, ph);
          map.set(n.id, rope);
        }
        stepRope(rope, p.x, p.y, nx, ny, t, {
          gravity: 0.06,
          wind: 0.42,
          slack: 1.08,
        });
        setPathD(n.id, ropePath(rope));
      }

      // Move the HTML nodes without forcing React to reconcile the tree. This
      // preserves the exact settled layout and the perpetual sub-goal drift.
      for (const n of ns) {
        const el = nodeElsRef.current.get(n.id);
        if (!el) continue;
        const x = n.x + (n.kind === "subgoal" ? (n.dx ?? 0) : 0);
        const y = n.y + (n.kind === "subgoal" ? (n.dy ?? 0) : 0);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }

      // Auto-fit camera: ease the view toward a frame that holds the whole tree,
      // so it reframes itself as the sim settles and as sub-goals bloom. Once the
      // sim is asleep and the view has eased onto its target, stop recomputing
      // the fit every frame — it re-engages via reheat() or a container resize.
      if (autoFitRef.current && (hotRef.current || !convergedRef.current)) {
        const target = computeFit(ns, sizeRef.current.w, sizeRef.current.h);
        if (target) {
          const cur = viewRef.current;
          // Snap into frame on the first valid fit; ease on every frame after.
          const k = fittedRef.current ? 0.14 : 1;
          fittedRef.current = true;
          const next = {
            x: cur.x + (target.x - cur.x) * k,
            y: cur.y + (target.y - cur.y) * k,
            scale: cur.scale + (target.scale - cur.scale) * k,
          };
          applyView(next);
          // Mark converged once the sim has settled and the remaining ease is
          // sub-pixel, so we stop the perpetual recompute until something moves.
          if (
            !hotRef.current &&
            Math.abs(next.x - target.x) < 0.5 &&
            Math.abs(next.y - target.y) < 0.5 &&
            Math.abs(next.scale - target.scale) < 0.001
          ) {
            convergedRef.current = true;
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [applyView, setPathD]);

  // Track container size; the auto-fit camera reads it from sizeRef each frame.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sizeRef.current = { w: width, h: height };
      convergedRef.current = false; // reframe for the new container size
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel-zoom toward the cursor. Attached natively so we can preventDefault
  // (React's synthetic wheel listener is passive).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      autoFitRef.current = false; // user takes the wheel — stop auto-framing
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const v = viewRef.current;
      const scale = clamp(v.scale * Math.exp(-e.deltaY * 0.0015), 0.35, 2.4);
      // Keep the world point under the cursor fixed while zooming.
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      applyView({ scale, x: cx - wx * scale, y: cy - wy * scale });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyView]);

  // Background drag to pan.
  const panRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(
    null,
  );
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const v = viewRef.current;
    panRef.current = { px: e.clientX, py: e.clientY, vx: v.x, vy: v.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    autoFitRef.current = false; // dragging the canvas hands panning to the user
    applyView({
      ...viewRef.current,
      x: p.vx + (e.clientX - p.px),
      y: p.vy + (e.clientY - p.py),
    });
  };
  const endPan = () => {
    panRef.current = null;
  };

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetView = () => {
    setExpanded(new Set());
    autoFitRef.current = true; // re-engage the auto-framing camera
    reheat();
  };

  const isEmpty = projects.length === 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      className="fixed inset-0 z-40 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 100%, #0c1a16 0%, #070d0a 55%, #05080a 100%)",
      }}
    >
      {/* faint vignette of drifting motes for depth */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.06),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.06),transparent_40%)]" />

      {/* Connector ropes live in their own full-size SVG layer with a transform
          group that mirrors the HTML world. (A 0×0 SVG never establishes a
          paint region, so its children silently don't render — hence the
          dedicated full-bleed layer here.) */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient
            id="branchGrad"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={BASE.y + 40}
            x2="0"
            y2={FORK.y - 320}
          >
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
          <filter id="treeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <g ref={ropeGroupRef} transform="translate(0 0) scale(1)">
          {/* Glow pass: a wide, blurred, pulsing aura under every rope. */}
          <g filter="url(#treeGlow)">
            {ropeMetas.map((r, i) => (
              <path
                key={`g-${r.id}`}
                ref={(el) => {
                  if (el) glowPathRefs.current.set(r.id, el);
                  else glowPathRefs.current.delete(r.id);
                }}
                stroke={ropeStroke(r.kind, true)}
                strokeWidth={r.w * (r.kind === "trunk" ? 2.4 : 2.6)}
                strokeLinecap="round"
                fill="none"
                className="branch-pulse"
                style={{ animationDuration: `${2.4 + (i % 5) * 0.35}s` }}
              />
            ))}
          </g>

          {/* Crisp cores on top of the glow. */}
          {ropeMetas.map((r) => (
            <path
              key={`c-${r.id}`}
              ref={(el) => {
                if (el) corePathRefs.current.set(r.id, el);
                else corePathRefs.current.delete(r.id);
              }}
              stroke={ropeStroke(r.kind, false)}
              strokeWidth={r.w}
              strokeLinecap="round"
              fill="none"
              opacity={
                r.kind === "twig" || r.kind === "root" || r.kind === "sprout"
                  ? 0.82
                  : 0.92
              }
            />
          ))}
        </g>
      </svg>

      {/* The transformed world holds the HTML nodes, aligned to the SVG layer. */}
      <div
        ref={worldRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: "translate(0px, 0px) scale(1)" }}
      >
        <AnimatePresence>
          {nodes.map((n) => (
            <NodeView
              key={n.id}
              node={n}
              hovered={hovered === n.id}
              onHover={setHovered}
              onToggle={toggleExpand}
              registerNode={registerNode}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ---- overlays ---- */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-neutral-500">
            No projects yet — plant some in the board view to grow your tree.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-[11px] leading-relaxed text-neutral-500">
        <p>scroll to zoom · drag to pan</p>
        <p>click a node to bloom its sub-goals</p>
      </div>

      <button
        onClick={resetView}
        className="glass-pill absolute bottom-4 right-4 rounded-full px-3 py-1.5 text-[11px] text-neutral-300 transition hover:bg-white/10 active:scale-95"
      >
        Reset view
      </button>

      <Legend />
    </div>
  );
}

/* ----------------------------------------------------------------- NodeView */

function NodeView({
  node,
  hovered,
  onHover,
  onToggle,
  registerNode,
}: {
  node: SimNode;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onToggle: (id: string) => void;
  registerNode: (id: string, el: HTMLElement | null) => void;
}) {
  // Nodes should never start a background pan when pressed.
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (node.kind === "subgoal") {
    const done = node.subgoal?.completed;
    const color = done ? "#34d399" : "#7defc8";
    return (
      <Positioned
        id={node.id}
        x={node.x + (node.dx ?? 0)}
        y={node.y + (node.dy ?? 0)}
        registerNode={registerNode}
      >
        <div
          className="flex flex-col items-center gap-1"
          onPointerDown={stop}
          onMouseEnter={() => onHover(node.id)}
          onMouseLeave={() => onHover(null)}
        >
          <span
            className="seed-breath block rounded-full"
            style={{
              width: 22,
              height: 22,
              position: "absolute",
              background: `radial-gradient(circle, ${color}88 0%, transparent 70%)`,
              animationDuration: "4s",
            }}
          />
          <span
            className="block rounded-full"
            style={{
              width: node.radius,
              height: node.radius,
              background: done
                ? `radial-gradient(circle at 35% 30%, #6ee7b7, ${color})`
                : `radial-gradient(circle at 35% 30%, #ccfff0, ${color})`,
              boxShadow: `0 0 10px ${color}cc`,
              opacity: done ? 0.7 : 1,
            }}
          />
          <span
            className={`max-w-[120px] truncate text-[9px] ${
              done ? "text-neutral-500 line-through" : "text-emerald-100/70"
            }`}
            style={{ textShadow: "0 0 6px rgba(0,0,0,0.8)" }}
          >
            {node.subgoal?.title}
          </span>
        </div>
      </Positioned>
    );
  }

  // project + idea + incubating share the orb/ring treatment, sized and tinted
  // differently. Seeds (ideas, violet) and sprouts (incubating, amber) skip the
  // status hue and progress ring; live projects keep both.
  const project = node.project!;
  const isIncubating = node.kind === "incubating";
  const isCompleted = node.kind === "completed";
  const isSeed = node.kind === "idea" || isIncubating;
  const seedColor = isIncubating ? INCUBATING_COLOR : SEED_COLOR;
  const glow: Glow = isCompleted
    ? COMPLETED_GLOW
    : isSeed
      ? { core: seedColor, ring: seedColor }
      : STATUS_GLOW[project.status] ?? STATUS_GLOW.active;

  const subs = project.subgoals ?? [];
  const total = subs.length;
  const done = subs.filter((s) => s.completed).length;
  const pct = total > 0 ? done / total : 0;

  const halo = haloAnimation(project.status);
  const r = node.radius;
  const ringR = r + 7;
  const ringC = 2 * Math.PI * ringR;
  const hasSubs = total > 0;

  return (
    <Positioned id={node.id} x={node.x} y={node.y} registerNode={registerNode}>
      <div
        className="group/node flex flex-col items-center"
        onPointerDown={stop}
        onClick={() => hasSubs && onToggle(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        style={{ cursor: hasSubs ? "pointer" : "default" }}
      >
        {/* breathing halo */}
        <span
          className={isSeed ? "seed-breath" : halo.className}
          style={{
            position: "absolute",
            width: r * 3.4,
            height: r * 3.4,
            borderRadius: "9999px",
            background: `radial-gradient(circle, ${glow.core}66 0%, transparent 68%)`,
            animationDuration: isSeed ? "5s" : halo.duration,
          }}
        />

        {/* progress ring (projects only) */}
        {!isSeed && (
          <svg
            width={ringR * 2}
            height={ringR * 2}
            className="absolute"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={ringR}
              cy={ringR}
              r={ringR}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth={3}
            />
            {hasSubs && (
              <circle
                cx={ringR}
                cy={ringR}
                r={ringR}
                fill="none"
                stroke={glow.ring}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={ringC * (1 - pct)}
                style={{
                  transition: "stroke-dashoffset 0.5s ease",
                  filter: `drop-shadow(0 0 4px ${glow.ring})`,
                }}
              />
            )}
          </svg>
        )}

        {/* core orb */}
        <span
          className="relative block rounded-full transition-transform duration-200"
          style={{
            width: r * 2,
            height: r * 2,
            background: `radial-gradient(circle at 36% 30%, ${glow.core}, ${glow.core}22 78%), #0a1512`,
            border: `1.5px solid ${glow.core}aa`,
            boxShadow: `0 0 ${hovered ? 26 : 16}px ${glow.core}${hovered ? "" : "cc"}, inset 0 0 12px ${glow.core}55`,
            transform: hovered ? "scale(1.12)" : "scale(1)",
          }}
        >
          {/* expand cue */}
          {hasSubs && (
            <span
              className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/80"
              style={{ textShadow: "0 0 6px rgba(0,0,0,0.7)" }}
            >
              {done}/{total}
            </span>
          )}
        </span>

        {/* title */}
        <span
          className={`mt-1.5 max-w-[150px] text-center text-[11px] font-medium leading-tight ${
            isCompleted
              ? "text-emerald-300/90"
              : isSeed
                ? isIncubating
                  ? "text-amber-200/90"
                  : "text-violet-200/80"
                : "text-neutral-100"
          }`}
          style={{ textShadow: "0 0 8px rgba(0,0,0,0.9)" }}
        >
          {project.title}
        </span>

        {/* hover detail card */}
        {hovered && (
          <div
            className="pointer-events-none absolute top-full z-10 mt-1 w-44 rounded-lg border border-white/10 bg-black/80 p-2 text-left backdrop-blur"
            style={{ boxShadow: `0 0 20px ${glow.core}33` }}
          >
            <p className="text-xs font-semibold text-white">{project.title}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: glow.core, boxShadow: `0 0 6px ${glow.core}` }}
              />
              <span className="text-[10px] text-neutral-300">
                {isCompleted
                  ? "Completed"
                  : isSeed
                    ? isIncubating
                      ? "Incubating"
                      : "Idea"
                    : STATUS_LABEL[project.status]}
              </span>
            </div>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-[10px] text-neutral-400">
                {project.description}
              </p>
            )}
            {hasSubs && (
              <p className="mt-1 text-[10px] text-neutral-400">
                {done} / {total} sub-goals · {Math.round(pct * 100)}%
              </p>
            )}
            {project.due_date && (
              <p className="mt-0.5 text-[10px] text-neutral-500">
                Due {project.due_date}
              </p>
            )}
          </div>
        )}
      </div>
    </Positioned>
  );
}

/** Positions a node at world coordinates and handles mount/unmount blooming. */
function Positioned({
  id,
  x,
  y,
  registerNode,
  children,
}: {
  id: string;
  x: number;
  y: number;
  registerNode: (id: string, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      ref={(el) => registerNode(id, el)}
      className="absolute"
      style={{ left: x, top: y, x: "-50%", y: "-50%" }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ Legend */

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Active", color: STATUS_GLOW.active.core },
    { label: "On hold", color: STATUS_GLOW.on_hold.core },
    { label: "Done", color: STATUS_GLOW.done.core },
    { label: "Incubating", color: INCUBATING_COLOR },
    { label: "Idea", color: SEED_COLOR },
    { label: "Completed", color: COMPLETED_GLOW.core },
  ];
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-x-3 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: it.color, boxShadow: `0 0 6px ${it.color}` }}
          />
          <span className="text-[10px] text-neutral-400">{it.label}</span>
        </span>
      ))}
    </div>
  );
}
