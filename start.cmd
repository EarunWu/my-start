@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0serve.py" --open
) else (
  python "%~dp0serve.py" --open
)
if errorlevel 1 pause
