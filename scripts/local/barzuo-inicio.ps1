<#
================================================================================
 BARZUO - arranque del PC del local (Windows 10/11)

 Deja el local funcionando solo cuando se enciende el equipo, sin que nadie
 toque nada: levanta el agente de impresion, espera a que el sitio responda y
 abre cada pantalla en su monitor -el POS de mesas en la tactil del mostrador,
 las ventas del dia en el monitor del PC-.

 Despues no se va: se queda vigilando. Si el agente se cae, lo vuelve a
 levantar; si alguien cierra una pantalla de un aspa, la vuelve a abrir. Un
 corte de luz a mitad de servicio no deja al local sin comandas ni a la sala
 mirando un escritorio.

 No se ejecuta a mano en el dia a dia: lo registra "instalar-inicio.ps1" como
 tarea programada al iniciar sesion. Para probarlo antes:

   powershell -ExecutionPolicy Bypass -File scripts\local\barzuo-inicio.ps1

 La configuracion -URL, token, impresora, que monitor muestra que- vive en
 "barzuo-local.env", al lado de este archivo. Ver "barzuo-local.env.example".
================================================================================
#>

[CmdletBinding()]
param(
    # Abre las pantallas y levanta el agente, pero no se queda vigilando.
    # Sirve para probar la configuracion desde una consola.
    [switch]$SinVigilancia
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RaizScript = Split-Path -Parent $MyInvocation.MyCommand.Path
$RaizRepo = Split-Path -Parent (Split-Path -Parent $RaizScript)
$CarpetaLogs = Join-Path $RaizScript "logs"
$Bitacora = Join-Path $CarpetaLogs "arranque.log"

# --- Bitacora ---------------------------------------------------------------
# El equipo arranca sin nadie mirando: si algo falla a las siete de la tarde,
# lo unico que queda para saber por que es este archivo.

function Escribir-Log {
    param([string]$Mensaje)

    $linea = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Mensaje
    Write-Host $linea
    try {
        Add-Content -Path $Bitacora -Value $linea -Encoding UTF8
    } catch {
        # Una bitacora que no se puede escribir no puede tumbar el arranque.
    }
}

function Rotar-Log {
    param([string]$Ruta, [int]$MaximoMB = 5)

    if (-not (Test-Path $Ruta)) { return }
    if ((Get-Item $Ruta).Length -lt ($MaximoMB * 1MB)) { return }
    Move-Item -Path $Ruta -Destination "$Ruta.anterior" -Force
}

New-Item -ItemType Directory -Force -Path $CarpetaLogs | Out-Null
Rotar-Log -Ruta $Bitacora

# --- Configuracion ----------------------------------------------------------

function Leer-Configuracion {
    <#
      Lee "barzuo-local.env" en formato CLAVE=valor. Sin comillas, sin
      expansiones: el valor es todo lo que viene despues del primer "=", tal
      cual, porque una ruta de impresora de Windows (\\localhost\POS80) lleva
      barras invertidas que cualquier interpretacion rompe.
    #>
    param([string]$Ruta)

    $config = @{}
    if (-not (Test-Path $Ruta)) { return $config }

    foreach ($linea in Get-Content -Path $Ruta -Encoding UTF8) {
        $texto = $linea.Trim()
        if ($texto -eq "" -or $texto.StartsWith("#")) { continue }

        $corte = $texto.IndexOf("=")
        if ($corte -lt 1) { continue }

        $clave = $texto.Substring(0, $corte).Trim()
        $valor = $texto.Substring($corte + 1).Trim()
        $config[$clave] = $valor
    }
    return $config
}

function Valor {
    param([hashtable]$Config, [string]$Clave, [string]$PorDefecto = "")

    if ($Config.ContainsKey($Clave) -and $Config[$Clave] -ne "") { return $Config[$Clave] }
    return $PorDefecto
}

$RutaEnv = Join-Path $RaizScript "barzuo-local.env"
if (-not (Test-Path $RutaEnv)) {
    Escribir-Log "FALTA $RutaEnv. Copia barzuo-local.env.example y completalo."
    exit 1
}
$Config = Leer-Configuracion -Ruta $RutaEnv

$UrlSitio = (Valor $Config "BARZUO_URL" "http://localhost:3000").TrimEnd("/")
$TokenImpresion = Valor $Config "PRINT_AGENT_TOKEN"
# Un equipo que ya tenia su agente -el acceso directo del escritorio, una tarea
# hecha a mano- lo sigue manejando el: aca solo se abren las pantallas.
$AgentePropio = (Valor $Config "AGENTE_LEVANTAR" "si").ToLower() -ne "no"

# --- Programas del equipo ---------------------------------------------------

function Buscar-Navegador {
    <#
      Chrome primero y Edge de respaldo: Edge viene con Windows, asi que el
      local nunca se queda sin pantalla por una instalacion pendiente. Los dos
      entienden los mismos parametros de kiosco.
    #>
    $candidatos = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($ruta in $candidatos) {
        if ($ruta -and (Test-Path $ruta)) { return $ruta }
    }
    return $null
}

function Buscar-Node {
    $comando = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if ($comando) { return $comando.Source }

    foreach ($ruta in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe")) {
        if ($ruta -and (Test-Path $ruta)) { return $ruta }
    }
    return $null
}

# --- Monitores --------------------------------------------------------------

function Listar-Pantallas {
    <#
      Los monitores ordenados de izquierda a derecha, que es como los ve quien
      esta parado delante: el indice 0 es el de mas a la izquierda. El orden
      del sistema no sirve -depende de cual quedo como principal- y en el
      mostrador lo unico estable es donde esta fisicamente cada uno.
    #>
    Add-Type -AssemblyName System.Windows.Forms
    return @([System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.Bounds.X })
}

# --- Agente de impresion ----------------------------------------------------

$ProcesoAgente = $null

$RutaAgente = $null

function Buscar-Agente {
    <#
      Donde esta "print-agent.mjs".

      No se da por hecho que este script viva dentro del repo: en el local el
      agente suele estar suelto en el escritorio, puesto a mano antes que todo
      esto. Se busca en ese orden -lo que diga la configuracion, el repo, el
      escritorio- y quien lo tenga en otra parte solo escribe AGENTE_RUTA.
    #>
    if ($script:RutaAgente) { return $script:RutaAgente }

    $declarada = Valor $Config "AGENTE_RUTA"
    if ($declarada -ne "") {
        if (Test-Path $declarada) { $script:RutaAgente = $declarada; return $declarada }
        Escribir-Log "AGENTE_RUTA apunta a $declarada y ahi no hay nada."
        return $null
    }

    $candidatos = @(
        (Join-Path $RaizRepo "scripts\print-agent.mjs"),
        (Join-Path $env:USERPROFILE "Desktop\agente.bat"),
        (Join-Path $env:USERPROFILE "Desktop\imprimir.bat"),
        (Join-Path $env:USERPROFILE "Desktop\print-agent.mjs"),
        (Join-Path $env:USERPROFILE "OneDrive\Escritorio\print-agent.mjs"),
        (Join-Path $env:USERPROFILE "OneDrive\Desktop\print-agent.mjs"),
        (Join-Path $env:USERPROFILE "Escritorio\print-agent.mjs")
    )
    foreach ($ruta in $candidatos) {
        if ($ruta -and (Test-Path $ruta)) { $script:RutaAgente = $ruta; return $ruta }
    }

    # Ultimo intento: una carpeta del escritorio, que es como suele quedar
    # ("barzuo", "impresora", "POS"...). Dos niveles alcanzan y no cuesta nada.
    foreach ($escritorio in @((Join-Path $env:USERPROFILE "Desktop"),
                              (Join-Path $env:USERPROFILE "OneDrive\Escritorio"),
                              (Join-Path $env:USERPROFILE "OneDrive\Desktop"))) {
        if (-not (Test-Path $escritorio)) { continue }
        $hallado = Get-ChildItem -Path $escritorio -Filter "print-agent.mjs" -Recurse -Depth 2 -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($hallado) { $script:RutaAgente = $hallado.FullName; return $hallado.FullName }
    }

    return $null
}

function Agente-YaCorriendo {
    <#
      Un segundo agente contra la misma cola es una comanda que sale dos veces
      o una que no sale. Si el equipo ya tiene el suyo -el acceso directo del
      escritorio, una tarea de antes- este no levanta otro.
    #>
    try {
        $procesos = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop
    } catch {
        return $false
    }
    foreach ($proceso in $procesos) {
        if ($proceso.CommandLine -and $proceso.CommandLine -match "print-agent\.mjs") { return $true }
    }
    return $false
}

function Levantar-Agente {
    param([string]$Node)

    if (-not $AgentePropio) { return $null }
    if (Agente-YaCorriendo) {
        Escribir-Log "Ya hay un agente de impresion corriendo: no levanto otro."
        return $null
    }

    $script = Buscar-Agente
    if (-not $script) {
        Escribir-Log "No encuentro print-agent.mjs. Escribe su ruta en AGENTE_RUTA."
        return $null
    }

    # Un .bat o .cmd es lo que suele haber en el escritorio de un equipo que ya
    # imprime: adentro estan el token y la impresora, y funciona. Se ejecuta tal
    # cual en vez de pedir que lo desarmen para reescribirlo aca; lo unico que
    # le faltaba era arrancar solo.
    $porArchivo = [System.IO.Path]::GetExtension($script).ToLower()
    $propio = ($porArchivo -eq ".mjs" -or $porArchivo -eq ".js")

    if ($propio -and $TokenImpresion -eq "") {
        Escribir-Log "PRINT_AGENT_TOKEN vacio en barzuo-local.env: no salen comandas."
        return $null
    }
    if ($propio -and -not $Node) {
        Escribir-Log "No encuentro node.exe y el agente lo necesita."
        return $null
    }

    # El agente hereda el entorno de este proceso: por eso se pasan asi y no
    # por linea de comandos, donde el token quedaria a la vista de cualquiera
    # que abra el administrador de tareas.
    $env:BARZUO_URL = $UrlSitio
    $env:PRINT_AGENT_TOKEN = $TokenImpresion
    foreach ($clave in @("PRINTER_DEFAULT", "PRINTER_COCINA", "PRINTER_BARRA", "PRINTER_CAJA",
                         "PRINT_WIDTH", "PRINT_POLL_MS", "PRINT_GAP_MS", "PRINT_BATCH",
                         "PRINT_TIP_PERCENT")) {
        $valor = Valor $Config $clave
        if ($valor -ne "") { Set-Item -Path "Env:$clave" -Value $valor }
    }

    $salida = Join-Path $CarpetaLogs "agente.log"
    $errores = Join-Path $CarpetaLogs "agente.error.log"
    Rotar-Log -Ruta $salida
    Rotar-Log -Ruta $errores

    if ($propio) {
        $programa = $Node
        $argumentos = @("`"$script`"")
    } elseif ($porArchivo -eq ".ps1") {
        $programa = "powershell.exe"
        $argumentos = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$script`"")
    } elseif ($porArchivo -eq ".bat" -or $porArchivo -eq ".cmd") {
        $programa = "cmd.exe"
        $argumentos = @("/c", "`"$script`"")
    } else {
        $programa = $script
        $argumentos = @()
    }

    $parametros = @{
        FilePath               = $programa
        WorkingDirectory       = (Split-Path -Parent $script)
        WindowStyle            = "Hidden"
        PassThru               = $true
        RedirectStandardOutput = $salida
        RedirectStandardError  = $errores
    }
    # -ArgumentList vacio no es lo mismo que no pasarlo: Start-Process lo
    # rechaza, y un .exe suelto en AGENTE_RUTA no lleva ninguno.
    if ($argumentos.Count -gt 0) { $parametros["ArgumentList"] = $argumentos }

    $proceso = Start-Process @parametros
    Escribir-Log "Agente de impresion levantado desde $script (PID $($proceso.Id))."
    return $proceso
}

# --- Pantallas --------------------------------------------------------------

$Pantallas = @()

function Abrir-Pantalla {
    <#
      Una pantalla es una ventana de navegador sin barras, a pantalla completa
      y clavada en su monitor.

      Cada una lleva su propio perfil (--user-data-dir). No es un detalle: son
      dos sesiones distintas -la tactil entra como sala, el PC como
      administrador- y con un perfil compartido la segunda le pisaria la sesion
      a la primera. El perfil ademas guarda la cookie, asi que hay que entrar
      una vez y no en cada arranque; la sesion dura una semana, de modo que una
      vez por semana alguien vuelve a escribir la clave.
    #>
    param(
        [string]$Nombre,
        [string]$Navegador,
        [string]$Url,
        [object]$Pantalla
    )

    $perfil = Join-Path $env:LOCALAPPDATA "Barzuo\perfiles\$Nombre"
    New-Item -ItemType Directory -Force -Path $perfil | Out-Null

    $limites = $Pantalla.Bounds
    $argumentos = @(
        "--user-data-dir=`"$perfil`"",
        "--app=$Url",
        "--window-position=$($limites.X),$($limites.Y)",
        "--window-size=$($limites.Width),$($limites.Height)",
        "--start-fullscreen",
        # Sin esto, un apagon deja la ventana pidiendo "restaurar pestanas"
        # encima del POS, y hay que ir a tocarla para poder trabajar.
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--hide-crash-restore-bubble",
        "--disable-features=TranslateUI",
        "--noerrdialogs",
        "--disable-pinch",
        "--overscroll-history-navigation=0"
    )

    $proceso = Start-Process -FilePath $Navegador -ArgumentList $argumentos -PassThru
    Escribir-Log "Pantalla '$Nombre' abierta en el monitor $($limites.X),$($limites.Y) ($($limites.Width)x$($limites.Height)) -> $Url (PID $($proceso.Id))"
    return [pscustomobject]@{
        Nombre   = $Nombre
        Url      = $Url
        Pantalla = $Pantalla
        Proceso  = $proceso
    }
}

function Agregar-Parametro {
    param([string]$Url, [string]$Clave, [string]$Valor)

    $union = if ($Url.Contains("?")) { "&" } else { "?" }
    return "$Url$union$Clave=$Valor"
}

function Preparar-Pantallas {
    param([string]$Navegador)

    $monitores = Listar-Pantallas
    $abiertas = @()

    $definiciones = @(
        @{ Nombre = "pos";  Indice = (Valor $Config "PANTALLA_POS_INDICE");  Ruta = (Valor $Config "PANTALLA_POS_RUTA" "/staff/pos") },
        @{ Nombre = "caja"; Indice = (Valor $Config "PANTALLA_CAJA_INDICE"); Ruta = (Valor $Config "PANTALLA_CAJA_RUTA" "/admin/caja") }
    )

    foreach ($definicion in $definiciones) {
        if ($definicion.Indice -eq "") { continue }

        $indice = [int]$definicion.Indice
        if ($indice -ge $monitores.Count) {
            # Un monitor que se apago o se desenchufo no deja la pantalla sin
            # abrir: cae en el primero, que es mejor que no mostrar nada.
            Escribir-Log "No existe el monitor $indice para '$($definicion.Nombre)': va al 0."
            $indice = 0
        }

        $url = "$UrlSitio$($definicion.Ruta)"
        if ($definicion.Nombre -eq "pos") {
            $zonaMuerta = Valor $Config "PANTALLA_POS_ZONA_MUERTA"
            if ($zonaMuerta -ne "" -and $zonaMuerta -ne "0") {
                $url = Agregar-Parametro -Url $url -Clave "zonamuerta" -Valor $zonaMuerta
            }

            # El teclado de la app, el que se dibuja adentro de la pantalla.
            #
            # La preferencia se guarda por navegador, y esta ventana estrena un
            # perfil vacio en cada equipo nuevo: lo que se forzo alguna vez en
            # el navegador de siempre no esta aca. Por eso se manda en cada
            # arranque y no una sola vez a mano.
            $teclado = Valor $Config "PANTALLA_POS_TECLADO"
            if ($teclado -ne "") {
                $url = Agregar-Parametro -Url $url -Clave "teclado" -Valor $teclado
            }
        }

        $abiertas += Abrir-Pantalla -Nombre $definicion.Nombre -Navegador $Navegador -Url $url -Pantalla $monitores[$indice]
        # Dos navegadores que arrancan en el mismo instante se pelean el disco
        # y a veces uno queda en blanco. Un segundo alcanza.
        Start-Sleep -Seconds 1
    }

    return $abiertas
}

# --- Espera del sitio -------------------------------------------------------

function Esperar-Sitio {
    <#
      El equipo enciende antes que el wifi. Abrir el POS en ese momento pinta
      un "sin conexion" que nadie va a recargar, asi que se espera a que el
      sitio conteste; a los dos minutos se abre igual, porque una pantalla con
      un error a la vista se arregla sola al volver la red y una apagada no.
    #>
    param([int]$SegundosMaximos = 120)

    $salud = "$UrlSitio/api/health"
    $limite = (Get-Date).AddSeconds($SegundosMaximos)

    # Windows PowerShell 5.1 todavia negocia TLS 1.0 por defecto en algunos
    # equipos, y contra un sitio detras de Cloudflare eso es un error de
    # conexion que parece falta de red.
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    } catch {
        # En Windows nuevos ya viene puesto y la asignacion puede no existir.
    }

    while ((Get-Date) -lt $limite) {
        try {
            $respuesta = Invoke-WebRequest -Uri $salud -UseBasicParsing -TimeoutSec 5
            if ($respuesta.StatusCode -eq 200) {
                Escribir-Log "El sitio responde: $salud"
                return $true
            }
        } catch {
            # Todavia no hay red, o el sitio esta reiniciando. Se reintenta.
        }
        Start-Sleep -Seconds 3
    }

    Escribir-Log "El sitio no respondio en $SegundosMaximos s. Abro igual."
    return $false
}

# --- Arranque ---------------------------------------------------------------

Escribir-Log "=== Arranque del local ==="

if (-not $AgentePropio) {
    Escribir-Log "AGENTE_LEVANTAR=no: el agente de impresion queda como estaba en el equipo."
}

# Node puede faltar y el local seguir imprimiendo: si el agente del escritorio
# es un .bat, adentro va su propia forma de llamarlo. Solo se exige cuando hay
# que ejecutar print-agent.mjs directamente, y eso lo decide Levantar-Agente.
$Node = Buscar-Node
if ($AgentePropio) {
    $ProcesoAgente = Levantar-Agente -Node $Node
}

$Navegador = Buscar-Navegador
if (-not $Navegador) {
    Escribir-Log "No encuentro Chrome ni Edge: no puedo abrir ninguna pantalla."
} else {
    Esperar-Sitio | Out-Null
    $Pantallas = Preparar-Pantallas -Navegador $Navegador
}

if ($SinVigilancia) {
    Escribir-Log "Arranque hecho (-SinVigilancia): no vigilo nada."
    exit 0
}

# --- Vigilancia -------------------------------------------------------------
# Lo que se cae de noche, en un local lleno, nadie lo levanta. Cada diez
# segundos se mira que siga todo en pie y se repone lo que falte.

Escribir-Log "Vigilando el agente y las pantallas."

while ($true) {
    Start-Sleep -Seconds 10

    if ($AgentePropio -and (-not $ProcesoAgente -or $ProcesoAgente.HasExited)) {
        # Se pregunta por cualquier agente, no solo por el que levanto este
        # script: si el del escritorio esta en pie, aca no hay nada que hacer.
        if (-not (Agente-YaCorriendo)) {
            Escribir-Log "No hay ningun agente de impresion corriendo. Levanto uno."
            $ProcesoAgente = Levantar-Agente -Node $Node
        }
    }

    if ($Navegador) {
        for ($i = 0; $i -lt $Pantallas.Count; $i++) {
            $pantalla = $Pantallas[$i]
            if ($pantalla.Proceso.HasExited) {
                Escribir-Log "La pantalla '$($pantalla.Nombre)' se cerro. La abro de nuevo."
                $Pantallas[$i] = Abrir-Pantalla -Nombre $pantalla.Nombre -Navegador $Navegador `
                    -Url $pantalla.Url -Pantalla $pantalla.Pantalla
            }
        }
    }
}
