@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo   Caller - One Click Local Setup
echo ==========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-local.ps1" -NoPause
set EXIT_CODE=%ERRORLEVEL%

echo.
if "%EXIT_CODE%"=="0" (
  echo Setup completed successfully.
) else (
  echo Setup failed with exit code %EXIT_CODE%.
)
echo.
echo Press any key to exit...
pause >nul
exit /b %EXIT_CODE%
