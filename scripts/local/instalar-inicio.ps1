<#
================================================================================
 BARZUO - deja el arranque del local registrado en Windows

 Registra "barzuo-inicio.ps1" como tarea programada al iniciar sesion, para
 que el PC del local abra solo el POS y las ventas del dia cada vez que se
 enciende. Se corre UNA vez, al configurar el equipo.

   # Ver que monitor es cual antes de configurar
   powershell -ExecutionPolicy Bypass -File scripts\local\instalar-inicio.ps1 -Pantallas

   # Registrar
   powershell -ExecutionPolicy Bypass -File scripts\local\instalar-inicio.ps1

   # Quitar
   powershell -ExecutionPolicy Bypass -File scripts\local\instalar-inicio.ps1 -Quitar

 Falta una pieza que no se automatiza desde aca: el equipo tiene que iniciar
 sesion solo. Se activa en "netplwiz" -desmarcar "Los usuarios deben escribir
 su nombre y contrasena"-. Sin eso, Windows arranca hasta la pantalla de
 bloqueo y ahi se queda, esperando a alguien.
================================================================================
#>

[CmdletBinding()]
param(
    # Lista los monitores con su indice, para llenar PANTALLA_*_INDICE.
    [switch]$Pantallas,
    # Borra la tarea programada.
    [switch]$Quitar
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$NombreTarea = "BARZUO - arranque del local"
$RaizScript = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptArranque = Join-Path $RaizScript "barzuo-inicio.ps1"

if ($Pantallas) {
    Add-Type -AssemblyName System.Windows.Forms
    $monitores = @([System.Windows.Forms.Screen]::AllScreens | Sort-Object { $_.Bounds.X })

    Write-Host ""
    Write-Host "Monitores, de izquierda a derecha:"
    Write-Host ""
    for ($i = 0; $i -lt $monitores.Count; $i++) {
        $limites = $monitores[$i].Bounds
        $principal = if ($monitores[$i].Primary) { "  (principal)" } else { "" }
        Write-Host ("  indice {0}   {1}x{2} en {3},{4}   {5}{6}" -f `
            $i, $limites.Width, $limites.Height, $limites.X, $limites.Y, $monitores[$i].DeviceName, $principal)
    }
    Write-Host ""
    Write-Host "Escribe esos indices en barzuo-local.env (PANTALLA_POS_INDICE y PANTALLA_CAJA_INDICE)."
    Write-Host "Si no distingues cual es cual, mueve una ventana al monitor tactil y mira en que rango de X queda."
    Write-Host ""
    exit 0
}

if ($Quitar) {
    if (Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false
        Write-Host "Tarea '$NombreTarea' eliminada. El equipo ya no abre nada solo."
    } else {
        Write-Host "No habia ninguna tarea '$NombreTarea' registrada."
    }
    exit 0
}

if (-not (Test-Path $ScriptArranque)) {
    Write-Error "No encuentro $ScriptArranque."
    exit 1
}

$RutaEnv = Join-Path $RaizScript "barzuo-local.env"
if (-not (Test-Path $RutaEnv)) {
    Write-Error "Falta $RutaEnv. Copia barzuo-local.env.example, completalo y vuelve a correr esto."
    exit 1
}

$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptArranque`"" `
    -WorkingDirectory $RaizScript

$disparador = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

# Sin limite de tiempo: el script se queda vigilando toda la noche, y una tarea
# con el limite de tres dias que trae Windows por defecto se corta sola.
# MultipleInstances IgnoreNew evita dos POS abiertos si alguien cierra sesion
# y vuelve a entrar.
$ajustes = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador `
    -Settings $ajustes -Description "Levanta el agente de impresion y abre el POS y las ventas del dia en sus monitores." `
    -Force | Out-Null

Write-Host ""
Write-Host "Listo: '$NombreTarea' registrada para $env:USERNAME."
Write-Host ""
Write-Host "Falta, una sola vez:"
Write-Host "  1. Activar el inicio de sesion automatico en 'netplwiz'."
Write-Host "  2. Reiniciar y entrar en cada pantalla con su usuario (la tactil como sala, el PC como admin)."
Write-Host "     La sesion dura 7 dias, asi que hay que repetirlo una vez por semana."
Write-Host "  3. En Configuracion -> Sistema -> Energia, dejar la pantalla y el equipo en 'Nunca'."
Write-Host "  4. En la BIOS, activar el encendido tras un corte de luz ('Restore on AC power loss' -> Power On)."
Write-Host ""
Write-Host "Para probarlo sin reiniciar:"
Write-Host "  Start-ScheduledTask -TaskName '$NombreTarea'"
Write-Host ""
