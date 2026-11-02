@echo off
rem Lanzador de AFix para el acceso directo del escritorio: levanta el agente USB y la
rem app, y abre el navegador. Cerrar esta ventana cierra AFix.
title AFix
cd /d "%~dp0.."
call npm run taller
if errorlevel 1 (
  echo.
  echo AFix no pudo arrancar. Revisa el mensaje de arriba.
  pause
)
