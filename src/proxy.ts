import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./server/auth/jwt";

/**
 * Redirecciones rápidas según la cookie de sesión (sin consultar la base de datos).
 * La verificación completa la hace cada página/acción con `requireBarber`/`requireAdmin`.
 */
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (path === "/login") {
    if (session) return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin" : "/barbero", req.nextUrl));
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (path.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/barbero", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/barbero/:path*", "/admin/:path*"],
};
