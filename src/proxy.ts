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

/**
 * Paginas publicas que Cloudflare puede guardar en su nodo mas cercano.
 *
 * El panel, la app de sala y todo /barzucard leen cookies de sesion y no deben
 * cachearse en ningun lado.
 */
const CACHEABLE = new Set([
  "/",
  "/eventos",
  "/carta",
  "/nosotros",
  "/galeria",
  "/ubicacion",
  "/contacto",
  "/legales",
]);

const isCacheable = (pathname: string) =>
  CACHEABLE.has(pathname) || /^\/eventos\/[^/]+$/.test(pathname);

/**
 * Cuanto puede guardar el borde una pagina publica.
 *
 * Aca habia una trampa. El HTML publico se guardaba una hora en Cloudflare,
 * apoyandose en que al guardar en el panel se purga el cache. Pero la purga
 * necesita `CLOUDFLARE_ZONE_ID` y `CLOUDFLARE_API_TOKEN`, y sin esas variables
 * no hace nada — en silencio, sin un aviso en ningun lado. El resultado, para
 * quien administra el bar, es que cambia el precio de un trago, entra a la web
 * a mirarlo y lo sigue viendo viejo durante una hora. Parece que el panel no
 * guarda.
 *
 * La duracion ahora depende de si la purga esta configurada de verdad. Con
 * credenciales, la hora entera: el cambio igual se ve al instante porque se
 * purga al guardar. Sin ellas, un minuto: se pierde algo de rendimiento, pero
 * el sitio deja de mentirle a quien lo edita.
 *
 * Se decide aca y no en next.config porque las cabeceras de la configuracion
 * se calculan al compilar la imagen, y estas credenciales llegan recien al
 * arrancar el contenedor. El proxy, en cambio, corre en Node en cada peticion.
 */
function edgeCacheControl() {
  const purgeConfigurada =
    !!process.env.CLOUDFLARE_ZONE_ID && !!process.env.CLOUDFLARE_API_TOKEN;

  // `max-age=0` mantiene el navegador siempre al dia: el cache es del borde,
  // no del dispositivo.
  return purgeConfigurada
    ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    : "public, max-age=0, s-maxage=60, stale-while-revalidate=600";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isCacheable(pathname)) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", edgeCacheControl());
    return response;
  }

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
  matcher: [
    "/admin/:path*",
    "/staff/:path*",
    "/barzucard/tarjeta/:path*",
    // Publicas: solo para ponerles la cabecera de cache (ver arriba).
    "/",
    "/eventos",
    "/eventos/:slug",
    "/carta",
    "/nosotros",
    "/galeria",
    "/ubicacion",
    "/contacto",
    "/legales",
  ],
};
