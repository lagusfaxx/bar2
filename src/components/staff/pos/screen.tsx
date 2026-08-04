/**
 * Armazon de las pantallas de sala.
 *
 * Mide exactamente el alto de la ventana y no desborda: dentro, la cabecera y
 * la barra de acciones quedan fijas y solo el centro se desplaza.
 *
 * No es estetica. En el telefono, una pagina que crece hacia abajo hace que el
 * navegador esconda y muestre su barra de direcciones al desplazarse, y en
 * cada cambio la ventana se redimensiona: lo que estabas por tocar se mueve.
 * Con el desplazamiento contenido aca dentro, nada se mueve bajo el dedo.
 */
export function StaffScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[100dvh] flex-col overflow-hidden">{children}</div>;
}
