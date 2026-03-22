@echo off
setlocal
chcp 65001 >nul

echo ==========================================
echo   Caller - One Click Local Setup
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Please install Node.js 18+ and retry.
  set EXIT_CODE=1
  goto :END
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found. Please make sure Node.js is installed correctly.
  set EXIT_CODE=1
  goto :END
)

echo Detected Node.js:
node -v
echo Detected npm:
npm -v
echo.

echo [1/2] Installing project dependencies via npm install
call npm install
if errorlevel 1 (
  set EXIT_CODE=%ERRORLEVEL%
  goto :END
)

echo.
echo [2/2] Installing Playwright Chromium
call npx playwright install chromium
set EXIT_CODE=%ERRORLEVEL%

:END

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
