import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { type Project } from "@/types/db";
import DesktopView from "./DesktopView";
import MobileBoard from "./MobileBoard";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("projects")
    .select("*, subgoals(*), links:project_links(*)")
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "subgoals", ascending: true })
    .order("position", { referencedTable: "project_links", ascending: true });

  const projects = (data ?? []) as Project[];

  return (
    <main
      className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
    >
      {/* z-50 + pointer-events tweaks let the header keep its spot floating
          above the fullscreen tree, while the rest of the top band stays
          pannable. */}
      <header className="pointer-events-none relative z-50 mb-6 flex items-center justify-between gap-3 md:mb-8">
        <div className="pointer-events-auto min-w-0">
          <h1 className="text-xl font-semibold md:text-2xl">
            {"Luca's Project Dashboard"}
          </h1>
          <p className="truncate text-sm text-neutral-500">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post" className="pointer-events-auto">
          <button className="shrink-0 rounded-full border border-neutral-300 px-4 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 active:scale-95 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Sign out
          </button>
        </form>
      </header>

      {/* Desktop: toggle between the drag-and-drop board and the living tree. */}
      <div className="hidden md:block">
        <DesktopView projects={projects} />
      </div>

      {/* Phones get a dedicated, touch-first board. */}
      <div className="md:hidden">
        <MobileBoard projects={projects} />
      </div>
    </main>
  );
}
