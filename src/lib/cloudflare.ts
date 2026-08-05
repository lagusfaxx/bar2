import "server-only";

/**
 * Purga del cache de Cloudflare.
 *
 * El sitio deja que Cloudflare guarde el HTML publico en su nodo mas cercano
 * al visitante. Para que eso sirva de verdad, la copia tiene que durar horas:
 * con una vigencia de un minuto y poco trafico, casi toda visita cae justo
 * despues de que vencio y termina esperando el viaje completo hasta el
 * servidor — que es exactamente lo que se queria evitar.
 *
 * Vigencia larga y purga al guardar: el contenido nuevo se ve al instante y el
 * resto del tiempo nadie toca el origen.
 *
 * Sin credenciales configuradas no hace nada y el sitio funciona igual; solo
 * habra que esperar a que venza la copia (o purgar a mano desde Cloudflare).
 */

const API = "https://api.cloudflare.com/client/v4";

/**
 * ¿Esta configurada la purga?
 *
 * Lo consulta el proxy para decidir cuanto puede durar la copia del borde, y
 * el panel para avisar cuando los cambios van a tardar en verse.
 */
export function isEdgePurgeConfigured() {
  return !!credentials();
}

/**
 * Lee una credencial del entorno.
 *
 * Coolify y docker-compose guardan los valores tal cual se pegaron: con
 * espacios al final o entre comillas. Un token con una comilla de mas viaja en
 * la cabecera `Authorization` y Cloudflare responde 401 sin decir por que, asi
 * que se limpia antes de usarlo.
 */
function envValue(name: string) {
  const raw = process.env[name];
  if (!raw) return undefined;

  const value = raw.trim().replace(/^["']|["']$/g, "").trim();
  return value || undefined;
}

function credentials() {
  const zone = envValue("CLOUDFLARE_ZONE_ID");
  const token = envValue("CLOUDFLARE_API_TOKEN");
  return zone && token ? { zone, token } : null;
}

/**
 * Ultimo fallo de purga, para avisarlo en el panel.
 *
 * Un 401 aca no es inofensivo: el proxy alarga la copia del borde a una hora
 * *porque* la purga esta configurada. Si Cloudflare la rechaza, los cambios del
 * panel tardan esa hora en verse y en el navegador no aparece ningun aviso; el
 * unico rastro queda en los logs del servidor.
 */
let lastError: { at: Date; detail: string } | null = null;

export function getEdgePurgeError() {
  return lastError;
}

/** Traduce la respuesta de Cloudflare a algo accionable en el panel. */
async function describeFailure(response: Response) {
  let detail = `HTTP ${response.status}`;

  try {
    const body = (await response.json()) as {
      errors?: Array<{ code?: number; message?: string }>;
    };
    const first = body.errors?.[0];
    if (first?.message) {
      detail += ` · ${first.message}${first.code ? ` (${first.code})` : ""}`;
    }
  } catch {
    // Cloudflare no siempre responde JSON (por ejemplo, ante un token vacio).
  }

  if (response.status === 401 || response.status === 403) {
    detail +=
      " · revisa CLOUDFLARE_API_TOKEN: tiene que ser un token de API (no la clave global) con el permiso Zone · Cache Purge sobre la zona de CLOUDFLARE_ZONE_ID";
  }

  return detail;
}

/**
 * Vacia el cache del borde. No se espera el resultado en la ruta del usuario:
 * si Cloudflare no responde, el guardado en el panel no tiene por que fallar.
 */
export async function purgeEdgeCache() {
  const creds = credentials();

  // Sin credenciales no hay nada que purgar, y tampoco hace falta: el proxy
  // deja la copia del borde en un minuto justamente para este caso.
  if (!creds) return;

  const { zone, token } = creds;

  try {
    const response = await fetch(`${API}/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // Se purga todo: el sitio es chico y un cambio de ajustes toca la
      // cabecera y el pie de todas las paginas a la vez.
      body: JSON.stringify({ purge_everything: true }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const detail = await describeFailure(response);
      lastError = { at: new Date(), detail };
      console.warn(`No se pudo purgar el cache de Cloudflare: ${detail}`);
      return;
    }

    lastError = null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    lastError = { at: new Date(), detail };
    console.warn("No se pudo purgar el cache de Cloudflare:", error);
  }
}
