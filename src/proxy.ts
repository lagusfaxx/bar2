import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (lo que en versiones anteriores de Next se llamaba middleware).
 *
 * Hace una comprobacion optimista: si no hay cookie de sesion, redirige al
 * login sin tocar la base de datos. La verificacion real —firma del token,
 * usuario activo y rol— ocurre en el layout de cada area y en cada Server
 * Action, que es donde importa.
 */
const PANEL_COOKIE = "barzuo_panel";
const MEMBER_COOKIE = "barzuo_card";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Area privada de socios BarzuCard
  if (pathname.startsWith("/barzucard/tarjeta")) {
    if (!request.cookies.has(MEMBER_COOKIE)) {
      const url = new URL("/barzucard/ingresar", request.url);
      url.searchParams.set("volver", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Panel administrativo y app de personal de sala
  const isPanel = pathname.startsWith("/admin") || pathname.startsWith("/staff");
  const isLogin = pathname === "/admin/login" || pathname === "/staff/login";

  if (isPanel && !isLogin && !request.cookies.has(PANEL_COOKIE)) {
    const loginPath = pathname.startsWith("/staff") ? "/staff/login" : "/admin/login";
    const url = new URL(loginPath, request.url);
    url.searchParams.set("volver", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // Con sesion activa, el login pierde sentido.
  if (isLogin && request.cookies.has(PANEL_COOKIE)) {
    const target = pathname.startsWith("/staff") ? "/staff" : "/admin";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/barzucard/tarjeta/:path*"],
};
