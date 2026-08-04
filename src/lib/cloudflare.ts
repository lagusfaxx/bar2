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
 * Vacia el cache del borde. No se espera el resultado en la ruta del usuario:
 * si Cloudflare no responde, el guardado en el panel no tiene por que fallar.
 */
export async function purgeEdgeCache() {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!zone || !token) return;

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
      console.warn(
        `No se pudo purgar el cache de Cloudflare: ${response.status}`,
      );
    }
  } catch (error) {
    console.warn("No se pudo purgar el cache de Cloudflare:", error);
  }
}
