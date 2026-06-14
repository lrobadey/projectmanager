import { type Space } from "@/types/spaces";

// Placeholder shown for dashboards that exist in the selector but aren't built
// out yet. Same glass shell as the rest of the app so switching spaces feels
// like part of the product, not a dead end.
export default function ComingSoon({ space }: { space: Space }) {
  return (
    <div className="glass mx-auto mt-6 flex max-w-xl flex-col items-center gap-4 rounded-3xl px-8 py-16 text-center">
      <h2 className="text-xl font-semibold">{space.word} dashboard</h2>
      <p className="max-w-sm text-sm text-neutral-300">{space.tagline}</p>
      <span className="glass-pill rounded-full px-3 py-1 text-xs uppercase tracking-wide text-neutral-300">
        Coming soon
      </span>
    </div>
  );
}
