#!/usr/bin/env python3
"""Manual de sala BARZUO: el PDF que se le pasa al equipo."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = "/home/user/bar2/manual-de-sala.pdf"

CRIMSON = colors.HexColor("#b4111b")
CRIMSON_BRIGHT = colors.HexColor("#e11d2a")
GILT = colors.HexColor("#a8871c")
GILT_BG = colors.HexColor("#fdf6e0")
INK = colors.HexColor("#141218")
GREY = colors.HexColor("#5d5750")
LINE = colors.HexColor("#d8d2c9")
SOFT = colors.HexColor("#f6f3ee")
GREEN = colors.HexColor("#1f7a4d")
GREEN_BG = colors.HexColor("#eff8f3")
RED_BG = colors.HexColor("#fdf0f1")

styles = getSampleStyleSheet()


def S(name, **kw):
    base = kw.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kw)


BODY = S("body", fontName="Helvetica", fontSize=9.6, leading=13.6,
         textColor=INK, spaceAfter=0)
BODY_C = S("bodyc", parent=BODY, alignment=TA_CENTER)
SMALL = S("small", fontName="Helvetica", fontSize=8.3, leading=11.4, textColor=GREY)
H1 = S("h1", fontName="Helvetica-Bold", fontSize=17, leading=20,
       textColor=INK, spaceBefore=0, spaceAfter=3)
H2 = S("h2", fontName="Helvetica-Bold", fontSize=12.5, leading=15,
       textColor=CRIMSON, spaceBefore=0, spaceAfter=0)
STEPTITLE = S("st", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=INK)
NUM = S("num", fontName="Helvetica-Bold", fontSize=17, leading=19,
        textColor=colors.white, alignment=TA_CENTER)
MONO = S("mono", fontName="Courier", fontSize=6.5, leading=8.6, textColor=INK)
MONO_B = S("monob", fontName="Courier-Bold", fontSize=6.5, leading=8.6, textColor=INK)
LABEL = S("label", fontName="Helvetica-Bold", fontSize=8, leading=10,
          textColor=colors.white, alignment=TA_CENTER)

W = A4[0] - 34 * mm  # ancho util


def section(titulo, bajada=None):
    """Titulo de seccion con la barra roja al costado."""
    inner = [[Paragraph(titulo, H1)]]
    if bajada:
        inner.append([Paragraph(bajada, SMALL)])

    t = Table(inner, colWidths=[W - 6 * mm])
    t.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LINEBEFORE", (0, 0), (0, -1), 2.6, CRIMSON),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return [Spacer(1, 6 * mm), t, Spacer(1, 3.5 * mm)]


def step(n, titulo, cuerpo, nota=None, color=CRIMSON):
    """Un paso numerado del flujo."""
    contenido = [Paragraph(titulo, STEPTITLE), Spacer(1, 1.4 * mm),
                 Paragraph(cuerpo, BODY)]

    if nota:
        contenido += [Spacer(1, 2 * mm), aviso(*nota)]

    badge = Table([[Paragraph(str(n), NUM)]], colWidths=[9.5 * mm],
                  rowHeights=[9.5 * mm])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    t = Table([[badge, contenido]], colWidths=[13.5 * mm, W - 13.5 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([t, Spacer(1, 4.6 * mm)])


def aviso(etiqueta, texto, fondo=GILT_BG, borde=GILT, tinta=None):
    """Recuadro de atencion."""
    tinta = tinta or borde
    txt = f'<font color="#{tinta.hexval()[2:]}"><b>{etiqueta}</b></font>&nbsp; {texto}'
    t = Table([[Paragraph(txt, BODY)]], colWidths=[W - 13.5 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("LINEBEFORE", (0, 0), (0, -1), 2.2, borde),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.4 * mm),
    ]))
    return t


def tabla(filas, anchos, cabecera=True):
    data = []
    for i, fila in enumerate(filas):
        estilo = S("th", parent=BODY, fontName="Helvetica-Bold",
                   textColor=colors.white) if (cabecera and i == 0) else BODY
        data.append([Paragraph(c, estilo) for c in fila])

    t = Table(data, colWidths=anchos, repeatRows=1 if cabecera else 0)
    est = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.6 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.6 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ]
    if cabecera:
        est += [("BACKGROUND", (0, 0), (-1, 0), INK)]
        est += [("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT])]
    else:
        est += [("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, SOFT])]
    t.setStyle(TableStyle(est))
    return t


def papel(lineas):
    """Maqueta del papel termico, en monoespaciado."""
    filas = [[Paragraph(t.replace(" ", "&nbsp;"), MONO_B if b else MONO)]
             for t, b in lineas]
    t = Table(filas, colWidths=[74 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffdf8")),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0.3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.3),
    ]))
    return t


# --- Documento ---------------------------------------------------------------

def portada(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, A4[1] - 62 * mm, A4[0], 62 * mm, fill=1, stroke=0)
    canvas.setFillColor(CRIMSON)
    canvas.rect(0, A4[1] - 63.6 * mm, A4[0], 1.6 * mm, fill=1, stroke=0)

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 30)
    canvas.drawString(17 * mm, A4[1] - 30 * mm, "Manual de sala")
    canvas.setFont("Helvetica", 13.5)
    canvas.setFillColor(colors.HexColor("#cdc5bb"))
    canvas.drawString(17 * mm, A4[1] - 40 * mm,
                      "Cómo tomar, mandar, cobrar y cerrar una mesa")
    canvas.setFont("Helvetica-Bold", 9)
    canvas.setFillColor(colors.HexColor("#e8cf7a"))
    canvas.drawString(17 * mm, A4[1] - 51 * mm,
                      "BARZUO  ·  Versión con una sola impresora")
    pie(canvas, doc)
    canvas.restoreState()


def pie(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(17 * mm, 14 * mm, A4[0] - 17 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.6)
    canvas.setFillColor(GREY)
    canvas.drawString(17 * mm, 10 * mm, "Manual de sala BARZUO")
    canvas.drawRightString(A4[0] - 17 * mm, 10 * mm, f"Página {doc.page}")
    canvas.restoreState()


def normal(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CRIMSON)
    canvas.rect(0, A4[1] - 4 * mm, A4[0], 4 * mm, fill=1, stroke=0)
    canvas.restoreState()
    pie(canvas, doc)


doc = BaseDocTemplate(OUT, pagesize=A4,
                      leftMargin=17 * mm, rightMargin=17 * mm,
                      topMargin=17 * mm, bottomMargin=19 * mm,
                      title="Manual de sala BARZUO",
                      author="BARZUO")

frame_portada = Frame(17 * mm, 19 * mm, W, A4[1] - 62 * mm - 19 * mm - 6 * mm,
                      id="portada")
frame_normal = Frame(17 * mm, 19 * mm, W, A4[1] - 17 * mm - 19 * mm - 4 * mm,
                     id="normal")

doc.addPageTemplates([
    PageTemplate(id="portada", frames=[frame_portada], onPage=portada),
    PageTemplate(id="normal", frames=[frame_normal], onPage=normal),
])

F = []  # flowables


# =============================================================================
# 1. Antes de empezar
# =============================================================================
F.append(NextPageTemplate("normal"))

F += section("Antes de empezar",
             "Dos aparatos, dos trabajos. Los dos ven la misma información.")

F.append(tabla([
    ["", "El teléfono", "La pantalla táctil"],
    ["<b>Quien</b>", "Cada garzón, en la mano", "Quien esté en la caja"],
    ["<b>Para que</b>",
     "Abrir mesas, tomar el pedido, mandarlo, retirar y cobrar en la mesa",
     "Ver la sala entera, cobrar, cerrar mesas y volver a imprimir un papel"],
    ["<b>La carta</b>",
     "Se abre con el botón <b>Agregar</b> y ocupa toda la pantalla",
     "Esta siempre a la vista, fija en la columna derecha"],
], [24 * mm, (W - 24 * mm) / 2, (W - 24 * mm) / 2]))

F.append(Spacer(1, 4 * mm))
F.append(Paragraph(
    "<b>Para entrar:</b> abre la dirección del sistema, escribe tu cuenta del "
    "equipo y toca <b>Ingresar</b>. Vas a caer en la pantalla de tarjetas; "
    "desde ahí toca <b>Sala</b>. La sesión queda abierta: no tienes que entrar "
    "de nuevo en toda la noche.", BODY))

F.append(Spacer(1, 3 * mm))
F.append(aviso("Importante.",
               "Cada uno entra con SU cuenta. El nombre de quien manda un "
               "pedido sale impreso en la comanda: así cada garzón reconoce "
               "sus papeles en la bandeja de la caja.",
               RED_BG, CRIMSON))


# =============================================================================
# 2. El flujo de una mesa
# =============================================================================
F.append(PageBreak())
F += section("El flujo de una mesa, paso a paso",
             "De principio a fin. Es el mismo en el teléfono y en la pantalla "
             "del local, salvo donde se avisa.")

F.append(step(1, "Abrir la mesa",
              "En <b>Sala</b> ves todas las mesas. Las <b>grises dicen Libre</b> "
              "y las <b>rojas dicen Ocupada</b>.<br/><br/>"
              "Toca una mesa gris. Te pregunta <b>cuántas personas se "
              "sentaron</b>: ajusta con el más y el menos, y toca "
              "<b>Abrir mesa</b>. Entras directo a la carta, listo para tomar "
              "el pedido."))

F.append(step(2, "Tomar el pedido",
              "Arriba hay un buscador. Puedes escribir el producto "
              "(<i>pisco sour</i>) o la categoría entera (<i>cerveza</i>, "
              "<i>trago</i>, <i>postre</i>) y se muestra completa.<br/><br/>"
              "Debajo están <b>Los de siempre</b>, que es de donde sale la "
              "mayoría de los pedidos sin buscar nada.<br/><br/>"
              "<b>Cada toque en un producto agrega uno.</b> Para tres schops, "
              "tocas tres veces. Aparece un numerito verde con la cuenta de lo "
              "que llevas cargado.",
              nota=("Notas del cliente.",
                    "Después de cargar un producto aparece abajo "
                    "<b>Agregar nota a...</b>. Ahí están los botones de "
                    "siempre (sin cebolla, sin hielo, bien cocido) y puedes "
                    "escribir lo que no esté en la lista.")))

F.append(step(3, "Mandar el pedido",
              "Cuando terminaste, el botón dorado de abajo dice "
              "<b>Enviar 4 a la cocina</b> (o a la barra, o a cocina y barra). "
              "Tócalo: manda el pedido y te devuelve a la cuenta.<br/><br/>"
              "Si te equivocaste y no quieres mandar nada todavía, sal con la "
              "<b>X</b> de arriba.",
              nota=("Solo lo mandado se prepara.",
                    "Mientras no toques Enviar, la cocina y la barra "
                    "<b>no saben nada</b>. Los productos sin mandar salen "
                    "marcados en amarillo con <i>Falta enviar</i>."),
              color=GILT))

F.append(step(4, "Ir a buscar el papel a la caja",
              "Al mandar, el sistema te dice: "
              "<b>&#171;Retira el papel en la caja: va partido, una mitad para "
              "la barra y otra para la cocina&#187;</b>.<br/><br/>"
              "Anda a la impresora, toma el papel, <b>pártelo por la línea que "
              "dice CORTAR AQUI</b> y deja cada mitad en su estación.",
              color=CRIMSON_BRIGHT))


# =============================================================================
# 2b. Las tres formas de trabajar
# =============================================================================
F.append(PageBreak())
F += section("Tres formas de trabajar, todas válidas",
             "Los pasos de arriba son la forma corta. Estas otras dos también "
             "funcionan: elige la que te acomode.")

F.append(Paragraph(
    "El sistema es uno solo: lo que cargas en tu teléfono aparece en la "
    "pantalla del local y al revés, en menos de diez segundos. Nadie tiene que "
    "avisarle a nadie.", BODY))
F.append(Spacer(1, 4 * mm))

F.append(step("A", "Todo desde el teléfono, en la mesa",
              "Es la forma normal y la que menos vueltas da: abres, cargas y "
              "mandas ahí mismo, parado en la mesa. Después pasas por la caja "
              "a buscar el papel.<br/><br/>"
              "<b>Sirve cuando:</b> la mesa te dicta el pedido de corrido y "
              "puedes ir tocando mientras hablan."))

F.append(step("B", "Anoto en el teléfono y mando desde la caja",
              "Cargas los productos en tu teléfono pero <b>no tocas Enviar</b>: "
              "sales de la carta con la <b>X</b> de arriba. Puedes hacer esto "
              "en varias mesas seguidas.<br/><br/>"
              "Cuando llegas a la caja, en la pantalla del local aparece "
              "arriba de la sala un recuadro dorado que dice "
              "<b>Cargado y sin imprimir</b>, con un botón por cada mesa: "
              "<b>Mesa 8 &#183; Enviar 5</b>. Lo tocas y el papel sale al lado "
              "tuyo.<br/><br/>"
              "<b>Sirve cuando:</b> atiendes varias mesas en una pasada y "
              "quieres imprimir todo junto, sin ir y volver.",
              nota=("Mientras no toques Enviar, no se prepara.",
                    "Lo que queda cargado sin mandar es tuyo y nadie lo ve en "
                    "la cocina. Si terminas el turno con algo sin enviar, "
                    "queda ahí."),
              color=GILT))

F.append(step("C", "Anoto en papel y cargo en la caja",
              "Tomas el pedido en tu libreta como toda la vida. Después vas a "
              "la pantalla del local, tocas la mesa, y ahí "
              "<b>la carta está siempre a la vista en la columna derecha</b> "
              "&#8212; no hay que abrirla ni cerrarla.<br/><br/>"
              "Vas tocando productos, se van sumando a la cuenta de la "
              "izquierda, y cuando terminas tocas <b>Enviar</b>.<br/><br/>"
              "<b>Sirve cuando:</b> la mesa es grande, el pedido es largo o "
              "prefieres no andar con el teléfono en la mano frente al "
              "cliente.",
              nota=("Abre la mesa igual.",
                    "Aunque anotes en papel, la mesa tiene que estar abierta "
                    "en el sistema para poder cargarle cosas. Si no la "
                    "abriste antes, la abres ahí mismo."),
              color=GREEN))

F.append(aviso("Se pueden mezclar.",
               "Cargar tres cosas en el teléfono y las otras dos en la caja "
               "es perfectamente válido: van a la misma cuenta y salen en el "
               "mismo papel.", GREEN_BG, GREEN))


# =============================================================================
# 3. El papel
# =============================================================================
F.append(PageBreak())
F += section("El papel de la impresora",
             "Tenemos una sola impresora, en la caja. Todo sale por ahí.")

F.append(Paragraph(
    "Cuando una mesa pide comida <b>y</b> trago, no salen dos papeles sueltos: "
    "sale <b>uno solo, largo</b>, con las dos comandas una debajo de la otra. "
    "Lo tomas una vez, lo partes con las manos y repartes.", BODY))
F.append(Spacer(1, 4 * mm))

F.append(papel([
    ("################################################", True),
    ("                 C O C I N A                    ", True),
    ("################################################", True),
    ("                   MESA 8                       ", True),
    ("                PARTE 1 DE 2                    ", True),
    ("================================================", False),
    ("Comanda #7                                 21:14", False),
    ("Mando: Camila", False),
    ("================================================", False),
    ("> Polera azul", True),
    ("2 x Papas bravas", True),
    ("  ** sin ají", True),
    ("", False),
    ("---------------- CORTAR AQUI -------------------", True),
    ("", False),
    ("************************************************", True),
    ("                  B A R R A                     ", True),
    ("************************************************", True),
    ("                   MESA 8                       ", True),
    ("                PARTE 2 DE 2                    ", True),
    ("================================================", False),
    ("Comanda #8                                 21:14", False),
    ("Mando: Camila", False),
    ("================================================", False),
    ("3 x Schop Kunstmann", True),
    ("1 x Pisco sour", True),
    ("  ** sin azúcar", True),
]))

F.append(Spacer(1, 4.5 * mm))

F.append(tabla([
    ["En el papel", "Qué significa"],
    ["<b>La banda negra</b>",
     "A donde va: COCINA, BARRA o COBRO. Se lee de lejos, sin acercarse."],
    ["<b>La textura</b>",
     "Almohadillas <b>#</b> es cocina, asteriscos <b>*</b> es barra, pesos "
     "<b>$</b> es el cobro del cliente. Sirve aunque el papel quede al revés."],
    ["<b>PARTE 1 DE 2</b>",
     "Hay otra mitad. Si solo ves una parte, la otra quedó en la bandeja."],
    ["<b>Mando: ...</b>",
     "Quién lo envió. Si hay varios papeles juntos, busca tu nombre."],
    ["<b>CORTAR AQUI</b>",
     "Por ahí se parte, con las manos. No lo corta la máquina."],
], [30 * mm, W - 30 * mm]))

F.append(Spacer(1, 4 * mm))
F.append(aviso("Si no salió el papel.",
               "En la cuenta de la mesa aparece arriba, en rojo, "
               "<b>&#171;No salió el papel de la cocina&#187;</b> con un botón "
               "<b>Reintentar</b>. Revisa que la impresora tenga papel y "
               "tócalo. El pedido no se pierde nunca: queda esperando.",
               RED_BG, CRIMSON))


# =============================================================================
# 4. Durante el servicio
# =============================================================================
F.append(PageBreak())
F += section("Durante el servicio")

F.append(step(5, "Retirar lo que está listo",
              "Cuando la cocina o la barra terminan, tocan la campana como "
              "siempre. En tu teléfono, arriba de todo en la cuenta de esa "
              "mesa, aparece <b>Lista en la cocina &#183; hace 4 min</b>.<br/><br/>"
              "Vas a buscarlo y tocas <b>Ya la retiré</b>. Eso es lo que "
              "borra la comanda de la pantalla de la estación.",
              nota=("Si no lo marcas.",
                    "La comanda se queda en la pantalla de la cocina "
                    "envejeciendo: a los 8 minutos se pone amarilla y a los 15 "
                    "roja. La cocina va a creer que no pasaste a buscarlo."),
              color=GILT))

F.append(step(6, "Agregar más cosas después",
              "Toca la mesa roja en <b>Sala</b>, toca <b>Agregar</b>, carga y "
              "vuelve a <b>Enviar</b>. Sale un papel nuevo.<br/><br/>"
              "Los productos que <b>ya se mandaron</b> no se pueden subir ni "
              "bajar de cantidad: solo <b>Anular</b>, y te pide confirmar."))

F.append(step(7, "Anular algo ya mandado",
              "Toca <b>Anular</b> en la línea del producto. Te avisa que ya "
              "salió hacia la cocina.",
              nota=("Anda a avisarles igual.",
                    "El papel ya está impreso allá. Anular en el sistema no "
                    "borra el papel: si no les dices, lo van a preparar.",
                    RED_BG, CRIMSON),
              color=CRIMSON_BRIGHT))

F.append(step(8, "Separar la cuenta",
              "Si van a pagar por separado, toca <b>Separar cuentas</b> y "
              "describe a la persona <b>por cómo se ve</b>: "
              "&#171;polera azul&#187;, &#171;pelo largo&#187;. No hace falta "
              "preguntarle el nombre.<br/><br/>"
              "Arriba aparecen las pestañas. <b>Toca primero la pestaña de la "
              "persona y después carga sus productos</b>, o van a caer en la "
              "cuenta común de la mesa."))

F.append(step(9, "BarzuCard",
              "Toca <b>¿Tiene BarzuCard?</b> apenas la pidan. Puedes "
              "escanear el QR del teléfono del cliente, escribir los 16 "
              "dígitos de la tarjeta o pegar el código de un cupón.<br/><br/>"
              "Después toca <b>Aplicar un beneficio</b>: la lista te dice "
              "cuánta plata descuenta cada uno en <b>esta</b> cuenta. Tú no "
              "calculas nada.",
              nota=("Antes de cobrar, no después.",
                    "El cliente pide su descuento cuando pide. Si la tarjeta "
                    "se presenta al final, igual funciona, pero te vas a "
                    "perder de ofrecerle las promos que le faltan por poco.")))


# =============================================================================
# 5. Cobrar y cerrar
# =============================================================================
F.append(PageBreak())
F += section("Cobrar y cerrar la mesa")

F.append(step(10, "Cobrar",
              "El botón rojo de abajo dice <b>Cobrar $24.500</b>.<br/><br/>"
              "Si la cuenta está separada, primero te pregunta <b>quién "
              "paga</b>: solo esa persona o toda la mesa, cada una con su "
              "monto.<br/><br/>"
              "Elige cómo paga (efectivo, débito, crédito o transferencia) y "
              "toca <b>Cobrar</b>. Sale el número de comprobante y se imprime "
              "el papel del cliente.",
              nota=("La propina no se pone acá.",
                    "La deja el cliente en la máquina, como siempre.")))

F.append(step(11, "Cerrar la mesa",
              "Justo después de cobrar la mesa completa, ahí mismo te aparecen "
              "dos botones:<br/><br/>"
              "<b>Cerrar la mesa y liberarla</b> &#183; la mesa vuelve a quedar "
              "gris y te devuelve a la sala.<br/>"
              "<b>Dejarla abierta</b> &#183; para cuando pagaron pero siguen "
              "sentados y van a seguir pidiendo.",
              nota=("Una mesa que no se cierra sigue ocupada.",
                    "Nadie más la puede usar. Si abriste una mesa por error, "
                    "entra y toca <b>Cerrar la mesa sin consumo</b>."),
              color=GREEN))

F.append(Spacer(1, 1 * mm))
F += section("Qué significa cada color")

F.append(tabla([
    ["Lo que ves", "Qué es", "Qué haces"],
    ["Mesa <b>gris</b>, dice Libre", "Nadie sentado", "Tócala para abrirla"],
    ["Mesa <b>roja</b>, dice Ocupada", "Mesa en servicio",
     "Tócala para ver su cuenta"],
    ["<b>Falta enviar 3</b> (amarillo)",
     "Hay 3 productos cargados que la cocina no ha visto",
     "Entra y toca Enviar"],
    ["<b>2 comandas por retirar</b> (amarillo)",
     "Hay comida o tragos listos esperando",
     "Anda a buscarlos y marca Ya la retiré"],
    ["<b>No salió el papel</b> (rojo)", "La impresora falló",
     "Revisa la impresora y toca Reintentar"],
    ["Producto en <b>gris claro</b>, dice Ya pagado",
     "Esa línea ya se cobró", "Nada"],
], [46 * mm, (W - 46 * mm) * 0.46, (W - 46 * mm) * 0.54]))


# =============================================================================
# 6. Cocina y barra + chuleta
# =============================================================================
F.append(PageBreak())
F += section("Las pantallas de cocina y barra",
             "Para quien está adentro preparando.")

F.append(Paragraph(
    "Son pantallas que <b>no se tocan</b>: quien cocina tiene las manos "
    "mojadas y no las va a secar para apretar un botón. Se miran y nada más.",
    BODY))
F.append(Spacer(1, 3 * mm))

F.append(tabla([
    ["Se ve", "Significa"],
    ["La comanda <b>más vieja arriba</b>", "Ese es el orden en que hay que salir."],
    ["El tiempo, en grande",
     "Blanco es normal. <b>Amarillo a los 8 minutos.</b> "
     "<b>Rojo a los 15.</b> Se ve desde el otro lado de la cocina."],
    ["El total de arriba",
     "Todo lo pendiente sumado por producto: si hay 4 pisco sour repartidos "
     "en tres comandas, se hacen los 4 juntos."],
    ["La comanda desaparece",
     "Porque el garzón marcó <b>Ya la retiré</b> en su teléfono. No hay que "
     "tocar nada en esta pantalla."],
], [46 * mm, W - 46 * mm]))

F.append(Spacer(1, 3 * mm))
F.append(aviso("La pantalla no reemplaza al papel.",
               "Mientras tengamos una sola impresora, el papel que lleva el "
               "garzón es el que manda. La pantalla sirve para ver el orden y "
               "los tiempos.", GREEN_BG, GREEN))

F += section("Chuleta: las seis reglas")

reglas = [
    ("Cargar no es mandar.",
     "Hasta que no toques <b>Enviar</b>, la cocina no sabe nada."),
    ("Mandar no es entregar.",
     "El papel te espera en la caja. Si no lo llevas, no se prepara."),
    ("Fíjate en PARTE 1 DE 2.",
     "Si el papel dice que hay dos partes, no te vayas con una."),
    ("Marca Ya la retiré.",
     "Es lo único que limpia la pantalla de la cocina."),
    ("Pregunta por la BarzuCard al tomar el pedido.",
     "Al final ya es tarde para ofrecerle promos."),
    ("Cierra la mesa al final.",
     "Una mesa sin cerrar queda ocupada para todos."),
]

filas = [[f"<b>{i + 1}. {t}</b>&nbsp; {d}"] for i, (t, d) in enumerate(reglas)]
t = Table(filas, colWidths=[W])
t.setStyle(TableStyle([
    ("LEFTPADDING", (0, 0), (-1, -1), 3.4 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3.4 * mm),
    ("TOPPADDING", (0, 0), (-1, -1), 2.6 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6 * mm),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, SOFT]),
]))
data = [[Paragraph(f[0], BODY)] for f in filas]
t2 = Table(data, colWidths=[W])
t2.setStyle(t.getStyle() if hasattr(t, "getStyle") else TableStyle([]))
t2.setStyle(TableStyle([
    ("LEFTPADDING", (0, 0), (-1, -1), 3.4 * mm),
    ("RIGHTPADDING", (0, 0), (-1, -1), 3.4 * mm),
    ("TOPPADDING", (0, 0), (-1, -1), 2.8 * mm),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8 * mm),
    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, SOFT]),
    ("LINEBEFORE", (0, 0), (0, -1), 2.2, CRIMSON),
]))
F.append(t2)

F.append(Spacer(1, 5 * mm))
F.append(Paragraph(
    "&#191;Algo no funciona como dice acá? Avisa antes del servicio, no en "
    "medio de él.", SMALL))

doc.build(F)
print("OK:", OUT)
