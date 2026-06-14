"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { statusForTier, type ProjectStatus, type ProjectTier } from "@/types/db";

async function getSupabase() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export async function createProject(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const tier = (formData.get("tier") as ProjectTier) || "idea";
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const due_date = String(formData.get("due_date") ?? "") || null;
  // Idea Vault → "Idea", Completed → "Done", everything else starts Active.
  const status: ProjectStatus = statusForTier(tier, "active");

  await supabase.from("projects").insert({
    user_id: user.id,
    title,
    subtitle,
    description,
    tier,
    status,
    due_date,
  });

  revalidatePath("/projects");
}

export async function updateProject(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));

  const patch: Record<string, unknown> = {};
  if (formData.has("title")) patch.title = String(formData.get("title")).trim();
  if (formData.has("subtitle"))
    patch.subtitle = String(formData.get("subtitle")).trim() || null;
  if (formData.has("tier")) patch.tier = formData.get("tier") as ProjectTier;
  if (formData.has("status"))
    patch.status = formData.get("status") as ProjectStatus;
  if (formData.has("description"))
    patch.description = String(formData.get("description")).trim() || null;
  if (formData.has("due_date"))
    patch.due_date = String(formData.get("due_date")) || null;

  // Keep status and tier consistent: vault items are always "Idea", Completed
  // items are always "Done", and any project leaving the vault (its status field
  // is hidden, so absent here) is handed a real work status.
  if (patch.tier === "idea") {
    patch.status = "idea";
    patch.completed_from_tier = null;
  } else if (patch.tier === "completed") {
    patch.status = "done";
    // Remember where it graduated from — but only the first time, so re-saving a
    // project that's already completed keeps its original origin tier.
    const { data: existing } = await supabase
      .from("projects")
      .select("tier")
      .eq("id", id)
      .single();
    if (existing && existing.tier !== "completed") {
      patch.completed_from_tier = existing.tier;
    }
  } else if (patch.tier !== undefined) {
    if (patch.status === undefined) patch.status = "active";
    // Left the Completed column → drop the remembered origin.
    patch.completed_from_tier = null;
  }

  await supabase.from("projects").update(patch).eq("id", id);
  revalidatePath("/projects");
}

export async function moveProject(id: string, tier: ProjectTier) {
  const supabase = await getSupabase();
  if (tier === "idea") {
    // Back into the vault: it's just an idea again.
    await supabase
      .from("projects")
      .update({ tier, status: "idea", completed_from_tier: null })
      .eq("id", id);
  } else if (tier === "completed") {
    // Graduating to Completed: mark it done and remember the origin tier so the
    // crown orb can be tinted by it and the project can be restored later.
    const { data: existing } = await supabase
      .from("projects")
      .select("tier")
      .eq("id", id)
      .single();
    const completed_from_tier =
      existing && existing.tier !== "completed" ? existing.tier : null;
    await supabase
      .from("projects")
      .update({ tier, status: "done", completed_from_tier })
      .eq("id", id);
  } else {
    await supabase
      .from("projects")
      .update({ tier, completed_from_tier: null })
      .eq("id", id);
    // Leaving the vault: a former idea needs a real work status.
    await supabase
      .from("projects")
      .update({ status: "active" })
      .eq("id", id)
      .eq("status", "idea");
  }
  revalidatePath("/projects");
}

export async function deleteProject(formData: FormData) {
  const supabase = await getSupabase();
  const id = String(formData.get("id"));
  await supabase.from("projects").delete().eq("id", id);
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// Sub-goals
// ---------------------------------------------------------------------------

export async function addSubgoal(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const project_id = String(formData.get("project_id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!project_id || !title) return;

  // New sub-goals append to the bottom of the list.
  const { count } = await supabase
    .from("subgoals")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project_id);

  await supabase.from("subgoals").insert({
    user_id: user.id,
    project_id,
    title,
    position: count ?? 0,
  });

  revalidatePath("/projects");
}

export async function toggleSubgoal(id: string, completed: boolean) {
  const supabase = await getSupabase();
  await supabase.from("subgoals").update({ completed }).eq("id", id);
  revalidatePath("/projects");
}

// Save the free-form notes typed against a single sub-goal.
export async function updateSubgoalNotes(id: string, notes: string) {
  const supabase = await getSupabase();
  await supabase
    .from("subgoals")
    .update({ notes: notes.trim() || null })
    .eq("id", id);
  revalidatePath("/projects");
}

export async function deleteSubgoal(id: string) {
  const supabase = await getSupabase();
  await supabase.from("subgoals").delete().eq("id", id);
  revalidatePath("/projects");
}

// Persist a new ordering: orderedIds is the full list of a project's sub-goal
// ids in their desired top-to-bottom order.
export async function reorderSubgoals(orderedIds: string[]) {
  const supabase = await getSupabase();
  await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from("subgoals").update({ position }).eq("id", id),
    ),
  );
  revalidatePath("/projects");
}

// ---------------------------------------------------------------------------
// Source links
// ---------------------------------------------------------------------------

// Accept bare hosts ("example.com") by defaulting to https, and reject anything
// that isn't an http(s) URL so a stored link can never smuggle in javascript:.
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function addProjectLink(formData: FormData) {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const project_id = String(formData.get("project_id"));
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  const title = String(formData.get("title") ?? "").trim() || null;
  if (!project_id || !url) return;

  // New links append to the end of the list.
  const { count } = await supabase
    .from("project_links")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project_id);

  await supabase.from("project_links").insert({
    user_id: user.id,
    project_id,
    url,
    title,
    position: count ?? 0,
  });

  revalidatePath("/projects");
}

export async function deleteProjectLink(id: string) {
  const supabase = await getSupabase();
  await supabase.from("project_links").delete().eq("id", id);
  revalidatePath("/projects");
}
