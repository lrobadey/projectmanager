"use client";

import { MUSIC_SORTS, type MusicSort } from "@/types/db";

// A compact glass segmented control for choosing the shelf's sort order. Shared
// by the desktop board and the mobile board.
export default function SortControl({
  value,
  onChange,
}: {
  value: MusicSort;
  onChange: (v: MusicSort) => void;
}) {
  return (
    <div className="glass-pill inline-flex items-center gap-0.5 rounded-full p-0.5">
      <span className="px-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
        Sort
      </span>
      {MUSIC_SORTS.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              active
                ? "bg-white/20 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
