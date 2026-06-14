"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { type Project } from "@/types/db";
import Board from "./Board";

const TreeView = dynamic(() => import("./tree/TreeView"), {
  ssr: false,
  loading: () => null,
});

type Mode = "board" | "tree";
const STORE_KEY = "dashboard-view";

/* A tiny external store over localStorage so the chosen view survives reloads
 * and reads cleanly on the server (always "board") without a hydration clash. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): Mode {
  return localStorage.getItem(STORE_KEY) === "tree" ? "tree" : "board";
}
function getServerSnapshot(): Mode {
  return "board";
}
function setMode(m: Mode) {
  localStorage.setItem(STORE_KEY, m);
  listeners.forEach((l) => l());
}

/**
 * Desktop shell: a segmented Board ↔ Tree toggle over the two visualizations.
 * The board stays the default, fully-interactive workspace; the tree is an
 * opt-in, explore-only living view of the same projects.
 */
export default function DesktopView({ projects }: { projects: Project[] }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // A single, always-mounted toggle pinned to the top-center of the screen, so
  // the white active pill glides left↔right between Board and Tree instead of
  // jumping. (Keeping one instance across both modes is what lets the shared
  // `layoutId` animate the indicator.)
  const toggle = (
    <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
      <div className="glass-pill inline-flex rounded-full p-1 text-sm">
        <Segment active={mode === "board"} onClick={() => setMode("board")}>
          Board
        </Segment>
        <Segment active={mode === "tree"} onClick={() => setMode("tree")}>
          Tree
        </Segment>
      </div>
    </div>
  );

  return (
    <>
      {mode === "tree" ? (
        <TreeView projects={projects} />
      ) : (
        // Pad the board down so its first row clears the fixed toggle above it.
        <div className="pt-12">
          <Board projects={projects} />
        </div>
      )}
      {toggle}
    </>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="relative rounded-full px-4 py-1.5">
      {active && (
        <motion.span
          layoutId="viewPill"
          className="absolute inset-0 rounded-full bg-white shadow"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span
        className={`relative z-10 transition-colors ${
          active ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-200"
        }`}
      >
        {children}
      </span>
    </button>
  );
}
