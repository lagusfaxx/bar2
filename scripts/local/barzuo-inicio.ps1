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

function Levantar-Agente {
    param([string]$Node)

    $script = Join-Path $RaizRepo "scripts\print-agent.mjs"
    if (-not (Test-Path $script)) {
        Escribir-Log "No encuentro $script: el agente de impresion no arranca."
        return $null
    }
    if ($TokenImpresion -eq "") {
        Escribir-Log "PRINT_AGENT_TOKEN vacio en barzuo-local.env: no salen comandas."
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

    $proceso = Start-Process -FilePath $Node -ArgumentList @("`"$script`"") `
        -WorkingDirectory $RaizRepo -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $salida -RedirectStandardError $errores
    Escribir-Log "Agente de impresion levantado (PID $($proceso.Id))."
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
                $union = if ($url.Contains("?")) { "&" } else { "?" }
                $url = "$url${union}zonamuerta=$zonaMuerta"
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

$Node = Buscar-Node
if (-not $Node) {
    Escribir-Log "No encuentro node.exe. Instala Node 18 o superior desde nodejs.org."
} else {
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

    if ($Node -and (-not $ProcesoAgente -or $ProcesoAgente.HasExited)) {
        Escribir-Log "El agente de impresion no esta corriendo. Lo levanto de nuevo."
        $ProcesoAgente = Levantar-Agente -Node $Node
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
