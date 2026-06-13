"use client";

import { useState, useSyncExternalStore } from "react";
import { createClient } from "@/utils/supabase/client";

// The "forbidden" flag is read once from the URL — an external value, so it
// goes through useSyncExternalStore (false on the server, read on the client)
// rather than a setState-in-effect.
const noopSubscribe = () => () => {};
const readForbidden = () =>
  new URLSearchParams(window.location.search).get("error") === "forbidden";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const forbidden = useSyncExternalStore(noopSubscribe, readForbidden, () => false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <main className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Project Manager</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Track your music projects, timelines, and ideas.
        </p>
      </div>

      {forbidden && (
        <p className="max-w-sm text-center text-sm text-red-500">
          That account isn’t allowed to access this app.
        </p>
      )}

      {status === "sent" ? (
        <p className="max-w-sm text-center text-sm text-neutral-600 dark:text-neutral-300">
          Check your email — we sent a login link to{" "}
          <span className="font-medium">{email}</span>. Open it in this browser
          to sign in.
        </p>
      ) : (
        <form
          onSubmit={sendMagicLink}
          className="flex w-full max-w-sm flex-col gap-3"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {status === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {status === "error" && (
            <p className="text-center text-xs text-red-600">{message}</p>
          )}
        </form>
      )}
    </main>
  );
}
