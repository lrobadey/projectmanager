"use client";

import { useSyncExternalStore } from "react";
import { type Game, type Project } from "@/types/db";
import { resolveSpace, SPACE_BY_ID, type SpaceId } from "@/types/spaces";
import DesktopView from "./DesktopView";
import MobileBoard from "./MobileBoard";
import SpacePill from "./SpacePill";
import ComingSoon from "./ComingSoon";
import GameBoard from "../gaming/GameBoard";
import MobileGameBoard from "../gaming/MobileGameBoard";

const STORE_KEY = "dashboard-space";

/* A tiny external store over localStorage + the URL so the chosen space survives
 * reloads and reads cleanly on the server (always "projects") without a
 * hydration clash. The URL (?space=…) wins on load so links are shareable. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): SpaceId {
  const fromUrl = new URLSearchParams(window.location.search).get("space");
  return resolveSpace(fromUrl ?? localStorage.getItem(STORE_KEY));
}
function getServerSnapshot(): SpaceId {
  return "projects";
}
function setSpace(next: SpaceId) {
  localStorage.setItem(STORE_KEY, next);
  // Reflect the choice in the URL without a navigation/re-render.
  const url = new URL(window.location.href);
  if (next === "projects") url.searchParams.delete("space");
  else url.searchParams.set("space", next);
  window.history.replaceState(null, "", url);
  listeners.forEach((l) => l());
}

// The interactive shell: header (with the space-switching glass pill) plus the
// body that swaps between the live Projects dashboard and "coming soon" cards.
export default function Dashboard({
  userEmail,
  projects,
  games,
}: {
  userEmail: string;
  projects: Project[];
  games: Game[];
}) {
  const space = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const current = SPACE_BY_ID[space];

  return (
    <>
      {/* z-50 + pointer-events tweaks let the header keep its spot floating
          above the fullscreen tree, while the rest of the top band stays
          pannable. */}
      <header className="pointer-events-none relative z-50 mb-6 flex items-center justify-between gap-3 md:mb-8">
        <div className="pointer-events-auto min-w-0">
          <h1 className="flex flex-wrap items-center gap-x-2 text-xl font-semibold md:text-2xl">
            <span>{"Luca's"}</span>
            <SpacePill space={space} onSelect={setSpace} />
            <span>Dashboard</span>
          </h1>
          <p className="truncate text-sm text-neutral-500">{userEmail}</p>
        </div>
        <form action="/auth/signout" method="post" className="pointer-events-auto">
          <button className="shrink-0 rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 active:scale-95 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Sign out
          </button>
        </form>
      </header>

      {space === "projects" ? (
        <>
          {/* Desktop: toggle between the drag-and-drop board and the living tree. */}
          <div className="hidden md:block">
            <DesktopView projects={projects} />
          </div>
          {/* Phones get a dedicated, touch-first board. */}
          <div className="md:hidden">
            <MobileBoard projects={projects} />
          </div>
        </>
      ) : space === "gaming" ? (
        <>
          {/* Gaming borrows the same tier board, sans the Board/Tree toggle. */}
          <div className="hidden md:block">
            <GameBoard games={games} />
          </div>
          <div className="md:hidden">
            <MobileGameBoard games={games} />
          </div>
        </>
      ) : (
        <ComingSoon space={current} />
      )}
    </>
  );
}
