import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * OAuth landing route. Supabase sends the browser here with `?code=...`; we trade
 * it for a session cookie and bounce back into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only allow same-origin paths so the callback can't be used as an open redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  if (oauthError) return NextResponse.redirect(`${origin}/?auth=erro`);
  if (!code) return NextResponse.redirect(`${origin}/?auth=sem-codigo`);

  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(`${origin}/?auth=indisponivel`);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/?auth=erro`);

  return NextResponse.redirect(`${origin}${target}`);
}
