@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

set "EXIT_CODE=0"
set "PLAYWRIGHT_INSTALL_RETRIES=3"

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

if exist "start.local.env.bat" (
  call start.local.env.bat >nul 2>nul
)

if not defined HTTP_PROXY (
  if defined LOCAL_DEFAULT_PROXY (
    set "HTTP_PROXY=%LOCAL_DEFAULT_PROXY%"
  )
)

if not defined HTTPS_PROXY (
  if defined LOCAL_DEFAULT_PROXY (
    set "HTTPS_PROXY=%LOCAL_DEFAULT_PROXY%"
  )
)

if not defined PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT (
  set "PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000"
)

if not defined PLAYWRIGHT_DOWNLOAD_HOST (
  set "PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright"
  set "PLAYWRIGHT_DOWNLOAD_HOST_FROM_SETUP=1"
)

echo [1/2] Installing project dependencies via npm install
call npm install
if errorlevel 1 (
  set EXIT_CODE=%ERRORLEVEL%
  goto :END
)

echo.
echo [2/2] Installing Playwright Chromium
if defined HTTP_PROXY echo HTTP_PROXY=%HTTP_PROXY%
if defined HTTPS_PROXY echo HTTPS_PROXY=%HTTPS_PROXY%
if defined PLAYWRIGHT_DOWNLOAD_HOST echo PLAYWRIGHT_DOWNLOAD_HOST=%PLAYWRIGHT_DOWNLOAD_HOST%
if defined PLAYWRIGHT_DOWNLOAD_HOST_FROM_SETUP echo Mirror source is temporary for this setup run only.
echo PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=%PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT%
echo.

set /a "PW_TRY=1"
:PW_INSTALL_RETRY
echo Attempt !PW_TRY!/%PLAYWRIGHT_INSTALL_RETRIES%: npx playwright install chromium
call npx playwright install chromium
if not errorlevel 1 goto :PW_INSTALL_OK

set EXIT_CODE=%ERRORLEVEL%
if !PW_TRY! GEQ %PLAYWRIGHT_INSTALL_RETRIES% goto :PW_INSTALL_FAIL

echo Download failed, retrying in 5 seconds...
timeout /t 5 /nobreak >nul
set /a "PW_TRY+=1"
goto :PW_INSTALL_RETRY

:PW_INSTALL_OK
set EXIT_CODE=0
goto :END

:PW_INSTALL_FAIL
echo.
echo Playwright browser download failed after %PLAYWRIGHT_INSTALL_RETRIES% attempts.
echo If network is unstable, set a proxy and retry:
echo   set HTTP_PROXY=http://127.0.0.1:7890
echo   set HTTPS_PROXY=http://127.0.0.1:7890
echo You can also set a mirror host, then rerun setup:
echo   set PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net
echo   set PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
goto :END

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
