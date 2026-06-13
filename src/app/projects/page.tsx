import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TIERS, type Project } from "@/types/db";
import NewProjectForm from "./NewProjectForm";
import ProjectCard from "./ProjectCard";

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as Project[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
            Sign out
          </button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const items = projects.filter((p) => p.tier === tier.value);
          return (
            <section key={tier.value} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                  {tier.label}
                </h2>
                <span className="text-xs text-neutral-400">{items.length}</span>
              </div>
              {items.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
              <NewProjectForm defaultTier={tier.value} />
            </section>
          );
        })}
      </div>
    </main>
  );
}
