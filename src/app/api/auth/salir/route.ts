import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/jwt";

/**
 * GET /api/auth/salir — borra la cookie de sesión y manda al login.
 * Se usa cuando la cookie está bien firmada pero su usuario ya no existe o fue
 * desactivado: sin borrarla, el proxy y la página se redirigirían en bucle.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.nextUrl));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
