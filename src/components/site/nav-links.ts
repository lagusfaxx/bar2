export type NavLink = {
  href: string;
  label: string;
  description?: string;
};

/** Navegación principal, compartida por la barra superior, el menú móvil y el footer. */
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Inicio", description: "Volver a la portada" },
  { href: "/eventos", label: "Cartelera", description: "Shows, tributos y fiestas" },
  { href: "/carta", label: "Carta", description: "Cervezas, cocina y para compartir" },
  { href: "/nosotros", label: "Nosotros", description: "La historia de BARZUO" },
  { href: "/galeria", label: "Galería", description: "Noches, público y ambiente" },
  { href: "/ubicacion", label: "Ubicación", description: "Cómo llegar al local" },
  { href: "/contacto", label: "Contacto", description: "Reservas y consultas" },
];

/** Enlaces del programa de fidelización. */
export const LOYALTY_LINKS: NavLink[] = [
  { href: "/barzucard", label: "BarzuCard", description: "El programa de beneficios" },
  { href: "/barzucard/promociones", label: "Promociones", description: "Beneficios vigentes" },
  { href: "/barzucard/tarjeta", label: "Mi tarjeta", description: "Tu QR y tus puntos" },
];
