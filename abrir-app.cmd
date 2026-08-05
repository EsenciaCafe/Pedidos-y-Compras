@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo No se ha encontrado Python en este equipo.
  echo Instala Python o publica la aplicacion en un servidor web.
  pause
  exit /b 1
)
start "Esencia - servidor local" /min python -m http.server 4173 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
endlocal
