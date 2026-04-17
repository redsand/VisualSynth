@echo off
setlocal

set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "USER_DATA_DIR=C:\Users\TimShelton\source\repos\VisualSynth\.tmp\edge-audit-fixed2"
set "DEBUG_PORT=9227"

if not exist "%EDGE_EXE%" (
  echo Edge executable not found at "%EDGE_EXE%"
  exit /b 1
)

if not exist "%USER_DATA_DIR%" (
  mkdir "%USER_DATA_DIR%"
)

echo Launching Edge audit browser on http://127.0.0.1:%DEBUG_PORT%

start "" "%EDGE_EXE%" ^
  --headless=new ^
  --no-sandbox ^
  --disable-gpu ^
  --test-type ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-background-networking ^
  --disable-component-update ^
  --metrics-recording-only ^
  --remote-allow-origins=* ^
  --remote-debugging-port=%DEBUG_PORT% ^
  --user-data-dir="%USER_DATA_DIR%" ^
  about:blank

echo.
echo Verify with:
echo   Invoke-WebRequest -UseBasicParsing http://127.0.0.1:%DEBUG_PORT%/json/version
