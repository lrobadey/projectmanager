"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
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

  const toggle = (
    <div className="glass-pill inline-flex rounded-full p-1 text-sm">
      <Segment active={mode === "board"} onClick={() => setMode("board")}>
        Board
      </Segment>
      <Segment active={mode === "tree"} onClick={() => setMode("tree")}>
        Tree
      </Segment>
    </div>
  );

  // The tree takes over the whole screen; its toggle floats on top of it.
  if (mode === "tree") {
    return (
      <>
        <TreeView projects={projects} />
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">{toggle}</div>
      </>
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-center">{toggle}</div>
      <Board projects={projects} />
    </div>
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
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 transition ${
        active
          ? "bg-white text-neutral-900 shadow"
          : "text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
