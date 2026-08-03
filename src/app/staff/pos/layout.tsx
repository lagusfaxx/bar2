/**
 * Armazon del POS.
 *
 * La pantalla mide exactamente el alto de la ventana y no desborda: dentro,
 * la cabecera y la barra de acciones son fijas y solo el centro se desplaza.
 *
 * Esto no es una preferencia estetica. En el telefono, una pagina que crece
 * hacia abajo hace que el navegador esconda y muestre su propia barra de
 * direcciones al desplazarse, y en cada cambio la ventana se redimensiona: la
 * barra de acciones salta y lo que estabas por tocar se mueve. Con el
 * desplazamiento contenido aca dentro, el navegador deja su barra quieta y
 * nada se mueve bajo el dedo.
 */
export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex h-[100dvh] flex-col overflow-hidden">{children}</div>;
}
