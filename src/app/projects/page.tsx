import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { type Game, type Project } from "@/types/db";
import Dashboard from "./Dashboard";

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

  // The dashboard shell swaps between spaces client-side, so the gaming board's
  // data is fetched here alongside projects and handed down together.
  const { data: gamesData } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });

  const games = (gamesData ?? []) as Game[];

  return (
    <main
      className="mx-auto w-full max-w-7xl px-4 py-6 md:py-8"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
    >
      <Dashboard userEmail={user.email ?? ""} projects={projects} games={games} />
    </main>
  );
}
