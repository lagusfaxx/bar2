# BARZUO — Web oficial, cartelera y CMS

Sitio público y panel administrativo de **BARZUO**, restobar de música en vivo
en Santiago de Chile. Incluye la cartelera de eventos con calendario, la carta, la
galería, la ubicación y **BarzuCard**, el programa de fidelización con tarjeta
QR y app de verificación para el equipo de sala.

Todo el contenido se administra desde el panel: no hace falta tocar código para
cambiar un texto, subir un afiche o publicar un show.

---

## Índice

1. [Qué incluye](#qué-incluye)
2. [Stack](#stack)
3. [Puesta en marcha en local](#puesta-en-marcha-en-local)
4. [Variables de entorno](#variables-de-entorno)
5. [Estructura del proyecto](#estructura-del-proyecto)
6. [Modelo de datos](#modelo-de-datos)
7. [Rutas](#rutas)
8. [Cómo funciona la BarzuCard](#cómo-funciona-la-barzucard)
9. [POS de sala](#pos-de-sala)
10. [Despliegue en Coolify](#despliegue-en-coolify)
11. [Operación del día a día](#operación-del-día-a-día)
12. [Comandos disponibles](#comandos-disponibles)
13. [Decisiones técnicas](#decisiones-técnicas)

---

## Qué incluye

### Web pública

| Sección | Ruta | Descripción |
| --- | --- | --- |
| Portada | `/` | Hero a pantalla completa (con variante vertical para el teléfono), próximo show, cartelera, nosotros, carta destacada, BarzuCard, galería y ubicación. |
| Cartelera | `/eventos` | Destacados, calendario mensual navegable, vista alternativa en lista y agenda completa. |
| Evento | `/eventos/[slug]` | Afiche, ficha (fecha, puertas, entrada, capacidad), descripción, galería, compartir, calificaciones y eventos relacionados. |
| Carta | `/carta` | La carta completa del local. Navegación pegajosa por categorías; en móvil cada categoría se pliega para que la página no se haga interminable. |
| Nosotros | `/nosotros` | Historia, concepto, horarios y galería. |
| Galería | `/galeria` | Mosaico tipo masonry con filtros y visor a pantalla completa. |
| Ubicación | `/ubicacion` | Mapa centrado en el local, cómo llegar y datos de contacto. |
| Contacto | `/contacto` | Formulario de reservas y consultas. |
| BarzuCard | `/barzucard` | Presentación del programa, niveles y promociones vigentes. |
| Legales | `/legales` | Términos, privacidad y condiciones del programa. |

### Panel administrativo (`/admin`)

- **Cartelera**: alta, edición, borrado, publicar/despublicar, destacar, precio
  o entrada libre, afiche, SEO por evento y cierre de calificaciones.
- **Carta**: categorías y productos con reordenamiento, disponibilidad,
  destacados, imágenes y etiquetas.
- **Galería**: subida con optimización automática, orden, destacados y
  asociación a un evento.
- **Promociones**: beneficios de la BarzuCard con todas sus reglas de canje.
- **Socios y tarjetas**: búsqueda, nivel, puntos, suspensión, regeneración del
  QR y seguimiento del pago de la tarjeta física (pendiente, transferencia
  informada, pagada, entregada).
- **Canjes**: historial completo con comprobante y quién validó, más los cupones
  que los socios eligieron y todavía no se aplicaron.
- **Días cerrados**: marcar una fecha en que el local no abre al público —el
  caso típico es un evento privado— para que el calendario de la cartelera lo
  avise. Si ese día había un show publicado, el panel lo señala para cambiarlo
  de fecha o despublicarlo.
- **Reseñas**: moderación de las calificaciones antes de publicarlas.
- **Mensajes**: bandeja del formulario de contacto.
- **Ajustes**: identidad, portada (imagen horizontal, imagen vertical para el
  teléfono y video de fondo), textos de cada bloque
  del inicio, nosotros, contacto, SEO, redes, horarios y precio, datos de
  transferencia e instrucciones de retiro de la tarjeta física.
- **Usuarios**: administradores, editores y equipo de sala.

### App de sala (`/staff`)

Pensada para el teléfono. Tiene dos partes:

**BarzuCard.** Lo habitual es escanear el QR del cupón que el socio eligió: la
pantalla muestra qué descuento es, de quién y un único botón para confirmarlo.
Como respaldo se puede buscar la tarjeta por QR o por número y elegir la
promoción a mano.

**Sala (`/staff/pos`).** El POS: abrir mesas, repartir la cuenta entre los
comensales, mandar comandas a cocina y barra, y cobrar. Ver
[POS de sala](#pos-de-sala).

---

## Stack

| Pieza | Elección |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Actions) |
| Lenguaje | TypeScript en modo estricto |
| Estilos | Tailwind CSS v4 |
| Base de datos | PostgreSQL 16 |
| ORM | Prisma 7 con driver adapter `@prisma/adapter-pg` |
| Autenticación | Sesiones JWT propias (`jose`) en cookies httpOnly + `bcryptjs` |
| Imágenes | `sharp` en el servidor, `next/image` en el cliente |
| Validación | Zod, del lado del servidor |
| QR | `qrcode` |
| Despliegue | Docker multi-stage sobre la salida `standalone` |

---

## Puesta en marcha en local

Requisitos: **Node.js 22+** y **PostgreSQL 16** (o Docker).

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env
#    Edita al menos DATABASE_URL y AUTH_SECRET.
#    Genera la clave con:  openssl rand -base64 48

# 3. Base de datos
createdb barzuo                # o la que uses en DATABASE_URL
npm run db:migrate             # crea las tablas

# 4. Contenido de demostración (opcional pero recomendado)
npm run db:seed

# 5. A correr
npm run dev
```

Abre <http://localhost:3000>.

Accesos que crea el seed:

| Rol | Email | Contraseña | Entra por |
| --- | --- | --- | --- |
| Administrador | `admin@barzuo.com` | `Barzuo2024!` | `/admin/login` |
| Equipo de sala | `sala@barzuo.com` | `Barzuo2024!` | `/staff/login` |
| Socio de ejemplo | `sofia@ejemplo.com` | `Barzuo2024!` | `/barzucard/ingresar` |

> Cambia estas contraseñas antes de publicar el sitio.

### Todo con Docker

```bash
cp .env.example .env     # completa POSTGRES_PASSWORD y AUTH_SECRET
docker compose up --build
```

La primera vez, pon `SEED_ON_START=true` en el `.env` para cargar el contenido
de demostración.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. |
| `AUTH_SECRET` | Sí | Clave de firma de sesiones. **Mínimo 32 caracteres.** Al cambiarla se cierran todas las sesiones. |
| `NEXT_PUBLIC_SITE_URL` | Sí en producción | URL pública sin barra final. Se usa en canonical, Open Graph, sitemap y en el QR de la tarjeta. |
| `NEXT_PUBLIC_TIME_ZONE` | No | Zona horaria del local. Por defecto `America/Santiago`. |
| `NEXT_PUBLIC_CURRENCY` | No | Moneda de precios. Por defecto `CLP`. |
| `UPLOAD_DIR` | No | Carpeta de las imágenes subidas. Por defecto `storage/uploads`; en Docker, `/app/storage/uploads`. |
| `DATABASE_POOL_MAX` | No | Tamaño del pool. Por defecto 10. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | No | Primer administrador (seed y `npm run create:admin`). |
| `STAFF_EMAIL`, `STAFF_PASSWORD` | No | Cuenta del equipo de sala que crea el seed. |
| `SEED_ON_START` | No | Si es `true`, el contenedor siembra el contenido de demostración al arrancar. No hace nada si la base ya tiene contenido. |
| `SEED_FORCE` | No | Si es `true`, el seed vuelve a sembrar aunque la base ya tenga contenido. **Devuelve la portada a la demo**: úsala solo a propósito. |
| `PRINT_AGENT_TOKEN` | Para el POS | Clave compartida con el agente de impresión del local. Mínimo 16 caracteres. Sin ella, la cola de comandas queda cerrada. |
| `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` | No | Si están, el HTML público se guarda una hora en el borde y al guardar en el panel se purga solo: el cambio se ve al instante. Sin ellas la copia dura un minuto, así que los cambios tardan como mucho eso. |

Las tres variables `NEXT_PUBLIC_*` se insertan **en tiempo de build**: si las
cambias, hay que reconstruir la imagen.

---

## Estructura del proyecto

```
prisma/
  schema.prisma          Modelo de datos
  migrations/            Migraciones versionadas
  seed.ts                Contenido de demostración (idempotente)

scripts/
  create-admin.ts        Crea o restablece un administrador
  generate-artwork.mjs   Genera la imaginería de demostración
  print-agent.mjs        Agente de impresión de comandas (corre en el local)

docker/
  entrypoint.sh          Espera la base, migra y arranca

src/
  app/
    (public)/            Web pública
    admin/               Panel: /admin/login y grupo (panel) protegido
    staff/               App de sala: BarzuCard y POS
    api/health/          Health check
    api/pos/comandas/    Cola de comandas para el agente de impresión
    uploads/[...path]/   Sirve las imágenes del volumen
    actions/             Server Actions (públicas, auth y de admin)
    sitemap.ts robots.ts icon.tsx
  components/
    brand/ site/ ui/     Logotipo, cabecera, pie y primitivas de diseño
    events/ menu/ gallery/ barzucard/ staff/ admin/
  lib/
    prisma.ts            Cliente único con driver adapter
    auth.ts              Sesiones, hashing y guardas por rol
    barzucard.ts         Numeración, QR y reglas de canje
    content.ts           Consultas del contenido público
    cache.ts             Invalidación tras guardar en el CMS
    uploads.ts           Procesado y guardado de imágenes
    pos.ts               Precios vigentes, cuentas y estado de las mesas
    validation.ts        Esquemas Zod
    format.ts            Fechas, precios y etiquetas en español
  proxy.ts               Protección de rutas (antes "middleware")
```

---

## Modelo de datos

| Entidad | Para qué |
| --- | --- |
| `User` | Cuentas del panel. Roles `ADMIN`, `EDITOR` y `STAFF`. |
| `Event` | Cartelera: fecha, puertas, entrada libre o con precio, afiche, SEO. |
| `EventRating` | Calificaciones del público, moderadas antes de publicarse. |
| `MenuCategory` / `MenuProduct` | Carta, con orden, disponibilidad, precio promocional y estación de impresión. |
| `GalleryImage` | Galería, opcionalmente asociada a un evento. |
| `Media` | Registro de todo lo subido desde el CMS. |
| `Member` | Socios de la BarzuCard. |
| `BarzuCard` | Tarjeta: número único, token del QR, nivel y puntos. |
| `Promotion` | Beneficios y sus reglas de canje. |
| `Redemption` | Cada canje, con comprobante y quién lo validó. |
| `PromotionVoucher` | Cupón del descuento que eligió el socio: código, QR propio y vigencia. |
| `SiteSettings` | Fila única con todo el contenido editable del sitio. |
| `SocialLink` / `OpeningHour` | Redes y horarios. |
| `ContactMessage` | Mensajes del formulario. |
| `PosTable` | Mesas del salón. |
| `TableSession` | Un turno de mesa: desde que se sientan hasta que se van. |
| `Diner` | Un comensal, identificado por cómo se ve ("polera azul"). |
| `OrderItem` | Una línea de la cuenta, con copia del nombre y el precio del momento. |
| `OrderTicket` | Una comanda: su estado de impresión y el de preparación en la pantalla de la estación. |
| `Payment` | Un cobro: de un comensal o de la mesa entera. |
| `AuditLog` | Historial de cambios del panel. |

Los precios se guardan en **centésimos** (`Int`) para no arrastrar errores de
coma flotante, y las fechas en **UTC**, convirtiéndose a la hora del local al
mostrarlas y al cargarlas desde el panel.

---

## Rutas

**Públicas** — `/`, `/eventos`, `/eventos/[slug]`, `/carta`, `/nosotros`,
`/galeria`, `/ubicacion`, `/contacto`, `/legales`, `/barzucard`,
`/barzucard/registro`, `/barzucard/ingresar`, `/barzucard/promociones`,
`/sitemap.xml`, `/robots.txt`.

**Socio** (requiere sesión) — `/barzucard/tarjeta`, `/barzucard/tarjeta/imprimir`,
`/barzucard/canje/[codigo]`.

**Panel** (`ADMIN` o `EDITOR`) — `/admin` y sus secciones: `eventos`, `carta`,
`galeria`, `promociones`, `tarjetas`, `canjes`, `resenas`, `mensajes`,
`ajustes`, `usuarios` (solo `ADMIN`).

**Sala** (cualquier rol del panel) — `/staff`, `/staff/verificar/[token]`,
`/staff/canjear/[token]`, `/staff/pos`, `/staff/pos/[sessionId]`,
`/staff/cocina`, `/staff/barra`.

**Servicio** — `/api/health`, `/uploads/*`, `/api/pos/comandas` (agente de
impresión, autenticado con `PRINT_AGENT_TOKEN`).

---

## Cómo funciona la BarzuCard

**Alta.** Al registrarse, el socio recibe una tarjeta con un número de 16
dígitos (prefijo `5210` + dígito verificador de Luhn, de modo que un error de
tipeo se detecta antes de consultar la base) y un token opaco para el QR.

**El QR de la tarjeta** apunta a `/staff/verificar/<token>`. Escanearlo con la
cámara del teléfono abre la ficha del socio ya resuelta, sin depender de que el
navegador sepa leer códigos.

### El socio elige su descuento (camino principal)

La tarjeta dice **quién** es el socio; no dice **qué** quiere canjear. Por eso
el descuento tiene su propio QR:

1. El socio entra a su BarzuCard (`/barzucard/tarjeta` o
   `/barzucard/promociones`), ve solo los beneficios que puede usar hoy y toca
   **"Quiero este descuento"**.
2. Se emite un **cupón** con código legible (`BZD-XXXXXX`), token propio y
   **30 minutos de vigencia**, y se abre `/barzucard/canje/<código>`: una
   pantalla con el QR **de ese descuento**, la cuenta atrás y las condiciones.
3. El equipo de sala escanea ese QR y cae directo en
   `/staff/canjear/<token>`, con la promoción y el socio ya resueltos. Solo
   confirma.

Si el socio pide dos veces el mismo descuento y el cupón sigue vigente, se le
devuelve el mismo: dos QR para lo mismo solo confunden en la barra. Puede
cancelarlo cuando quiera y los cupones sin usar vencen solos. En el panel,
`/admin/canjes` lista los cupones abiertos.

### Validación por tarjeta (respaldo)

Sigue disponible para la tarjeta física, el socio que no usa la web o el cupón
vencido. El equipo de sala tiene tres caminos, en orden de comodidad:

1. Escanear desde la propia app (donde el navegador lo permite).
2. Escanear con la cámara nativa del teléfono, que abre el enlace del QR.
3. Escribir los 16 dígitos — o el código `BZD-XXXXXX` de un cupón, que también
   deriva a la pantalla de ese descuento.

La pantalla muestra las promociones que el socio **puede** canjear y, en una
sección aparte, las que no, **con el motivo** ("Ya fue canjeada con esta
tarjeta", "No disponible hoy", "Requiere BarzuCard plata"…).

En ambos caminos el canje pide una segunda confirmación y devuelve un
comprobante corto (`BZ-XXXXXX`) que queda a la vista.

**Reglas por promoción**: usos por tarjeta (o ilimitados), cupo total, nivel
mínimo, días habilitados, costo en puntos y puntos que otorga. Se verifican
dentro de una transacción, así que dos canjes simultáneos no pueden superar el
límite.

**Tarjetas físicas.** Desde `/barzucard/tarjeta/imprimir` el socio obtiene el
frente y el dorso en tamaño real (85,6 × 54 mm) para imprimir y plastificar. En
el panel se puede marcar una tarjeta como impresa y, si se pierde, regenerar su
QR: el plástico anterior deja de validar sin cambiar el número.

---

## POS de sala

El sistema con el que los garzones toman los pedidos, desde su propio teléfono.
Vive en `/staff/pos` y entra cualquier usuario del panel.

### El servicio, de principio a fin

1. **Abrir mesa.** Se toca una mesa libre y se indica cuánta gente se sentó.
2. **Identificar a los comensales.** Se describen por cómo se ven —"polera
   azul", "pelo largo"—, no por su nombre: es lo que sirve de verdad en una
   mesa de desconocidos. Cada uno tiene su pestaña; lo que se pide para
   compartir va a la cuenta de la mesa.
3. **Cargar productos.** Se buscan en la misma carta que publica la web. Un
   producto nuevo aparece solo, y uno agotado desaparece de las dos partes a
   la vez. Si tiene precio promocional vigente, se aplica sin que nadie haga
   nada.
4. **Mandar la comanda.** Se arma una por estación: la comida va a cocina y los
   tragos, cervezas y jugos a barra. Cada comanda va agrupada por comensal,
   para que la barra arme los tragos separados. Sale por la impresora, por la
   pantalla de la estación, o por las dos.
5. **Cobrar.** La mesa entera de una vez, o cada comensal por separado. Cobrar
   a uno **no cierra la mesa**: los demás siguen consumiendo, y quien ya pagó
   puede volver a pedir y se le hace otro cobro.
6. **Cerrar la mesa** cuando no queda nada pendiente, y queda libre.

Al cobrar se puede ingresar el número de una BarzuCard: suma **1 punto por
cada $1.000** de consumo y recalcula el nivel del socio.

No hay campo de propina: la deja el cliente en la terminal de cobro.

### Pensado para un local lleno

- **Los de siempre.** Lo primero que se ve al cargar un pedido son los doce
  productos más vendidos de las últimas dos semanas, en rejilla y a un toque.
  El grueso del servicio sale de ahí, sin buscar ni desplazarse.
- **Abrir y cargar de una.** Al abrir una mesa se entra directo al selector de
  productos.
- **Sin ruido.** Las pestañas por comensal solo aparecen cuando la cuenta está
  dividida. Una mesa normal —que son casi todas— se ve como una sola lista.

### Notas de los pedidos

"Sin lechuga", "bien cocido", "sin hielo". Se ponen desde botones, no
escribiendo: con el local lleno, teclear en un teléfono es lo primero que el
garzón deja de hacer. Se pueden acumular varias y queda un campo libre para lo
que no está en la lista.

Se agrega justo después de cargar el producto —cuando el garzón todavía la
tiene fresca— o después, desde la línea de la cuenta. Se admite incluso sobre
una línea ya comandada: si la cocina no la empezó, avisar es mejor que anular y
volver a pedir.

La nota sale **destacada** en la comanda impresa y en la pantalla de la
estación: es lo que se pasa por alto y hace volver el plato.

### Pantallas de cocina y barra

`/staff/cocina` y `/staff/barra`. Pensadas para dejar una tablet o un monitor
encendido: se actualizan solas cada diez segundos y no hay que tocarlas.

Tres columnas —**nuevas**, **en preparación**, **listas**— con un botón por
comanda para avanzarla, y otro para volver atrás cuando alguien toca la de al
lado. El tiempo de espera de cada comanda pasa a rojo a los diez minutos.

Las comandas listas se quedan un rato a la vista y después desaparecen solas:
nadie tiene que limpiar la pantalla.

Funcionan **con o sin impresoras**. Un local puede trabajar solo con pantallas,
solo con papel, o con las dos cosas a la vez: son estados independientes.

### Adónde sale cada cosa

El ruteo se define **por categoría** de la carta (Panel → Carta → categoría →
*Sale por la impresora de*). Cada producto puede desviarse de su categoría para
las excepciones: el café que sale de cocina, el postre helado que arma la barra.

### Impresión

La web corre en un servidor de internet y las impresoras están en la red del
local, detrás del router: **el servidor no puede alcanzarlas**. Por eso las
comandas se guardan en cola y un agente que corre *dentro del bar* las retira.

Efecto secundario buscado: si se corta internet, se acaba el papel o alguien
apaga la impresora, la comanda queda pendiente y se reintenta. No se pierde un
pedido.

**Qué hace falta**: impresoras térmicas que hablen ESC/POS (Epson TM-T20,
Xprinter y similares), por USB o por red, y un equipo encendido en el local —
el PC de la pantalla táctil, un PC de caja o una Raspberry Pi con Node 18+.

#### Qué se imprime

Cada envío de una mesa saca **dos comandas separadas**: una con los
bebestibles para la barra y otra con los alimentos para la cocina. Si la mesa
pidió solo de una de las dos, sale solo ese papel. Al cobrar —la mesa completa
o la cuenta de una sola persona— sale además el **resumen del cobro**, con el
detalle, el total, la forma de pago y el número de comprobante.

Los tres salen diferenciados a propósito, porque con una sola impresora caen
por la misma ranura: cada uno lleva una banda negra con su destino en letra
doble y una textura propia alrededor (`#` cocina, `*` barra, `$` cobro), que
se reconocen sin leer y aunque el papel quede boca abajo.

#### Con una sola impresora

Es el caso más común al empezar: una térmica colgada del USB del PC de la
pantalla táctil. Todo sale por ahí.

```bash
# En el PC de la pantalla táctil, con la impresora en el USB
BARZUO_URL=https://barzuo.com \
PRINT_AGENT_TOKEN=el-mismo-token-del-servidor \
PRINTER_DEFAULT=/dev/usb/lp0 \
npm run print:agent
```

En **Windows** no hay una ruta de dispositivo que sirva: comparte la impresora
(clic derecho → *Propiedades de impresora* → *Compartir*, con un nombre sin
espacios) y apunta al recurso compartido:

```bash
PRINTER_DEFAULT=\\localhost\POS80
```

#### Cuando lleguen las demás

Basta con nombrarlas. Lo que tenga la suya deja de usar `PRINTER_DEFAULT`, que
sigue atendiendo al resto:

```bash
PRINTER_DEFAULT=/dev/usb/lp0 \
PRINTER_COCINA=192.168.1.50 \
PRINTER_BARRA=192.168.1.51 \
npm run print:agent
```

Antes del primer servicio, para dejar las impresoras a punto:

```bash
npm run print:agent -- --test          # imprime los tres papeles de prueba
npm run print:agent -- --test=render   # los muestra en pantalla, sin gastar papel
```

La prueba imprime los tres seguidos justamente para lo que importa: comprobar
con los papeles en la mano que se distinguen entre sí, antes del servicio y no
en medio de él.

| Variable | Descripción |
| --- | --- |
| `BARZUO_URL` | URL pública del sitio. |
| `PRINT_AGENT_TOKEN` | El mismo valor que en el servidor. |
| `PRINTER_DEFAULT` | La impresora que recibe todo lo que no tenga una propia. Con una sola impresora, es la única que hace falta. |
| `PRINTER_COCINA` / `PRINTER_BARRA` / `PRINTER_CAJA` | Opcionales, para cuando cada destino tenga la suya. |
| `PRINT_POLL_MS` | Cada cuánto consulta la cola. Por defecto 4000. |
| `PRINT_WIDTH` | Ancho del papel en caracteres: 48 para 80 mm, 32 para 58 mm. |

Cada impresora se indica como **ruta** si está por USB (`/dev/usb/lp0`,
`\\localhost\POS80`) o como **dirección de red** si es de red (`192.168.1.50`
o `192.168.1.50:9100`; el puerto por defecto es el 9100). El agente lo deduce:
si lleva una barra, es una ruta.

Conviene dejarlo como servicio del sistema (`systemd`, `pm2`) para que arranque
solo cuando se enciende el equipo.

### Antes de usarlo

1. **Crea las mesas** en Panel → Sala → Mesas. Con el salón vacío hay un atajo
   para crearlas todas de una vez.
2. **Revisa la estación de cada categoría**: la migración deja en barra las
   categorías de trago de la carta y el resto en cocina.
3. **Configura `PRINT_AGENT_TOKEN`** en el servidor y levanta el agente.

El cierre del día está en Panel → Sala → Caja: lo vendido, cómo pagaron, cuánto
se fue en promociones, los más vendidos y las mesas que siguen abiertas.

---

## Despliegue en Coolify

### 1. Crear la base de datos

En el proyecto de Coolify: **New Resource → Database → PostgreSQL 16**.
Anota la cadena de conexión interna, del estilo:

```
postgresql://postgres:CLAVE@nombre-del-servicio:5432/postgres
```

> Si prefieres que Coolify levante también la base, usa el `docker-compose.yml`
> incluido (paso 2, opción B) y sáltate este paso.

> ⚠️ **No cambies de Dockerfile a Docker Compose en un recurso que ya está en
> producción.** El compose trae su propia base de datos y sus propios
> volúmenes: al aplicarlo, Coolify levantaría un PostgreSQL nuevo y vacío y
> montaría volúmenes nuevos, así que la web aparecería sin contenido y sin las
> imágenes subidas. Los datos anteriores no se borran —siguen en la base y los
> volúmenes viejos— pero el sitio deja de verlos. Las dos opciones se eligen al
> crear el recurso, no se migran.

### 2. Crear la aplicación

**Opción A — Dockerfile (recomendada).**
**New Resource → Application → Public/Private Repository**, elige este
repositorio y la rama, y configura:

- **Build Pack**: `Dockerfile`
- **Dockerfile Location**: `/Dockerfile`
- **Port**: `3000`
- **Health Check Path**: `/api/health`

**Opción B — Docker Compose.** Elige `Docker Compose` como build pack y
`/docker-compose.yml`. Levanta la app y PostgreSQL juntos.

### 3. Variables de entorno

En **Environment Variables** carga:

```
DATABASE_URL=postgresql://postgres:CLAVE@servicio-db:5432/postgres
AUTH_SECRET=<openssl rand -base64 48>
NEXT_PUBLIC_SITE_URL=https://barzuo.com
NEXT_PUBLIC_TIME_ZONE=America/Santiago
NEXT_PUBLIC_CURRENCY=CLP
UPLOAD_DIR=/app/storage/uploads
ADMIN_EMAIL=hola@barzuo.com
ADMIN_PASSWORD=<una contraseña fuerte>
SEED_ON_START=true
```

Marca como **Build Variable** las tres `NEXT_PUBLIC_*`: Next las inserta en el
bundle durante el build.

### 4. Dominio

En **Domains** pon `https://barzuo.com`. Coolify emite el certificado con
Let's Encrypt. El valor tiene que coincidir con `NEXT_PUBLIC_SITE_URL`, porque
de ahí salen las URLs canónicas, el sitemap y el QR de las tarjetas.

#### Sin dominio todavía: usar sslip.io

`sslip.io` resuelve cualquier subdominio a la IP que lleva en el nombre, así
que sirve para publicar antes de comprar el dominio. Si el servidor está en
`203.0.113.45`:

```
Domains:              https://barzuo.203.0.113.45.sslip.io
NEXT_PUBLIC_SITE_URL: https://barzuo.203.0.113.45.sslip.io
```

Los dos valores tienen que ser idénticos, incluido el `https://`.

**Usa HTTPS.** Las cookies de sesión se marcan `secure` cuando el sitio se
sirve por HTTPS, que es lo correcto. Si Let's Encrypt no llega a emitir el
certificado y quedas en `http://`, pon también `NEXT_PUBLIC_SITE_URL` con
`http://`: la app detecta el esquema y emite las cookies sin `secure`, porque
de lo contrario el navegador las descarta y el login del panel falla sin
mostrar ningún error.

#### Cuando llegue el dominio definitivo

1. Agrega el dominio real en **Domains** (puedes dejar el de sslip.io mientras
   propaga el DNS).
2. Cambia `NEXT_PUBLIC_SITE_URL` al dominio nuevo.
3. **Vuelve a desplegar.** Esa variable se inserta en tiempo de build: sin un build
   nuevo, el sitemap, las URLs canónicas y los QR siguen apuntando a la
   dirección vieja.

> No imprimas las tarjetas físicas hasta tener el dominio definitivo: el QR
> apunta a la URL del sitio. Si igual imprimes antes, las tarjetas siguen
> sirviendo — el equipo de sala las valida por los 16 dígitos, que no cambian —
> pero el QR impreso deja de abrir la ficha.

### 5. Almacenamiento de imágenes

**Persistent Storage → Add**, dos volúmenes:

| Name | Mount Path | Para qué |
| --- | --- | --- |
| `barzuo-uploads` | `/app/storage` | Las imágenes que se suben desde el CMS. |
| `barzuo-image-cache` | `/app/.next/cache` | Las versiones ya optimizadas de esas imágenes. |

Sin el primero, lo que se suba desde el CMS **se pierde en cada redeploy**.

El segundo no es imprescindible pero se nota: Next reescala y reencoda cada
imagen la primera vez que alguien la pide. Sin volumen, ese trabajo vuelve a
cero después de publicar, así que la primera visita espera a que se procese
toda la portada y el servidor se lleva ese golpe entero. Con el volumen, se
hace una vez y ya.

> No cambies el **Name** de un volumen una vez creado: renombrarlo hace que
> Coolify monte uno nuevo y vacío, y el anterior queda huérfano.

### 6. Cache en Cloudflare (importante)

Cloudflare cachea **por extensión de archivo**. Con la configuración por
defecto guarda los `.js` y `.css`, pero **no el HTML ni las imágenes
optimizadas**, porque `/_next/image?url=…` no termina en `.jpg`.

Medido contra producción, la diferencia es toda la historia:

| Recurso | Estado en Cloudflare | TTFB |
| --- | --- | --- |
| `/_next/static/…css` | `HIT` (desde el borde) | **0,23 s** |
| `/` (el HTML) | `DYNAMIC` (va al servidor) | 1,03 s |
| `/carta` | `DYNAMIC` | 0,35 s |
| `/_next/image?…` | `DYNAMIC` | ~1,0 s |

La portada tiene 19 imágenes. Sin esta regla, cada visita hace 19 viajes hasta
el servidor de origen, más el del HTML. Desde un teléfono en Chile, con el
origen lejos, ahí se van varios segundos.

**Caching → Cache Rules → Create rule**

- **If**: `Hostname equals barzuo.cl`
  **AND** `URI Path does not start with` `/admin`
  **AND** `URI Path does not start with` `/staff`
  **AND** `URI Path does not start with` `/api`
  **AND** `URI Path does not start with` `/barzucard`
- **Then**: *Eligible for cache* → **Edge TTL: Use cache-control header**

Eso cubre el HTML —que ya viaja con `s-maxage=60`— y las imágenes de
`/_next/image`, que llevan un año de caché por su nombre con hash.

**La copia dura una hora a propósito.** Con un minuto, un sitio con poco
tráfico casi nunca la encuentra vigente: cada visita cae justo después de que
venció y espera el viaje entero al servidor, que es lo que se quería evitar.
Y `stale-while-revalidate` no rescata a ese visitante, porque Cloudflare solo
lo respeta en el plan Enterprise.

Para que los cambios del panel se sigan viendo al instante, configura
`CLOUDFLARE_ZONE_ID` y `CLOUDFLARE_API_TOKEN`: al guardar, la app purga el
caché sola. El token se crea en **My Profile → API Tokens** con el permiso
*Zone → Cache Purge → Purge*.

Sin esas variables el sitio funciona igual: la app se da cuenta de que no
puede purgar y acorta la copia del borde a un minuto, de modo que un cambio
del panel tarda como mucho ese minuto en verse. Se pierde algo de caché a
cambio de que el panel no parezca roto; el propio panel lo avisa en su
pantalla de inicio. La decisión se toma al arrancar, en `src/proxy.ts`.

> **Nunca** incluyas `/admin`, `/staff`, `/barzucard` ni `/api`: leen cookies
> de sesión y cachearlas mostraría la sesión de una persona a otra. Por eso la
> regla las excluye explícitamente.

### 7. Deploy y migraciones

Pulsa **Deploy**. El `entrypoint.sh` del contenedor:

1. espera a que PostgreSQL acepte conexiones,
2. aplica las migraciones pendientes (`prisma migrate deploy`),
3. siembra el contenido si `SEED_ON_START=true`,
4. arranca el servidor.

No hay que correr migraciones a mano: cada deploy aplica las nuevas.

### 8. Usuario administrador

Si sembraste, ya existe con el `ADMIN_EMAIL` y `ADMIN_PASSWORD` que cargaste.
Si no, desde el terminal del contenedor en Coolify:

```bash
ADMIN_EMAIL=hola@barzuo.com ADMIN_PASSWORD='MiClave123' npx tsx scripts/create-admin.ts
```

El mismo comando **restablece la contraseña** de un administrador existente.

### 9. Después del primer deploy

1. Entra a `/admin/login` y cambia la contraseña en **Usuarios**.
2. Carga el logotipo, el favicon y los textos reales en **Ajustes**.
3. Reemplaza los eventos y las fotos de demostración por los propios.
4. Pon `SEED_ON_START=false` y vuelve a desplegar.

> El seed no vuelve a sembrar sobre una base con contenido, así que dejar
> `SEED_ON_START=true` por olvido ya no borra nada. Lo que sí lo haría es
> `SEED_FORCE=true`: no la dejes puesta.

---

## Operación del día a día

**Publicar un show.** Cartelera → *Nuevo evento*. Carga título, artista,
categoría, fecha, entrada (libre o con precio) y el afiche vertical (5:7).
Guardalo como borrador y marca *Publicado* cuando esté listo.

**Cambiar un texto del sitio.** Ajustes, en la pestaña correspondiente. Los
cambios se ven en la web apenas guardas.

**Moderar reseñas.** Las calificaciones del público quedan pendientes hasta que
las apruebas en **Reseñas**.

**Cuentas del equipo.** En **Usuarios**: `EDITOR` para quien gestiona contenido
y `STAFF` para el personal de sala, que solo entra a la app de BarzuCard.

---

## Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Genera el cliente de Prisma y compila para producción. |
| `npm start` | Sirve la build de producción. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript sin emitir. |
| `npm run db:migrate` | Crea y aplica una migración en desarrollo. |
| `npm run db:deploy` | Aplica migraciones en producción. |
| `npm run db:seed` | Carga el contenido de demostración. |
| `npm run db:reset` | Borra la base, migra y siembra de nuevo. |
| `npm run db:studio` | Prisma Studio. |
| `npm run create:admin` | Crea o restablece un administrador. |
| `npm run artwork` | Regenera la imaginería de demostración. |
| `npm run print:agent` | Agente de impresión de comandas (se ejecuta en el local). |
| `npm run print:agent -- --test` | Manda una comanda de prueba a las impresoras. |
| `npm run print:agent -- --test=render` | Muestra esa comanda en pantalla, sin imprimir. |

---

## Decisiones técnicas

**Identidad visual.** La paleta sale del logotipo: negro profundo, carmesí y
blanco hueso. El logotipo del sitio es tipográfico —la "Z" en hueso sobre el
resto en carmesí—, así que escala sin perder nitidez; si se sube un archivo en
Ajustes, lo reemplaza. Sobre eso, una serif de alto contraste para los títulos y
una display de estilo western para los acentos, con grano de película y
viñeteado para que no se sienta plano.

**Imaginería de demostración.** En lugar de depender de un banco de imágenes,
`scripts/generate-artwork.mjs` compone atmósferas nocturnas con sharp (focos de
escenario, humo, siluetas y bokeh). Son archivos reales y deterministas, y se
reemplazan por fotos del local desde el CMS.

**Caché.** El sitio se renderiza en cada petición (`export const dynamic =
"force-dynamic"` en el layout raíz). Todo el contenido —incluida la marca del
layout— vive en la base, y la imagen Docker se construye en una red donde
PostgreSQL no es alcanzable, así que prerenderizar en el build rompía el
`docker build`. Al servirse en caliente contra la base local, además, lo que se
guarda en el CMS aparece al instante. No se usa `unstable_cache` en la capa de
datos: al leer del caché serializa los valores y convierte los `Date` de Prisma
en strings, lo que rompía las fichas de evento.

**Zonas horarias.** Un show a las 22:30 tiene que verse a las 22:30 en
Santiago, sin importar dónde corra el servidor. Las fechas se guardan en UTC y
se convierten a la hora del local tanto al mostrarlas como al cargarlas desde el
panel.

**Seguridad.** Contraseñas con bcrypt (coste 12); sesiones firmadas en cookies
httpOnly, separadas para el panel y para los socios; el `proxy.ts` hace una
comprobación optimista y la verificación real —firma, cuenta activa y rol— vive
en el layout de cada área y en cada Server Action, que es donde importa, porque
las acciones son invocables por POST directo. Validación con Zod siempre del
lado del servidor, límite de peticiones en login, registro, contacto y canjes, y
campo trampa en los formularios públicos.

**Subidas.** Las imágenes no van a `public/`: en producción la app corre desde
la salida `standalone`, donde `public/` se sirve según un listado hecho en el
build. Van a un volumen propio y se sirven por `/uploads/*`, normalizadas a WebP
y con nombre con hash para poder cachearlas de forma indefinida.

**Accesibilidad.** Navegación por teclado con foco visible, textos alternativos
obligatorios en la galería, objetivos táctiles de 44 px en el calendario y la
app de sala, `prefers-reduced-motion` respetado y estados de formulario
anunciados a lectores de pantalla.

### Aviso conocido del build

El build muestra `Encountered unexpected file in NFT list` apuntando a
`src/lib/uploads.ts`. Es consecuencia de que la carpeta de subidas sea
configurable por variable de entorno: el rastreo de dependencias no puede
acotarla y termina copiando el código fuente dentro de la salida `standalone`.
No afecta al funcionamiento; solo agrega unos megabytes a la imagen.

---

## Licencia

Proyecto desarrollado para BARZUO. Todos los derechos reservados.
