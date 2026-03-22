# Caller 项目说明

本项目用于自动化执行 Google 关键词检索，并按指定公司识别词进行命中判断、深度翻查与日志记录。

## 1. 业务流程

1. 打开浏览器并进入 Google。
2. 从 `keywords.csv` 读取关键词，按顺序逐个搜索。
3. 在每页结果中匹配 `info.csv` 中的公司识别词。
4. 命中后进入结果页，慢速下拉并继续站内翻查。
5. 回到 Google 继续下一页，直到末页。
6. 切换下一个关键词，重复以上过程。

## 2. 文件说明

- `google_caller.js`：主程序。
- `keywords.csv`：关键词输入，每行一个词。
- `info.csv`：识别词输入，每行一个词。
- `start.bat`：Windows 批处理启动脚本。
- `setup-local.bat`：Windows 一键本地环境配置。
- `LOG-YYMMDD.TXT`：每日运行日志，例如 `LOG-260322.TXT`。

## 3. 环境要求

- Node.js 18+（建议 LTS 版本）
- 可访问 Google 的网络环境

### 3.1 Windows 安装 Node.js（首次使用必看）

1. 打开 Node.js 官网下载页：https://nodejs.org/
2. 下载并安装 `LTS` 版本（默认选项一路 Next 即可）。
3. 安装完成后，关闭并重新打开终端。
4. 验证安装：

```powershell
node -v
npm -v
```

若提示“不是内部或外部命令”，通常是 PATH 尚未生效：

1. 重新打开终端后再试。
2. 若仍失败，重启系统后重试。
3. 仍有问题时，重新安装 Node.js 并确认勾选“Add to PATH”。

## 4. 安装与运行

一键配置本地环境（推荐）：

```bash
npm run setup
```

或 Windows 双击：

- `setup-local.bat`

上述步骤会自动执行：

1. `npm install`
2. `npx playwright install chromium`

手动安装（等价流程）：

```bash
npm install
npx playwright install chromium
```

常规运行：

```bash
npm start
```

Windows 快速启动：

- 双击 `start.bat`

`start.bat` 的“修改配置”菜单会自动把设置保存到本地 `start.local.env.bat`，下次启动会自动加载。

`start.bat` 交互菜单说明：

1. 主菜单包含：启动项目 / 修改配置 / 退出。
2. 修改配置菜单会展示每个变量的中文释义、变量名和当前值。
3. 修改任意配置后会立即写入 `start.local.env.bat`。
4. 当前菜单输入模式为数字输入后回车（兼容模式）。

## 5. 可选环境变量

基础行为：

- `HEADLESS=1`：无头模式运行（默认显示浏览器）。
- `MAX_GOOGLE_PAGES=20`：每个关键词最多翻查页数。
- `DWELL_MS_PER_PAGE=120000`：每页停留时长（毫秒）。
- `DEEP_BROWSE_PAGES=3`：命中后站内继续翻查页数。
- `PROCESS_ALL_HITS_IN_PAGE=1`：同页命中是否全部处理（默认只处理第一个）。

Clash 切换（可选）：

- `USE_CLASH_SWITCH=1`：`start.bat` 中的模式开关；`1` 使用 Clash，`0` 关闭 Clash 切换。
- `ENABLE_CLASH_SWITCH=1`：启用节点自动切换。
- `LOCAL_DEFAULT_PROXY=http://127.0.0.1:7890`：当 `USE_CLASH_SWITCH=0` 时生效的本地默认代理地址（在 `start.bat` 中配置）。
- `SWITCH_NODE_INTERVAL=5`：每 N 个关键词切换一次。
- `CLASH_API_HOST=127.0.0.1`：Clash API 主机。
- `CLASH_API_PORT=16296`：Clash API 端口（与默认启动脚本一致）。
- `CLASH_API_SECRET=`：Clash API 密钥（如有）。
- `CLASH_PROXY_GROUP=`：指定代理组（默认首个 Selector 组）。
- `CLEAR_COOKIES_ON_SWITCH=1`：切换时清空 Cookie。
- `PAUSE_AFTER_SWITCH_MS=5000`：切换后暂停毫秒数。

PowerShell 示例：

```powershell
$env:HEADLESS='0'
$env:MAX_GOOGLE_PAGES='15'
$env:DWELL_MS_PER_PAGE='120000'
$env:DEEP_BROWSE_PAGES='3'
npm start
```

## 6. 新功能说明

- `STATUS_BAR=1`：启用运行时状态栏，实时显示进度。
- `LOOP_ALL_KEYWORDS=1`：启用关键词循环模式，所有关键词轮询执行。

## 7. 输入文件格式

- 文件编码：UTF-8
- 无表头
- 每行一个完整词条
- 行首行尾空格会被自动 trim
- 空行会被忽略

示例 `keywords.csv`：

```text
Optic FIC
Optic fast connector SC
```

示例 `info.csv`：

```text
Qyftth
Ysfiber
```

## 8. 日志格式

每个关键词至少输出一行汇总：

- 命中示例：`关键词 - P1-P2-P3-P4✔-P5`
- 未命中示例：`关键词 - P1-P2-P3-P4-到末页`

命中时追加详情行：

- `关键词-P页码-Google命中链接-翻查链接1-翻查链接2`

## 9. 协作规范

- 尽量只修改自己负责的文件，避免并发冲突。
- 修改 `google_caller.js` 时，保持日志主格式兼容。
- 新增配置优先使用环境变量，避免硬编码。
- 若调整输入格式，必须同步更新本文件对应章节。

## 10. 常见问题

1. 报错 `Executable doesn't exist`
   处理：执行 `npx playwright install chromium`。

2. Playwright 下载失败
   处理：配置代理后重试。

```bash
npm config set proxy http://127.0.0.1:7890
npm config set https-proxy http://127.0.0.1:7890
```

## 11. Agent 代安装说明

如果你希望让 AI Agent 代你执行安装，可在 VS Code 的 Copilot Chat 中直接发送下面这段指令：

```text
请在当前仓库完成本地环境安装并回报结果：
1) 检查 Node.js 和 npm 是否可用（输出 node -v、npm -v）；
2) 如果缺少 Node.js，先给出安装指引并等待我确认；
3) 执行 npm run setup；
4) 验证 Playwright Chromium 是否可用；
5) 最后给出“是否可直接运行 npm start”的结论。
```

说明：

- 本仓库的一键安装命令是 `npm run setup`。
- Windows 也可直接双击 `setup-local.bat`。

