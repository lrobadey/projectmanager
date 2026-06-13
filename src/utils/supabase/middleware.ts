import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Comma-separated allowlist of emails permitted to use the app. If unset,
// no one is allowed in — fail closed rather than open.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const isAllowedEmail = (email?: string | null) =>
  !!email && allowedEmails.includes(email.toLowerCase());

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Without env vars there's no session to refresh; let the request through
  // so pages can surface a readable error instead of a blanket 500.
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: refreshes the auth token. Do not run code between
  // createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect app routes: redirect unauthenticated users to the login page.
  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" || path.startsWith("/auth") || path === "/";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed in but not on the allowlist: tear down the session and bounce to
  // login. This is the hard gate — even a valid Supabase user can't get in.
  if (user && !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
};
