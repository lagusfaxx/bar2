# BARZUO — Web oficial, cartelera y CMS

Sitio público y panel administrativo de **BARZUO**, restobar de música en vivo
en Montevideo. Incluye la cartelera de eventos con calendario, la carta, la
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
9. [Despliegue en Coolify](#despliegue-en-coolify)
10. [Operación del día a día](#operación-del-día-a-día)
11. [Comandos disponibles](#comandos-disponibles)
12. [Decisiones técnicas](#decisiones-técnicas)

---

## Qué incluye

### Web pública

| Sección | Ruta | Descripción |
| --- | --- | --- |
| Portada | `/` | Hero a pantalla completa, próximo show, cartelera, nosotros, carta destacada, BarzuCard, galería y ubicación. |
| Cartelera | `/eventos` | Destacados, calendario mensual navegable, vista alternativa en lista y agenda completa. |
| Evento | `/eventos/[slug]` | Afiche, ficha (fecha, puertas, entrada, capacidad), descripción, galería, compartir, calificaciones y eventos relacionados. |
| Carta | `/carta` | Categorías con navegación pegajosa, precios y etiquetas. |
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
- **Socios y tarjetas**: búsqueda, nivel, puntos, suspensión y regeneración del QR.
- **Canjes**: historial completo con comprobante y quién validó.
- **Reseñas**: moderación de las calificaciones antes de publicarlas.
- **Mensajes**: bandeja del formulario de contacto.
- **Ajustes**: identidad, portada, nosotros, contacto, SEO, redes y horarios.
- **Usuarios**: administradores, editores y equipo de sala.

### App de sala (`/staff`)

Pensada para el teléfono, con una sola pantalla: buscar la tarjeta, ver qué
puede canjear el cliente y confirmar el canje.

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
#    Editá al menos DATABASE_URL y AUTH_SECRET.
#    Generá la clave con:  openssl rand -base64 48

# 3. Base de datos
createdb barzuo                # o la que uses en DATABASE_URL
npm run db:migrate             # crea las tablas

# 4. Contenido de demostración (opcional pero recomendado)
npm run db:seed

# 5. A correr
npm run dev
```

Abrí <http://localhost:3000>.

Accesos que crea el seed:

| Rol | Email | Contraseña | Entra por |
| --- | --- | --- | --- |
| Administrador | `admin@barzuo.com` | `Barzuo2024!` | `/admin/login` |
| Equipo de sala | `garzon@barzuo.com` | `Barzuo2024!` | `/staff/login` |
| Socio de ejemplo | `sofia@ejemplo.com` | `Barzuo2024!` | `/barzucard/ingresar` |

> Cambiá estas contraseñas antes de publicar el sitio.

### Todo con Docker

```bash
cp .env.example .env     # completá POSTGRES_PASSWORD y AUTH_SECRET
docker compose up --build
```

La primera vez, poné `SEED_ON_START=true` en el `.env` para cargar el contenido
de demostración.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL. |
| `AUTH_SECRET` | Sí | Clave de firma de sesiones. **Mínimo 32 caracteres.** Al cambiarla se cierran todas las sesiones. |
| `NEXT_PUBLIC_SITE_URL` | Sí en producción | URL pública sin barra final. Se usa en canonical, Open Graph, sitemap y en el QR de la tarjeta. |
| `NEXT_PUBLIC_TIME_ZONE` | No | Zona horaria del local. Por defecto `America/Montevideo`. |
| `NEXT_PUBLIC_CURRENCY` | No | Moneda de precios. Por defecto `UYU`. |
| `UPLOAD_DIR` | No | Carpeta de las imágenes subidas. Por defecto `storage/uploads`; en Docker, `/app/storage/uploads`. |
| `DATABASE_POOL_MAX` | No | Tamaño del pool. Por defecto 10. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | No | Primer administrador (seed y `npm run create:admin`). |
| `STAFF_EMAIL`, `STAFF_PASSWORD` | No | Cuenta del equipo de sala que crea el seed. |
| `SEED_ON_START` | No | Si es `true`, el contenedor siembra el contenido al arrancar. |

Las tres variables `NEXT_PUBLIC_*` se insertan **en tiempo de build**: si las
cambiás, hay que reconstruir la imagen.

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

docker/
  entrypoint.sh          Espera la base, migra y arranca

src/
  app/
    (public)/            Web pública
    admin/               Panel: /admin/login y grupo (panel) protegido
    staff/               App de verificación de BarzuCard
    api/health/          Health check
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
| `MenuCategory` / `MenuProduct` | Carta, con orden y disponibilidad. |
| `GalleryImage` | Galería, opcionalmente asociada a un evento. |
| `Media` | Registro de todo lo subido desde el CMS. |
| `Member` | Socios de la BarzuCard. |
| `BarzuCard` | Tarjeta: número único, token del QR, nivel y puntos. |
| `Promotion` | Beneficios y sus reglas de canje. |
| `Redemption` | Cada canje, con comprobante y quién lo validó. |
| `SiteSettings` | Fila única con todo el contenido editable del sitio. |
| `SocialLink` / `OpeningHour` | Redes y horarios. |
| `ContactMessage` | Mensajes del formulario. |
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

**Socio** (requiere sesión) — `/barzucard/tarjeta`, `/barzucard/tarjeta/imprimir`.

**Panel** (`ADMIN` o `EDITOR`) — `/admin` y sus secciones: `eventos`, `carta`,
`galeria`, `promociones`, `tarjetas`, `canjes`, `resenas`, `mensajes`,
`ajustes`, `usuarios` (solo `ADMIN`).

**Sala** (cualquier rol del panel) — `/staff`, `/staff/verificar/[token]`.

**Servicio** — `/api/health`, `/uploads/*`.

---

## Cómo funciona la BarzuCard

**Alta.** Al registrarse, el socio recibe una tarjeta con un número de 16
dígitos (prefijo `5210` + dígito verificador de Luhn, de modo que un error de
tipeo se detecta antes de consultar la base) y un token opaco para el QR.

**El QR** apunta a `/staff/verificar/<token>`. Escanearlo con la cámara del
teléfono abre la ficha del socio ya resuelta, sin depender de que el navegador
sepa leer códigos.

**Validación en el local.** El equipo de sala tiene tres caminos, en orden de
comodidad:

1. Escanear desde la propia app (donde el navegador lo permite).
2. Escanear con la cámara nativa del teléfono, que abre el enlace del QR.
3. Escribir los 16 dígitos.

La pantalla muestra las promociones que el socio **puede** canjear y, en una
sección aparte, las que no, **con el motivo** ("Ya fue canjeada con esta
tarjeta", "No disponible hoy", "Requiere BarzuCard plata"…). El canje pide una
segunda confirmación y devuelve un comprobante corto (`BZ-XXXXXX`) que queda a
la vista hasta la siguiente búsqueda.

**Reglas por promoción**: usos por tarjeta (o ilimitados), cupo total, nivel
mínimo, días habilitados, costo en puntos y puntos que otorga. Se verifican
dentro de una transacción, así que dos canjes simultáneos no pueden superar el
límite.

**Tarjetas físicas.** Desde `/barzucard/tarjeta/imprimir` el socio obtiene el
frente y el dorso en tamaño real (85,6 × 54 mm) para imprimir y plastificar. En
el panel se puede marcar una tarjeta como impresa y, si se pierde, regenerar su
QR: el plástico anterior deja de validar sin cambiar el número.

---

## Despliegue en Coolify

### 1. Crear la base de datos

En el proyecto de Coolify: **New Resource → Database → PostgreSQL 16**.
Anotá la cadena de conexión interna, del estilo:

```
postgresql://postgres:CLAVE@nombre-del-servicio:5432/postgres
```

> Si preferís que Coolify levante también la base, usá el `docker-compose.yml`
> incluido (paso 2, opción B) y salteá este paso.

### 2. Crear la aplicación

**Opción A — Dockerfile (recomendada).**
**New Resource → Application → Public/Private Repository**, elegí este
repositorio y la rama, y configurá:

- **Build Pack**: `Dockerfile`
- **Dockerfile Location**: `/Dockerfile`
- **Port**: `3000`
- **Health Check Path**: `/api/health`

**Opción B — Docker Compose.** Elegí `Docker Compose` como build pack y
`/docker-compose.yml`. Levanta la app y PostgreSQL juntos.

### 3. Variables de entorno

En **Environment Variables** cargá:

```
DATABASE_URL=postgresql://postgres:CLAVE@servicio-db:5432/postgres
AUTH_SECRET=<openssl rand -base64 48>
NEXT_PUBLIC_SITE_URL=https://barzuo.com
NEXT_PUBLIC_TIME_ZONE=America/Montevideo
NEXT_PUBLIC_CURRENCY=UYU
UPLOAD_DIR=/app/storage/uploads
ADMIN_EMAIL=hola@barzuo.com
ADMIN_PASSWORD=<una contraseña fuerte>
SEED_ON_START=true
```

Marcá como **Build Variable** las tres `NEXT_PUBLIC_*`: Next las inserta en el
bundle durante el build.

### 4. Dominio

En **Domains** poné `https://barzuo.com`. Coolify emite el certificado con
Let's Encrypt. El valor tiene que coincidir con `NEXT_PUBLIC_SITE_URL`, porque
de ahí salen las URLs canónicas, el sitemap y el QR de las tarjetas.

### 5. Almacenamiento de imágenes

**Persistent Storage → Add**:

- **Name**: `barzuo-uploads`
- **Mount Path**: `/app/storage`

Sin este volumen, las imágenes que se suban desde el CMS **se pierden en cada
redeploy**.

### 6. Deploy y migraciones

Pulsá **Deploy**. El `entrypoint.sh` del contenedor:

1. espera a que PostgreSQL acepte conexiones,
2. aplica las migraciones pendientes (`prisma migrate deploy`),
3. siembra el contenido si `SEED_ON_START=true`,
4. arranca el servidor.

No hay que correr migraciones a mano: cada deploy aplica las nuevas.

### 7. Usuario administrador

Si sembraste, ya existe con el `ADMIN_EMAIL` y `ADMIN_PASSWORD` que cargaste.
Si no, desde el terminal del contenedor en Coolify:

```bash
ADMIN_EMAIL=hola@barzuo.com ADMIN_PASSWORD='MiClave123' npx tsx scripts/create-admin.ts
```

El mismo comando **restablece la contraseña** de un administrador existente.

### 8. Después del primer deploy

1. Entrá a `/admin/login` y cambiá la contraseña en **Usuarios**.
2. Cargá el logotipo, el favicon y los textos reales en **Ajustes**.
3. Reemplazá los eventos y las fotos de demostración por los propios.
4. Poné `SEED_ON_START=false` y volvé a desplegar.

---

## Operación del día a día

**Publicar un show.** Cartelera → *Nuevo evento*. Cargá título, artista,
categoría, fecha, entrada (libre o con precio) y el afiche vertical (5:7).
Guardalo como borrador y marcá *Publicado* cuando esté listo.

**Cambiar un texto del sitio.** Ajustes, en la pestaña correspondiente. Los
cambios se ven en la web apenas guardás.

**Moderar reseñas.** Las calificaciones del público quedan pendientes hasta que
las aprobás en **Reseñas**.

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

**Caché.** Las páginas públicas se prerenderizan y se revalidan por tiempo; al
guardar en el CMS se invalidan las rutas afectadas. No se usa `unstable_cache`
en la capa de datos: al leer del caché serializa los valores y convierte los
`Date` de Prisma en strings, lo que rompía las fichas de evento.

**Zonas horarias.** Un show a las 22:30 tiene que verse a las 22:30 en
Montevideo, sin importar dónde corra el servidor. Las fechas se guardan en UTC y
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
