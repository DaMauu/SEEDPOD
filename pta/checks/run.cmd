@echo off
rem SEEDPOD 回归检查（Windows）
rem 需要 node 和 playwright-core。没有就先把 PTA_NODE / PTA_PW 指过去：
rem   set PTA_NODE=C:\path\to\node.exe
rem   set PTA_PW=C:\path\to\playwright-core
setlocal
cd /d "%~dp0..\.."
if not defined PTA_NODE set PTA_NODE=node
if not defined PTA_PW set PTA_PW=%TEMP%\pta-shot\node_modules\playwright-core
"%PTA_NODE%" pta\checks\smoke.js
exit /b %errorlevel%
