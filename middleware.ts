import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users away from /dashboard
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated and on a dashboard route, fetch role from org_members
  if (user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const { data: member } = await supabase
      .from("org_members")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const role = member?.role ?? "viewer";
    supabaseResponse.headers.set("x-user-role", role);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
