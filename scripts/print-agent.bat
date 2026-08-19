@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

rem ===========================================================================
rem  Agente de impresion de BARZUO — arranque en el PC del local (Windows)
rem
rem  Doble clic para iniciarlo. Deja la ventana abierta: mientras este abierta,
rem  las comandas se imprimen. Si se cierra, dejan de imprimirse.
rem
rem  La configuracion se edita UNA VEZ, aca abajo. No hace falta escribir nada
rem  en PowerShell ni acordarse de las variables cada noche.
rem ===========================================================================

rem --- 1. La direccion del sitio, sin barra al final ---
set "BARZUO_URL=https://barzuo.com"

rem --- 2. El mismo token que esta en el servidor (PRINT_AGENT_TOKEN) ---
set "PRINT_AGENT_TOKEN=PEGA-AQUI-EL-TOKEN"

rem --- 3. La impresora ---
rem  En Windows no sirve una ruta de dispositivo: hay que compartir la
rem  impresora (clic derecho -> Propiedades de impresora -> Compartir, con un
rem  nombre SIN espacios) y apuntar al recurso compartido.
set "PRINTER_DEFAULT=\\localhost\POS80"

rem --- 4. Opcional: propina sugerida en el papel del cliente. 0 la apaga. ---
set "PRINT_TIP_PERCENT=10"

rem ===========================================================================
rem  De aca para abajo no hay que tocar nada.
rem ===========================================================================

cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js en este PC.
  echo   Instalalo desde https://nodejs.org  ^(version 18 o superior^)
  echo.
  pause
  exit /b 1
)

if "%PRINT_AGENT_TOKEN%"=="PEGA-AQUI-EL-TOKEN" (
  echo.
  echo   Falta configurar el token.
  echo   Abri este archivo con el Bloc de notas y completa PRINT_AGENT_TOKEN.
  echo.
  pause
  exit /b 1
)

if /i "%~1"=="prueba" (
  echo.
  echo   Sacando los papeles de prueba...
  echo.
  node scripts\print-agent.mjs --test
  echo.
  pause
  exit /b 0
)

echo.
echo   Agente de impresion BARZUO
echo   Deja esta ventana abierta durante el servicio.
echo   Para detenerlo: Ctrl+C, o cerrar la ventana.
echo.

rem Si el agente se cae —se corto internet, se reinicio el router— se levanta
rem solo a los cinco segundos. Nadie del local tiene por que darse cuenta.
:reintentar
node scripts\print-agent.mjs
echo.
echo   El agente se detuvo. Reintentando en 5 segundos...
timeout /t 5 /nobreak >nul
goto reintentar
