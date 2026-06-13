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

/** A connector ready for the SVG layer, produced fresh each frame. */
type RopeRender = {
  id: string;
  kind: "trunk" | "branch" | "twig" | "root";
  d: string;
  w: number;
};

// Stroke per rope kind. Roots glow violet (idea seeds), twigs teal, the trunk
// and branches ride the violet→cyan→teal gradient.
function ropeStroke(kind: RopeRender["kind"], glow: boolean): string {
  if (kind === "twig") return glow ? "#5eead4" : "#7defc8";
  if (kind === "root") return glow ? "#7c3aed" : "#a78bfa";
  return "url(#branchGrad)";
}

const TRUNK_ID = "__trunk__";

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

/* -------------------------------------------------------------- TreeView */

export default function TreeView({ projects }: { projects: Project[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  // The mutable physics array lives in refs; every frame we publish a node
  // snapshot and a fresh set of rope paths to state to drive rendering.
  const nodesRef = useRef<SimNode[]>([]);
  const ropesRef = useRef<Map<string, Rope>>(new Map());
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [ropes, setRopes] = useState<RopeRender[]>([]);
  // The force sim "sleeps" once settled; the rope loop keeps running so the
  // ropes sway in the wind forever.
  const hotRef = useRef(true);
  const settleRef = useRef(0);
  const viewRef = useRef(view);
  const initedRef = useRef(false);

  // Keep the wheel handler's view snapshot current without reading a ref in render.
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const reheat = useCallback(() => {
    hotRef.current = true;
    settleRef.current = 0;
  }, []);

  // Rebuild nodes (carrying over positions) whenever the data or which nodes
  // are bloomed changes, then wake the simulation to re-settle.
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = buildNodes(projects, expanded, prev);
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
      const byId = new Map(ns.map((n) => [n.id, n]));
      const map = ropesRef.current;
      const out: RopeRender[] = [];
      const seen = new Set<string>();

      // Trunk: base → fork (both ends fixed; it just sways in the wind).
      seen.add(TRUNK_ID);
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
      out.push({ id: TRUNK_ID, kind: "trunk", d: ropePath(trunk), w: 9 });

      // Roots: every idea-vault seed is a root rope converging on the trunk
      // base, so the ideas all feed the trunk that rises and branches above.
      for (const n of ns) {
        if (n.kind !== "idea") continue;
        seen.add(n.id);
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
        out.push({ id: n.id, kind: "root", d: ropePath(rope), w: 3 });
      }

      // Branches: fork → each project orb.
      for (const n of ns) {
        if (n.kind !== "project") continue;
        seen.add(n.id);
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
        out.push({
          id: n.id,
          kind: "branch",
          d: ropePath(rope),
          w: n.tier === "primary" ? 5 : 4,
        });
      }

      // Twigs: parent orb → sub-goal orb.
      for (const n of ns) {
        if (n.kind !== "subgoal" || !n.parentId) continue;
        const p = byId.get(n.parentId);
        if (!p) continue;
        seen.add(n.id);
        let rope = map.get(n.id);
        if (!rope) {
          rope = makeRope(p.x, p.y, n.x, n.y, 7, hashPhase(n.id));
          map.set(n.id, rope);
        }
        stepRope(rope, p.x, p.y, n.x, n.y, t, {
          gravity: 0.06,
          wind: 0.42,
          slack: 1.08,
        });
        out.push({ id: n.id, kind: "twig", d: ropePath(rope), w: 1.6 });
      }

      // Drop ropes whose nodes have gone away.
      for (const k of map.keys()) if (!seen.has(k)) map.delete(k);

      setNodes(ns.slice());
      setRopes(out);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Track container size; center the trunk base at the bottom on first measure.
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
      if (!initedRef.current && width > 0 && height > 0) {
        initedRef.current = true;
        setView({ x: width / 2, y: height * 0.84, scale: 1 });
      }
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
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const v = viewRef.current;
      const scale = clamp(v.scale * Math.exp(-e.deltaY * 0.0015), 0.35, 2.4);
      // Keep the world point under the cursor fixed while zooming.
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      setView({ scale, x: cx - wx * scale, y: cy - wy * scale });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Background drag to pan.
  const panRef = useRef<{ px: number; py: number; vx: number; vy: number } | null>(
    null,
  );
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    panRef.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = panRef.current;
    if (!p) return;
    setView((v) => ({
      ...v,
      x: p.vx + (e.clientX - p.px),
      y: p.vy + (e.clientY - p.py),
    }));
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
    if (size.w > 0) setView({ x: size.w / 2, y: size.h * 0.84, scale: 1 });
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

        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {/* Glow pass: a wide, blurred, pulsing aura under every rope. */}
          <g filter="url(#treeGlow)">
            {ropes.map((r, i) => (
              <path
                key={`g-${r.id}`}
                d={r.d}
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
          {ropes.map((r) => (
            <path
              key={`c-${r.id}`}
              d={r.d}
              stroke={ropeStroke(r.kind, false)}
              strokeWidth={r.w}
              strokeLinecap="round"
              fill="none"
              opacity={r.kind === "twig" || r.kind === "root" ? 0.82 : 0.92}
            />
          ))}
        </g>
      </svg>

      {/* The transformed world holds the HTML nodes, aligned to the SVG layer. */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <AnimatePresence>
          {nodes.map((n) => (
            <NodeView
              key={n.id}
              node={n}
              hovered={hovered === n.id}
              onHover={setHovered}
              onToggle={toggleExpand}
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
        className="absolute bottom-4 right-4 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-neutral-300 backdrop-blur transition hover:bg-white/10 active:scale-95"
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
}: {
  node: SimNode;
  hovered: boolean;
  onHover: (id: string | null) => void;
  onToggle: (id: string) => void;
}) {
  // Nodes should never start a background pan when pressed.
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  if (node.kind === "subgoal") {
    const done = node.subgoal?.completed;
    const color = done ? "#34d399" : "#7defc8";
    return (
      <Positioned x={node.x} y={node.y}>
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

  // project + idea share the orb/ring treatment, sized differently.
  const project = node.project!;
  const isIdea = node.kind === "idea";
  const glow: Glow = isIdea
    ? { core: SEED_COLOR, ring: SEED_COLOR }
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
    <Positioned x={node.x} y={node.y}>
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
          className={isIdea ? "seed-breath" : halo.className}
          style={{
            position: "absolute",
            width: r * 3.4,
            height: r * 3.4,
            borderRadius: "9999px",
            background: `radial-gradient(circle, ${glow.core}66 0%, transparent 68%)`,
            animationDuration: isIdea ? "5s" : halo.duration,
          }}
        />

        {/* progress ring (projects only) */}
        {!isIdea && (
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
            isIdea ? "text-violet-200/80" : "text-neutral-100"
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
                {isIdea ? "Idea" : STATUS_LABEL[project.status]}
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
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
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
    { label: "Idea", color: SEED_COLOR },
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
