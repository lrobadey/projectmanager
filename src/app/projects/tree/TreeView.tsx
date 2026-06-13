"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { STATUSES, type Project, type ProjectTier } from "@/types/db";
import {
  BASE,
  BRANCH_DIR,
  FORK,
  SETTLE_THRESHOLD,
  buildNodes,
  step,
  type SimNode,
} from "./forceLayout";

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

  // The mutable physics array lives in a ref; each settled frame is published
  // to `nodes` state to drive rendering. Once the layout settles the loop stops.
  const nodesRef = useRef<SimNode[]>([]);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const settleRef = useRef(0);
  const viewRef = useRef(view);
  const initedRef = useRef(false);

  // Keep the wheel handler's view snapshot current without reading a ref in render.
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const run = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    settleRef.current = 0;
    const loop = () => {
      const peak = step(nodesRef.current);
      setNodes(nodesRef.current.slice());
      if (peak < SETTLE_THRESHOLD) {
        settleRef.current += 1;
        if (settleRef.current > 24) {
          runningRef.current = false;
          rafRef.current = null;
          return;
        }
      } else {
        settleRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  // Rebuild nodes (carrying over positions) whenever the data or which nodes
  // are bloomed changes, then wake the simulation to re-settle.
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    nodesRef.current = buildNodes(projects, expanded, prev);
    setNodes(nodesRef.current.slice());
    run();
  }, [projects, expanded, run]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
    };
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

  const nodeById = useMemo(() => {
    const m = new Map<string, SimNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // ----- branch geometry (recomputed each frame from live node positions) ----
  const branches = nodes
    .filter((n) => n.kind === "project")
    .map((n) => {
      const dir = BRANCH_DIR[n.tier as ProjectTier];
      const c1x = FORK.x + dir.x * 50;
      const c1y = FORK.y + dir.y * 50;
      const c2x = n.x - dir.x * 44;
      const c2y = n.y - dir.y * 44;
      return {
        id: n.id,
        d: `M ${FORK.x} ${FORK.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${n.x} ${n.y}`,
        w: n.tier === "primary" ? 5 : 4,
      };
    });

  const twigs = nodes
    .filter((n) => n.kind === "subgoal" && n.parentId)
    .map((n) => {
      const p = nodeById.get(n.parentId!);
      if (!p) return null;
      const mx = (p.x + n.x) / 2;
      const my = (p.y + n.y) / 2;
      // Bow the twig slightly perpendicular to its run for an organic curve.
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const bow = 10;
      const qx = mx + (-dy / len) * bow;
      const qy = my + (dx / len) * bow;
      return { id: n.id, d: `M ${p.x} ${p.y} Q ${qx} ${qy} ${n.x} ${n.y}` };
    })
    .filter(Boolean) as { id: string; d: string }[];

  const isEmpty = projects.length === 0;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      className="relative h-[78vh] min-h-[520px] w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl border border-white/5 active:cursor-grabbing"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 100%, #0c1a16 0%, #070d0a 55%, #05080a 100%)",
      }}
    >
      {/* faint vignette of drifting motes for depth */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(circle_at_20%_30%,rgba(34,211,238,0.06),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.06),transparent_40%)]" />

      {/* The transformed world: branches (SVG) + nodes (HTML) share one frame. */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
        }}
      >
        <svg
          className="absolute left-0 top-0 overflow-visible"
          width={0}
          height={0}
        >
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

          {/* Trunk: a thick glowing column rising from the base to the fork. */}
          <g filter="url(#treeGlow)">
            <path
              d={`M ${BASE.x} ${BASE.y + 6} L ${FORK.x} ${FORK.y}`}
              stroke="url(#branchGrad)"
              strokeWidth={22}
              strokeLinecap="round"
              fill="none"
              className="branch-pulse"
              style={{ animationDuration: "4s" }}
            />
            {branches.map((b, i) => (
              <path
                key={`g-${b.id}`}
                d={b.d}
                stroke="url(#branchGrad)"
                strokeWidth={b.w * 2.6}
                strokeLinecap="round"
                fill="none"
                className="branch-pulse"
                style={{ animationDuration: `${2.6 + (i % 4) * 0.4}s` }}
              />
            ))}
            {twigs.map((t, i) => (
              <path
                key={`gt-${t.id}`}
                d={t.d}
                stroke="#5eead4"
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
                className="branch-pulse"
                style={{ animationDuration: `${2.2 + (i % 5) * 0.3}s` }}
              />
            ))}
          </g>

          {/* Crisp cores on top of the glow. */}
          <path
            d={`M ${BASE.x} ${BASE.y + 6} L ${FORK.x} ${FORK.y}`}
            stroke="url(#branchGrad)"
            strokeWidth={9}
            strokeLinecap="round"
            fill="none"
            opacity={0.95}
          />
          {branches.map((b) => (
            <path
              key={`c-${b.id}`}
              d={b.d}
              stroke="url(#branchGrad)"
              strokeWidth={b.w}
              strokeLinecap="round"
              fill="none"
              opacity={0.92}
            />
          ))}
          {twigs.map((t) => (
            <path
              key={`ct-${t.id}`}
              d={t.d}
              stroke="#7defc8"
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
              opacity={0.8}
            />
          ))}
        </svg>

        {/* Nodes */}
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

      <div className="pointer-events-none absolute left-4 top-4 text-[11px] leading-relaxed text-neutral-500">
        <p>scroll to zoom · drag to pan</p>
        <p>click a node to bloom its sub-goals</p>
      </div>

      <button
        onClick={resetView}
        className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-neutral-300 backdrop-blur transition hover:bg-white/10 active:scale-95"
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
