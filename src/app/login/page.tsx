"use client";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Project Manager</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Track your music projects, timelines, and ideas.
        </p>
      </div>
      <button
        onClick={signInWithGoogle}
        className="rounded-full border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        Continue with Google
      </button>
    </main>
  );
}
