@echo off
chcp 65001 >nul
echo ==========================================
echo   Google Caller - Start Script
echo ==========================================
echo.

:: Clash API Settings
set ENABLE_CLASH_SWITCH=1
set CLASH_API_PORT=16296
set CLASH_API_HOST=127.0.0.1

:: Switch node every N keywords
set SWITCH_NODE_INTERVAL=5

:: Clear cookies on switch (1=yes, 0=no)
set CLEAR_COOKIES_ON_SWITCH=1

:: Pause after switch (milliseconds)
set PAUSE_AFTER_SWITCH_MS=5000

:: Browser display (0=show window, 1=headless)
set HEADLESS=0

:: Optional settings (uncomment to use)
:: set CLASH_API_SECRET=your-secret-key
:: set CLASH_PROXY_GROUP=Auto
:: set MAX_GOOGLE_PAGES=20
:: set DWELL_MS_PER_PAGE=120000
:: set DEEP_BROWSE_PAGES=3

echo [Settings]
echo Clash API: %CLASH_API_HOST%:%CLASH_API_PORT%
echo Switch Interval: %SWITCH_NODE_INTERVAL% keywords
echo Clear Cookies: %CLEAR_COOKIES_ON_SWITCH%
echo.
echo Starting...
echo ==========================================
echo.

call npm start

echo.
echo ==========================================
echo Press any key to exit...
pause >nul
