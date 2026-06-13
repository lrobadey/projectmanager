import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { isAllowedEmail } from "@/utils/supabase/middleware";

async function rejectIfNotAllowed(
  supabase: ReturnType<typeof createClient>,
  origin: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=forbidden`);
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/projects";

  // Two possible magic-link shapes depending on the email template:
  //  - PKCE code flow:    ?code=...
  //  - token_hash flow:   ?token_hash=...&type=magiclink
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return (
        (await rejectIfNotAllowed(supabase, origin)) ??
        NextResponse.redirect(`${origin}${next}`)
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return (
        (await rejectIfNotAllowed(supabase, origin)) ??
        NextResponse.redirect(`${origin}${next}`)
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
