import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { type Project } from "@/types/db";
import Board from "./Board";

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

      <Board projects={projects} />
    </main>
  );
}
