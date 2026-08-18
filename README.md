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
10. [El servicio en vivo](#el-servicio-en-vivo)
11. [Karaoke](#karaoke)
12. [Despliegue en Coolify](#despliegue-en-coolify)
13. [Operación del día a día](#operación-del-día-a-día)
14. [Comandos disponibles](#comandos-disponibles)
15. [Decisiones técnicas](#decisiones-técnicas)

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

**El servicio en vivo (`/admin/en-vivo`).** Cómo va la noche mientras pasa:
demoras, ventas, ocupación y avisos de lo que hay que ir a resolver. Ver
[El servicio en vivo](#el-servicio-en-vivo).

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
  caso típico es un evento privado—. El calendario de la cartelera lo avisa, y
  si además se publica un show para esa fecha, el afiche se sigue viendo con
  una banda de «Evento privado» cruzada encima: quien lo mira entiende que no
  se entra comprando entrada, y de paso se entera de que el local se arrienda.
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
comensales, mandar comandas a cocina y barra, retirarlas cuando están listas y
cobrar. Ver [POS de sala](#pos-de-sala).

**Karaoke (`/staff/karaoke`).** La cola de la noche, la pantalla que se
proyecta y los pedidos que llegan desde el QR de cada mesa. Ver
[Karaoke](#karaoke).

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
| `YOUTUBE_API_KEY` | Para el karaoke | Clave de la YouTube Data API v3. Sin ella el karaoke funciona igual, pero solo con el catálogo que el local ya tenga cargado. |
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
`/karaoke` (el QR de las mesas; sin indexar), `/sitemap.xml`, `/robots.txt`.

**Socio** (requiere sesión) — `/barzucard/tarjeta`, `/barzucard/tarjeta/imprimir`,
`/barzucard/canje/[codigo]`.

**Panel** (`ADMIN` o `EDITOR`) — `/admin` y sus secciones: `en-vivo`, `eventos`,
`carta`, `galeria`, `promociones`, `tarjetas`, `canjes`, `resenas`, `mensajes`,
`ajustes`, `usuarios` (solo `ADMIN`).

**Sala** (cualquier rol del panel) — `/staff`, `/staff/verificar/[token]`,
`/staff/canjear/[token]`, `/staff/pos`, `/staff/pos/[sessionId]`,
`/staff/cocina`, `/staff/barra`, `/staff/karaoke`, `/staff/karaoke/pantalla`,
`/staff/karaoke/qr`.

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
5. **Retirar.** Cocina o barra tocan la campana cuando está listo. El garzón va
   a buscarlo y marca **"Ya la retiré"** en la cuenta de la mesa: con eso la
   comanda sale de la pantalla de la estación, que nadie ahí puede tocar.
6. **Cobrar.** La mesa entera de una vez, o cada comensal por separado. Cobrar
   a uno **no cierra la mesa**: los demás siguen consumiendo, y quien ya pagó
   puede volver a pedir y se le hace otro cobro.
7. **Cerrar la mesa** cuando no queda nada por cobrar, y queda libre. Una mesa
   abierta por error, sin nada cargado, se cierra igual: no hay que inventarle
   un consumo.

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

### Pantallas táctiles con una franja ciega

Algunos monitores táctiles no registran el tacto en una franja del borde
superior. Usados a pantalla completa —que es como se usan en el mostrador— la
cabecera de sala cae justo ahí y el botón de volver deja de existir para el
dedo.

En ese equipo, abre la sala una vez con el alto de la franja en píxeles:

```
https://barzuo.cl/staff/pos?zonamuerta=80
```

Queda guardado en ese navegador y baja todas las cabeceras de sala (mesas,
cuenta, cocina, barra, karaoke). Se ajusta reabriendo con otro número y se
quita con `?zonamuerta=0`.

Es una medida **de ese monitor**, no del sitio, y por eso vive en el equipo y
no en los ajustes del panel: los teléfonos de los garzones no tienen nada que
compensar y no se ven afectados.

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

`/staff/cocina` y `/staff/barra`. Una tablet o un monitor colgado, encendido
toda la noche.

**No tienen un solo botón, y es a propósito.** Quien cocina tiene las manos
mojadas o con grasa y no las va a secar para tocar una pantalla. La versión
anterior pedía dos toques por comanda —"empezar" y "listo"— que en la práctica
no daba nadie, así que el tablero mostraba un estado que no era cierto.

Lo que muestran es lo que sirve de verdad:

- La lista de **lo que falta preparar**, la más vieja arriba y en grande.
- El **tiempo de espera** de cada comanda, del tamaño del número de mesa: ámbar
  a los 8 minutos, rojo a los 15, con la tarjeta entera marcada para verlo
  desde el otro extremo de la cocina.
- Un **resumen sumado por producto** de todo lo pendiente. En la barra es lo
  que evita hacer los mismos cuatro pisco sours de a uno.
- Las **notas** destacadas, que es lo que hace volver un plato.

Se actualizan solas cada diez segundos y piden un *wake lock* al navegador para
que la pantalla no se apague — despertarla tocándola es justo lo que no se
puede hacer.

**Que el plato está listo lo sigue avisando la campana**, como siempre. La
comanda desaparece de la pantalla cuando el garzón marca **"Ya la retiré"**
desde su teléfono, en la cuenta de la mesa. Mientras no lo haga, la comanda
envejece en rojo en la pared, que es exactamente el aviso que se quiere.

En la sala, cada mesa con algo esperando muestra **"N comandas por retirar"**,
para saber a dónde ir cuando suena la campana. Cerrar una mesa cierra también
sus comandas pendientes: una mesa que se fue no puede seguir ocupando la
pantalla de cocina.

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

Cada envío de una mesa saca **una comanda por estación**: una con los
bebestibles para la barra y otra con los alimentos para la cocina. Si la mesa
pidió solo de una de las dos, sale solo ese papel. Al cobrar —la mesa completa
o la cuenta de una sola persona— sale además el **resumen del cobro**, con el
detalle, el total, la forma de pago y el número de comprobante.

Ese papel se le pasa al cliente para que revise, así que bajo el total lleva
la **propina sugerida del 10 %** y el **total con propina** ya sumado, más la
línea de que es voluntaria. Los dos importes van en letra doble —en letra
normal el de la propina quedaba como una nota al pie, justo lo que el cliente
saca la calculadora para averiguar— y lo que evita confundirlos son los
rótulos: **TOTAL** a secas es lo que se debe, **CON PROPINA** es lo otro. El
porcentaje se cambia con `PRINT_TIP_PERCENT`, y en `0` el bloque no se
imprime.

Todos salen diferenciados a propósito, porque con una sola impresora caen por
la misma ranura: cada uno lleva una banda negra con su destino en letra doble
y una textura propia alrededor (`#` cocina, `*` barra, `$` cobro), que se
reconocen sin leer y aunque el papel quede boca abajo. Las comandas llevan
además el nombre de quien las mandó, que es como cada garzón reconoce las
suyas en una bandeja con papeles de varias mesas.

#### Un envío, un papel

Con **una sola impresora**, las dos comandas de un mismo envío no salen por
separado: salen **en una sola tira continua**, una debajo de la otra, con una
línea de `CORTAR AQUI` en el medio y cada mitad numerada (`PARTE 1 DE 2`). La
garzona retira una vez, la parte en dos con las manos y reparte.

Antes salían de a una con 3 segundos de pausa entre medio (`PRINT_GAP_MS`)
para que la segunda no cayera sobre la primera, y en la práctica eso obligaba
a esperar al lado de la ranura o a volver después y encontrar los papeles de
otra mesa mezclados encima. La pausa sigue existiendo **entre envíos
distintos** de la misma impresora, que es donde sí hay algo que se encime.

El corte del medio es una guía impresa y no un corte de la impresora: en las
térmicas baratas el "corte parcial" a veces corta entero, y ahí las dos
mitades se separarían y caerían —justo lo que este papel viene a evitar—.

**Esto se apaga solo.** El agrupamiento pide dos condiciones: que las comandas
sean del mismo envío *y* que les toque la misma impresora. El día que lleguen
la de barra y la de cocina, cada mitad resuelve una ranura distinta, la
segunda condición no se cumple y las comandas vuelven a salir por separado en
su estación. No hay nada que desactivar.

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
| `PRINT_GAP_MS` | Pausa entre dos papeles seguidos de la misma impresora. Por defecto 3000. |
| `PRINT_WIDTH` | Ancho del papel en caracteres: 48 para 80 mm, 32 para 58 mm. |
| `PRINT_TIP_PERCENT` | Propina sugerida que se imprime en el papel del cliente. Por defecto 10. En `0` no se imprime. |

### Correo

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `RESEND_API_KEY` | Para enviar | Clave de Resend. Sin ella no sale ningún correo: los intentos quedan anotados como fallidos en `email_logs` y nada más se rompe. |
| `EMAIL_FROM` | Para enviar | Remitente. El dominio tiene que estar **verificado en Resend** o el envío se rechaza. Admite `hola@barzuo.com` o `BARZUO <hola@barzuo.com>`. |
| `EMAIL_NOTIFY_TO` | No | Respaldo de a quién avisar los mensajes de la web. Lo normal es configurarlo en **Ajustes → Contacto**, que se cambia sin desplegar. |
| `CRON_SECRET` | Para los cumpleaños | Protege `/api/cron/cumpleanos`. Mínimo 16 caracteres. Sin ella la ruta queda cerrada. |

El saludo de cumpleaños lo dispara un temporizador externo, una vez al día:

```bash
0 10 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://barzuo.com/api/cron/cumpleanos
```

No se agenda dentro de la aplicación a propósito: un intervalo en el proceso de
Next.js se duplica con cada instancia y se pierde con cada despliegue, que son
las dos formas de saludar dos veces o ninguna. Correr de más es inofensivo:
quien ya fue saludado este año no vuelve a entrar en la lista.

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

## El servicio en vivo

`/admin/en-vivo`. La pantalla que mira quien administra el local **mientras el
local está abierto**. Se actualiza sola cada 30 segundos y funciona igual en el
teléfono.

Arriba de todo va **lo que hay que ir a resolver**, ordenado por urgencia y con
un enlace al lugar donde se arregla:

| Aviso | Cuándo aparece |
| --- | --- |
| Comanda demorada | Lleva 8 minutos sin que nadie la retire (urgente a los 15). |
| Productos sin mandar | El garzón los cargó hace más de 5 minutos y la estación todavía no los vio. |
| Mesa sin pedir | Abierta hace más de 20 minutos y sin un solo producto cargado. |
| Mesa larga | Más de 2 h 30 abierta y con consumo sin cobrar. |
| Impresión fallida | La impresora rechazó una comanda. |

Debajo, los números de la jornada: **vendido**, **lo que hay sin cobrar en las
mesas**, **ocupación** y la **demora promedio de la cocina** (medida de verdad:
desde que se manda la comanda hasta que el garzón la retira, con la peor espera
al lado). Después, el **ritmo hora por hora**, la **cola de la estación**, **lo
más vendido**, el **consumo por estación**, las **formas de pago** y **quién
está cobrando**.

**La jornada empieza a las 06:00**, no a medianoche: un bar que cierra a las
tres tiene media noche después de las doce, y cortar ahí dejaría la pantalla en
cero justo cuando el local está más lleno. Las seis son **las del local**
(`NEXT_PUBLIC_TIME_ZONE`), no las del servidor, que en producción corre en UTC.

> Ojo con la diferencia: **`/admin/caja` cuenta desde la medianoche** porque es
> el cuadre contable del día. Las dos pantallas responden preguntas distintas y
> por eso pueden mostrar totales distintos entre medianoche y las seis.

---

## Karaoke

Tres pantallas y una cola.

| Pantalla | Para quién | Qué hace |
| --- | --- | --- |
| `/staff/karaoke` | El encargado, en su teléfono | Busca canciones, arma la cola, acepta los pedidos de las mesas y abre o cierra la noche. |
| `/staff/karaoke/pantalla` | La TV del local | Reproduce el turno actual y pasa solo al siguiente cuando el video termina. |
| `/staff/karaoke/qr` | La impresora | Un QR por mesa, listo para recortar y pegar. |
| `/karaoke` | El cliente | Lo que abre ese QR: pide su canción y ve cuántos van adelante. |

### La cuota de YouTube, que es lo que manda el diseño

La YouTube Data API v3 da **10.000 unidades al día** y cada búsqueda cuesta
**100**: unas cien búsquedas diarias para todo el local. Por eso:

- **Solo el encargado busca en YouTube**, y con un botón aparte que dice que lo
  está haciendo. El resto de la pantalla busca en el catálogo del local.
- **Cada canción que se encola queda guardada** (`KaraokeTrack`). La segunda vez
  que alguien la pide sale del catálogo sin gastar nada. Un karaoke repite
  mucho: a las pocas noches casi todo sale de ahí.
- **Los pedidos de las mesas nunca llaman a la API.** El cliente elige del
  catálogo o escribe su canción con palabras, y el encargado le busca el video
  al aceptarla.

Si la cuota se acaba, el buscador lo dice con todas las letras y el catálogo
sigue funcionando.

### Pedidos desde la mesa

El QR lleva a `/karaoke?mesa=N`. El pedido **no entra directo a la cola**: queda
como *pedida* hasta que alguien de sala la acepta, que es lo que evita que la
TV termine reproduciendo cualquier cosa. Además hay tope de tres canciones
esperando por mesa y límite de pedidos por conexión.

El karaoke se abre y se cierra desde `/staff/karaoke`. Cerrado, el QR avisa que
esta noche no hay en vez de juntar pedidos que nadie va a mirar.

### YouTube Premium

No se conecta por código: **no existe** credencial ni ajuste que meta una
suscripción Premium en un reproductor incrustado. Los avisos dependen de la
sesión del navegador que reproduce. Si la TV del local abre
`/staff/karaoke/pantalla` en un navegador con la cuenta Premium del bar
iniciada, sale sin avisos; si no, salen. Un bloqueo de cookies de terceros en
ese navegador también lo rompe.

### Antes de usarlo

1. **Configura `YOUTUBE_API_KEY`** (Google Cloud → habilitar *YouTube Data API
   v3* → crear credencial de tipo clave). Sin ella solo funciona el catálogo.
2. **Imprime los QR** desde `/staff/karaoke/qr` y pégalos en las mesas.
3. **Deja la TV** en `/staff/karaoke/pantalla`, con sesión iniciada, en el
   navegador que tenga la cuenta de YouTube del local.
4. **Abre el karaoke** desde `/staff/karaoke` cuando arranque la noche.

Reproducir música en el local es ejecución pública: los términos de YouTube
están escritos para uso personal, y en Chile el local paga igual sus derechos
(SCD). Eso lo resuelve el bar, no la app.

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

Si en los logs aparece `No se pudo purgar el caché de Cloudflare: HTTP 401`,
el token no sirve y el panel lo avisa en su pantalla de inicio. Las causas
habituales, en orden:

- se cargó la **clave global de API** en vez de un token creado en *API
  Tokens* (la app manda el valor como `Bearer`, formato que la clave global no
  acepta);
- el token no tiene el permiso *Zone → Cache Purge → Purge*, o no incluye la
  zona de `CLOUDFLARE_ZONE_ID` entre sus *Zone Resources*;
- el token fue revocado o venció.

Mientras esté rechazado, el borde sigue guardando una hora: los cambios del
panel tardan eso en verse, aunque la app los sirva frescos.

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
