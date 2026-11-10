@echo off
rem SEEDPOD checks (ASCII only: cmd code page mangles UTF-8 Chinese)
rem Set PTA_NODE / PTA_PW when node and playwright-core are not on PATH.
setlocal
cd /d "%~dp0..\.."
if not defined PTA_NODE set PTA_NODE=node
if not defined PTA_PW set PTA_PW=%TEMP%\pta-shot\node_modules\playwright-core

echo ==== smoke (feature assertions) ====
"%PTA_NODE%" pta\checks\smoke.js
set SMOKE=%errorlevel%

echo.
echo ==== audit (every clickable element) ====
"%PTA_NODE%" pta\checks\audit.js
set AUDIT=%errorlevel%

echo.
echo ==== adapter (site parsers, offline) ====
"%PTA_NODE%" pta\checks\adapter.js
set ADAPTER=%errorlevel%

echo.
echo ==== api (backend contract) ====
if not defined PTA_NODE set PTA_NODE=node
"%PTA_NODE%" pta\checks\api.js
set APIC=%errorlevel%

echo.
if %SMOKE%==0 if %AUDIT%==0 if %ADAPTER%==0 if %APIC%==0 (
  echo ALL CHECKS PASSED
  exit /b 0
)
echo FAILED: smoke=%SMOKE% audit=%AUDIT% adapter=%ADAPTER% api=%APIC%
exit /b 1
