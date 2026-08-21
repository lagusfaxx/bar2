<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# POS: debe ser liviano

El POS (`src/app/staff/pos`, `src/components/staff/pos`) corre en un PC básico
de barra, no en una máquina de desarrollo. El rendimiento en hardware modesto
manda por sobre cualquier otra consideración de diseño.

Reglas al tocar el POS:

- **Nada de dependencias nuevas.** Ninguna librería de UI, animación, estado o
  fechas. Lo que haga falta se escribe a mano con React y Tailwind.
- **Menos JavaScript en el cliente.** Preferir Server Components y server
  actions; marcar `"use client"` sólo en el componente hoja que realmente
  necesita interacción.
- **Sin polling agresivo.** Nada de `setInterval` de segundos ni de refetch en
  cada render. Refrescar por acción del usuario o en intervalos largos.
- **Listas acotadas.** Paginar o filtrar en el servidor; no renderizar catálogos
  completos ni tablas largas de una sola vez.
- **Animaciones mínimas.** Nada de transiciones continuas, blur, sombras
  pesadas ni efectos que obliguen a repintar. Cambios de estado instantáneos.
- **Imágenes livianas.** Tamaños chicos y explícitos; evitar cargar fotos de
  producto en grillas grandes si un texto alcanza.
- **Interacción táctil directa.** Botones grandes, sin gestos ni cálculos de
  layout en JS que corran en cada evento.

Antes de agregar una función al POS, preguntar si se puede resolver con menos
código en el cliente. Si una pantalla se siente lenta en el PC de barra, eso es
un bug, no un detalle.
