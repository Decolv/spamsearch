@echo off
rem 是否启用 Clash 节点切换：1=启用，0=关闭（关闭时使用 LOCAL_DEFAULT_PROXY）
set "USE_CLASH_SWITCH=0"
rem 本地默认代理地址（仅在 USE_CLASH_SWITCH=0 时生效，留空则系统默认）
set "LOCAL_DEFAULT_PROXY=http://127.0.0.1:7890"
rem Clash API 主机地址
set "CLASH_API_HOST=127.0.0.1"
rem Clash API 端口
set "CLASH_API_PORT=16296"
rem Clash 模式下浏览器使用的本地代理地址
set "CLASH_LOCAL_PROXY=http://127.0.0.1:7890"
rem 每处理多少个关键词切换一次节点
set "SWITCH_NODE_INTERVAL=5"
rem 切换节点时是否清空 Cookie：1=是，0=否
set "CLEAR_COOKIES_ON_SWITCH=1"
rem 每次切换节点后暂停时长（毫秒）
set "PAUSE_AFTER_SWITCH_MS=5000"
rem 浏览器模式：0=显示窗口，1=无头模式
set "HEADLESS=0"
rem 运行期状态栏：1=开启，0=关闭
set "STATUS_BAR=1"
