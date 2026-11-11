import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { WEBHOOK_PATH } from "@/lib/webhook-path";
import {
  isSupabaseConfigured,
  supabaseKey,
  supabaseUrl,
} from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  // A Pluggy chama este endereço sem login; ele se protege pela senha própria.
  if (request.nextUrl.pathname === WEBHOOK_PATH) return NextResponse.next();

  const isLogin = request.nextUrl.pathname === "/login";

  if (!isSupabaseConfigured) {
    return isLogin
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  if (isLoggedIn === isLogin) {
    const target = isLoggedIn ? "/dashboard" : "/login";
    const redirect = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|webp|ico)$).*)"],
};
