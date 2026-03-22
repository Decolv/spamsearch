# Google Caller - 一键启动脚本 (PowerShell)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Google Caller - 一键启动脚本" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 设置Clash API配置
$env:ENABLE_CLASH_SWITCH = "1"
$env:CLASH_API_PORT = "16296"
$env:CLASH_API_HOST = "127.0.0.1"

# 设置切换间隔（每N个关键词切换一次节点）
$env:SWITCH_NODE_INTERVAL = "5"

# 设置是否清空cookie（1=清空，0=保留）
$env:CLEAR_COOKIES_ON_SWITCH = "1"

# 设置切换后暂停时间（毫秒）
$env:PAUSE_AFTER_SWITCH_MS = "5000"

# 浏览器显示设置（0=显示窗口，1=无头模式）
$env:HEADLESS = "0"

# 其他可选配置（取消注释即可启用）
# $env:CLASH_API_SECRET = "your-secret-key"
# $env:CLASH_PROXY_GROUP = "自动选择"
# $env:MAX_GOOGLE_PAGES = "20"
# $env:DWELL_MS_PER_PAGE = "120000"
# $env:DEEP_BROWSE_PAGES = "3"

Write-Host "[配置信息]" -ForegroundColor Yellow
Write-Host "Clash API: $($env:CLASH_API_HOST):$($env:CLASH_API_PORT)" -ForegroundColor Green
Write-Host "节点切换: 每 $($env:SWITCH_NODE_INTERVAL) 个关键词" -ForegroundColor Green
Write-Host "清空Cookie: $($env:CLEAR_COOKIES_ON_SWITCH)" -ForegroundColor Green
Write-Host ""
Write-Host "正在启动..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

try {
    npm start
} catch {
    Write-Host "发生错误: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
