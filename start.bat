@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "CONFIG_FILE=%~dp0start.local.env.bat"

rem 控制台编码设置。脚本主体保持稳定结构以确保兼容性。
set "CONSOLE_CODE_PAGE=65001"
chcp %CONSOLE_CODE_PAGE% >nul

rem 代理模式控制
rem 1 = 使用 Clash API 自动切换节点
rem 0 = 关闭 Clash 切换并使用 LOCAL_DEFAULT_PROXY
set USE_CLASH_SWITCH=1

rem 关闭 Clash 时使用的本地默认代理（留空则系统默认）
set LOCAL_DEFAULT_PROXY=http://127.0.0.1:7890

rem Clash API 配置
set CLASH_API_PORT=16296
set CLASH_API_HOST=127.0.0.1

rem Clash 模式下可选代理地址
set CLASH_LOCAL_PROXY=http://127.0.0.1:7890

rem 每 N 个关键词切换一次节点
set SWITCH_NODE_INTERVAL=5

rem 切换节点时清理 Cookie（1=是，0=否）
set CLEAR_COOKIES_ON_SWITCH=1

rem 切换后暂停时长（毫秒）
set PAUSE_AFTER_SWITCH_MS=5000

rem 浏览器显示模式（0=显示窗口，1=无头）
set HEADLESS=0

rem 可选设置（取消注释即可启用）
rem set CLASH_API_SECRET=your-secret-key
rem set CLASH_PROXY_GROUP=Auto
rem set MAX_GOOGLE_PAGES=20
rem set DWELL_MS_PER_PAGE=120000
rem set DEEP_BROWSE_PAGES=3

call :LoadLocalConfig

:MAIN_MENU
call :SelectMenu "主菜单" "启动项目;修改配置;退出" MAIN_CHOICE
if "%MAIN_CHOICE%"=="1" (
  call :StartProject
  goto MAIN_MENU
)
if "%MAIN_CHOICE%"=="2" (
  call :EditConfigMenu
  goto MAIN_MENU
)
if "%MAIN_CHOICE%"=="3" goto END

echo 选项无效，正在返回菜单...
timeout /t 1 >nul
goto MAIN_MENU

:EditConfigMenu
:CONFIG_MENU
set "CONFIG_OPTIONS=是否启用Clash切换（USE_CLASH_SWITCH）：!USE_CLASH_SWITCH!;本地默认代理（LOCAL_DEFAULT_PROXY）：!LOCAL_DEFAULT_PROXY!;Clash API主机（CLASH_API_HOST）：!CLASH_API_HOST!;Clash API端口（CLASH_API_PORT）：!CLASH_API_PORT!;Clash本地代理（CLASH_LOCAL_PROXY）：!CLASH_LOCAL_PROXY!;节点切换间隔（SWITCH_NODE_INTERVAL）：!SWITCH_NODE_INTERVAL!;切换时清理Cookie（CLEAR_COOKIES_ON_SWITCH）：!CLEAR_COOKIES_ON_SWITCH!;切换后暂停毫秒（PAUSE_AFTER_SWITCH_MS）：!PAUSE_AFTER_SWITCH_MS!;无头模式（HEADLESS）：!HEADLESS!;返回"
call :SelectMenu "修改配置" "!CONFIG_OPTIONS!" CONFIG_CHOICE

