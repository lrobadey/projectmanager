"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SPACES, SPACE_BY_ID, type SpaceId } from "@/types/spaces";

// The glass pill that wraps the changing word in the dashboard title. Tapping it
// opens a list of spaces to cycle between (Gaming, Reading, Music, …). It only
// reports the chosen id upward — the parent owns the actual selection state.
export default function SpacePill({
  space,
  onSelect,
}: {
  space: SpaceId;
  onSelect: (id: SpaceId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const current = SPACE_BY_ID[space];

  // Close on outside tap or Escape while the menu is open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="glass-pill inline-flex items-center gap-1 rounded-full px-3 py-0.5 transition active:scale-95"
      >
        <span>{current.word}</span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`h-3 w-3 text-neutral-300 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="glass glass-airy absolute left-0 top-full z-50 mt-2 w-60 origin-top-left overflow-hidden rounded-2xl p-1.5 text-base font-normal"
          >
            {SPACES.map((s) => {
              const selected = s.id === space;
              return (
                <li key={s.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(s.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10 ${
                      selected ? "bg-white/10" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-100">
                      {s.word}
                    </span>
                    {!s.live && (
                      <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                        Soon
                      </span>
                    )}
                    {selected && (
                      <svg
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-emerald-300"
                      >
                        <path
                          d="M2.5 7.5 6 11l5.5-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </span>
  );
}