if "%CONFIG_CHOICE%"=="1" (
  call :EditVar USE_CLASH_SWITCH "是否启用 Clash 切换（1 或 0）"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="2" (
  call :EditVar LOCAL_DEFAULT_PROXY "本地默认代理（例如：http://127.0.0.1:7890）"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="3" (
  call :EditVar CLASH_API_HOST "Clash API 主机"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="4" (
  call :EditVar CLASH_API_PORT "Clash API 端口"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="5" (
  call :EditVar CLASH_LOCAL_PROXY "Clash 本地代理（例如：http://127.0.0.1:7890）"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="6" (
  call :EditVar SWITCH_NODE_INTERVAL "节点切换间隔"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="7" (
  call :EditVar CLEAR_COOKIES_ON_SWITCH "切换时清理 Cookie（1 或 0）"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="8" (
  call :EditVar PAUSE_AFTER_SWITCH_MS "切换后暂停时间（毫秒）"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="9" (
  call :EditVar HEADLESS "无头模式（1 或 0）"
  goto CONFIG_MENU
)
if "%CONFIG_CHOICE%"=="10" exit /b

exit /b

:EditVar
set "VAR_NAME=%~1"
set "VAR_DESC=%~2"
cls
echo ==========================================
echo   修改环境变量
echo ==========================================
echo %VAR_DESC%
echo 当前值：!%VAR_NAME%!
echo.
set "NEW_VALUE="
set /p "NEW_VALUE=请输入新值（直接回车保持不变）："
if defined NEW_VALUE (
  set "%VAR_NAME%=%NEW_VALUE%"
  call :SaveLocalConfig
  echo.
  echo 已更新：%VAR_NAME%=!%VAR_NAME%!
  echo 已保存到：%CONFIG_FILE%
) else (
  echo.
  echo 未做修改。
)
echo.
echo 按任意键继续...
pause >nul
exit /b

:StartProject
call :ApplyProxyMode
cls
echo ==========================================
echo   Google Caller - 启动脚本
echo ==========================================
echo.
call :PrintSettings
echo.
echo 正在启动...
echo ==========================================
echo.

call npm start

echo.
echo ==========================================
echo 按任意键返回菜单...
pause >nul
exit /b

:ApplyProxyMode
if "%USE_CLASH_SWITCH%"=="1" (
  set ENABLE_CLASH_SWITCH=1
  if not "%CLASH_LOCAL_PROXY%"=="" (
    set HTTP_PROXY=%CLASH_LOCAL_PROXY%
    set HTTPS_PROXY=%CLASH_LOCAL_PROXY%
    set ALL_PROXY=%CLASH_LOCAL_PROXY%
  ) else (
    set HTTP_PROXY=
    set HTTPS_PROXY=
    set ALL_PROXY=
  )
) else (
  set ENABLE_CLASH_SWITCH=0
  if not "%LOCAL_DEFAULT_PROXY%"=="" (
    set HTTP_PROXY=%LOCAL_DEFAULT_PROXY%
    set HTTPS_PROXY=%LOCAL_DEFAULT_PROXY%
    set ALL_PROXY=%LOCAL_DEFAULT_PROXY%
  ) else (
    set HTTP_PROXY=
    set HTTPS_PROXY=
    set ALL_PROXY=
  )
)
exit /b

:PrintSettings
echo [当前配置]
echo Clash 切换开关: %USE_CLASH_SWITCH%
echo 启用 Clash 自动切换: %ENABLE_CLASH_SWITCH%
echo Clash API: %CLASH_API_HOST%:%CLASH_API_PORT%
if "%USE_CLASH_SWITCH%"=="1" (
  echo 代理模式: Clash
  if not "%CLASH_LOCAL_PROXY%"=="" echo 代理地址: %CLASH_LOCAL_PROXY%
) else (
  if not "%LOCAL_DEFAULT_PROXY%"=="" (
    echo 代理模式: 本地默认代理
    echo 代理地址: %LOCAL_DEFAULT_PROXY%
  ) else (
    echo 代理模式: 系统默认 ^(未设置显式环境代理^)
  )
)
echo 节点切换间隔: 每 %SWITCH_NODE_INTERVAL% 个关键词
echo 切换时清理 Cookie: %CLEAR_COOKIES_ON_SWITCH%
echo 无头模式: %HEADLESS%
exit /b

:SelectMenu
set "MENU_TITLE=%~1"
set "MENU_OPTIONS=%~2"
set "MENU_RESULT="
set "MENU_COUNT=0"
for %%A in ("%MENU_OPTIONS:;=" "%") do set /a MENU_COUNT+=1
if %MENU_COUNT% LEQ 0 (
  set "%~3=1"
  exit /b
)

cls
echo ==========================================
echo   Google Caller - 启动脚本
echo ==========================================
echo.
echo [%MENU_TITLE%]
set /a MENU_INDEX=0
for %%A in ("%MENU_OPTIONS:;=" "%") do (
  set /a MENU_INDEX+=1
  set "MENU_ITEM=%%~A"
  echo   !MENU_INDEX!. !MENU_ITEM!
)
echo.
echo Enter the option number, then press Enter.
:MENU_INPUT
set "MENU_RESULT="
set /p "MENU_RESULT=Select (1-%MENU_COUNT%): "
if not defined MENU_RESULT set "MENU_RESULT=1"

set /a MENU_NUM=%MENU_RESULT% >nul 2>nul
if errorlevel 1 (
  echo Invalid input. Please enter digits only.
  goto MENU_INPUT
)

if %MENU_NUM% LSS 1 (
  echo Out of range. Please try again.
  goto MENU_INPUT
)
if %MENU_NUM% GTR %MENU_COUNT% (
  echo Out of range. Please try again.
  goto MENU_INPUT
)

set "%~3=%MENU_NUM%"
exit /b

:LoadLocalConfig
if exist "%CONFIG_FILE%" (
  call "%CONFIG_FILE%"
)
exit /b

:SaveLocalConfig
(
  echo @echo off
  echo rem 是否启用 Clash 节点切换：1=启用，0=关闭（关闭时使用 LOCAL_DEFAULT_PROXY）
  echo set "USE_CLASH_SWITCH=%USE_CLASH_SWITCH%"
  echo rem 本地默认代理地址（仅在 USE_CLASH_SWITCH=0 时生效，留空则系统默认）
  echo set "LOCAL_DEFAULT_PROXY=%LOCAL_DEFAULT_PROXY%"
  echo rem Clash API 主机地址
  echo set "CLASH_API_HOST=%CLASH_API_HOST%"
  echo rem Clash API 端口
  echo set "CLASH_API_PORT=%CLASH_API_PORT%"
  echo rem Clash 模式下浏览器使用的本地代理地址
  echo set "CLASH_LOCAL_PROXY=%CLASH_LOCAL_PROXY%"
  echo rem 每处理多少个关键词切换一次节点
  echo set "SWITCH_NODE_INTERVAL=%SWITCH_NODE_INTERVAL%"
  echo rem 切换节点时是否清空 Cookie：1=是，0=否
  echo set "CLEAR_COOKIES_ON_SWITCH=%CLEAR_COOKIES_ON_SWITCH%"
  echo rem 每次切换节点后暂停时长（毫秒）
  echo set "PAUSE_AFTER_SWITCH_MS=%PAUSE_AFTER_SWITCH_MS%"
  echo rem 浏览器模式：0=显示窗口，1=无头模式
  echo set "HEADLESS=%HEADLESS%"
  if defined CLASH_API_SECRET echo rem Clash API 鉴权密钥（如你的 Clash 开启了 secret）
  if defined CLASH_API_SECRET echo set "CLASH_API_SECRET=%CLASH_API_SECRET%"
  if defined CLASH_PROXY_GROUP echo rem 指定切换的代理组名称（留空则自动选择）
  if defined CLASH_PROXY_GROUP echo set "CLASH_PROXY_GROUP=%CLASH_PROXY_GROUP%"
) > "%CONFIG_FILE%"
exit /b

:END
endlocal
exit /b 0
