const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { ClashController } = require('./clash-controller');
const { getStealthInitScript } = require('./stealth-utils');

const CONFIG = {
  googleUrl: process.env.GOOGLE_URL || 'https://www.google.com/',
  headless: process.env.HEADLESS === '1',
  maxGooglePages: Number(process.env.MAX_GOOGLE_PAGES || 10),
  dwellMsPerPage: Number(process.env.DWELL_MS_PER_PAGE || 30000),
  deepBrowsePages: Number(process.env.DEEP_BROWSE_PAGES || 2),
  perKeywordPauseMs: Number(process.env.PER_KEYWORD_PAUSE_MS || 8000),
  processAllHitsInPage: process.env.PROCESS_ALL_HITS_IN_PAGE === '1',
  switchNodeInterval: Number(process.env.SWITCH_NODE_INTERVAL || 5),
  enableClashSwitch: process.env.ENABLE_CLASH_SWITCH === '1',
  clashProxyGroup: process.env.CLASH_PROXY_GROUP || '',
  clearCookiesOnSwitch: process.env.CLEAR_COOKIES_ON_SWITCH !== '0',
  randomDelayMin: Number(process.env.RANDOM_DELAY_MIN || 0.8),
  randomDelayMax: Number(process.env.RANDOM_DELAY_MAX || 1.5),
  pageTurnDelayMin: Number(process.env.PAGE_TURN_DELAY_MIN || 10000),
  pageTurnDelayMax: Number(process.env.PAGE_TURN_DELAY_MAX || 25000),
  captchaCheckInterval: Number(process.env.CAPTCHA_CHECK_INTERVAL || 2000),
  captchaTimeout: Number(process.env.CAPTCHA_TIMEOUT || 600000),
  loopAllKeywords: process.env.LOOP_ALL_KEYWORDS !== '0'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomDelay(baseMs) {
  const factor = randomBetween(CONFIG.randomDelayMin, CONFIG.randomDelayMax);
  return Math.floor(baseMs * factor);
}

async function sleepRandom(baseMs) {
  const delay = randomDelay(baseMs);
  console.log(`  [Random delay: ${delay}ms]`);
  await sleep(delay);
}

function readSimpleCsvLines(fileName) {
  const full = path.join(process.cwd(), fileName);
  const raw = fs.readFileSync(full, 'utf8');

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function todayYyMmDd() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function openLogFile() {
  const fileName = `LOG-${todayYyMmDd()}.TXT`;
  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }

  return {
    fileName,
    append(line) {
      fs.appendFileSync(filePath, `${line}\n`, 'utf8');
      console.log(line);
    }
  };
}

function createRuntimeStatusBar(totalKeywords) {
  const isEnabled = process.stdout.isTTY && process.env.STATUS_BAR !== '0';
  const state = {
    keywordIndex: 0,
    totalKeywords,
    keyword: '',
    pageIndex: 0,
    maxPages: CONFIG.maxGooglePages,
    hitCount: 0,
    errorCount: 0,
    proxyMode: CONFIG.enableClashSwitch ? 'Clash' : 'Local',
    switchInfo: '未切换',
    phase: '初始化'
  };

  function cleanText(value) {
    return String(value || '').replace(/[\r\n\t]+/g, ' ').trim();
  }

  function clipKeyword(keyword) {
    const text = cleanText(keyword);
    if (text.length <= 16) {
      return text;
    }
    return `${text.slice(0, 16)}...`;
  }

  function clearLine() {
    if (!isEnabled) {
      return;
    }
    process.stdout.write('\r\x1b[2K');
  }

  function formatLine() {
    const keywordLabel = clipKeyword(state.keyword || '-');
    return [
      `[状态] 关键词 ${state.keywordIndex}/${state.totalKeywords}`,
      `当前: ${keywordLabel}`,
      `页码 ${state.pageIndex}/${state.maxPages}`,
      `命中 ${state.hitCount}`,
      `错误 ${state.errorCount}`,
      `代理 ${state.proxyMode}`,
      `切换 ${state.switchInfo}`,
      `阶段 ${state.phase}`
    ].join(' | ');
  }

  function render() {
    if (!isEnabled) {
      return;
    }
    clearLine();
    process.stdout.write(formatLine());
  }

  return {
    enabled: isEnabled,
    update(patch) {
      Object.assign(state, patch);
      render();
    },
    addHits(count) {
      if (!count) {
        return;
      }
      state.hitCount += count;
      render();
    },
    addError() {
      state.errorCount += 1;
      render();
    },
    clearLine,
    render,
    teardown() {
      clearLine();
    }
  };
}

function createStatusAwareConsole(statusBar) {
  const original = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console)
  };

  function wrap(method) {
    return (...args) => {
      if (statusBar.enabled) {
        statusBar.clearLine();
      }

      method(...args);

      if (statusBar.enabled) {
        statusBar.render();
      }
    };
  }

  console.log = wrap(original.log);
  console.error = wrap(original.error);
  console.warn = wrap(original.warn);

  return {
    restore() {
      console.log = original.log;
      console.error = original.error;
      console.warn = original.warn;
    },
    log: original.log,
    error: original.error
  };
}

function matchesCompanyInfo(result, companyNeedles) {
  const combined = `${result.title} ${result.href} ${result.snippet}`.toLowerCase();
  return companyNeedles.some((needle) => combined.includes(needle));
}

async function tryAcceptGoogleConsent(page) {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("I agree")',
    'button:has-text("同意")',
    'button:has-text("接受全部")'
  ];

  for (const selector of selectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      try {
        await button.click({ timeout: 2000 });
        await sleep(1000);
        return;
      } catch {
        // Continue trying other selectors.
      }
    }
  }
}

async function extractGoogleResults(page) {
  // Retry logic for navigation issues
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Wait for page to be stable
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      await sleep(500);
      
      const items = await page.evaluate(() => {
        const rows = [];
        const seen = new Set();

        const links = Array.from(document.querySelectorAll('div#search a:has(h3)'));
        for (const a of links) {
          const h3 = a.querySelector('h3');
          const href = a.href || '';
          const title = (h3?.textContent || '').trim();

          if (!href || !title || seen.has(href)) {
            continue;
          }

          seen.add(href);

          const block = a.closest('div.g') || a.closest('div[data-hveid]') || a.parentElement;
          const snippetNode = block ? block.querySelector('div.VwiC3b, span.aCOpRe') : null;
          const snippet = (snippetNode?.textContent || '').trim();

          rows.push({ href, title, snippet });
        }

        return rows;
      });

      return items;
    } catch (err) {
      console.log(`  [Warning] extractGoogleResults attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) {
        console.log(`  Retrying in 2 seconds...`);
        await sleep(2000);
      } else {
        console.log(`  All attempts failed, returning empty results`);
        return [];
      }
    }
  }
  return [];
}

async function slowScrollForDuration(page, totalMs) {
  const start = Date.now();

  while (Date.now() - start < totalMs) {
    await page.mouse.wheel(0, Math.floor(randomBetween(500, 900)));
    await sleepRandom(1600);
  }
}

async function isPageValid(page) {
  try {
    await page.evaluate(() => 1);
    return true;
  } catch {
    return false;
  }
}

async function ensureDetailPage(detailPage, context) {
  const isValid = await isPageValid(detailPage);
  if (!isValid) {
    console.log('    [Info] Detail page was closed, recreating...');
    const newPage = await context.newPage();
    return { page: newPage, recreated: true };
  }
  return { page: detailPage, recreated: false };
}

async function collectInternalLinks(page, limit) {
  const current = page.url();
  const host = new URL(current).hostname;

  const links = await page.evaluate((originHost) => {
    const urls = [];
    const seen = new Set();

    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        continue;
      }

      let full;
      try {
        full = new URL(href, window.location.href);
      } catch {
        continue;
      }

      if (!/^https?:$/i.test(full.protocol)) {
        continue;
      }

      if (full.hostname !== originHost) {
        continue;
      }

      const normalized = full.toString();
      if (seen.has(normalized) || normalized === window.location.href) {
        continue;
      }

      seen.add(normalized);
      urls.push(normalized);
    }

    return urls;
  }, host);

  return links.slice(0, limit);
}

async function goNextGooglePage(page) {
  const nextCandidates = [
    'a#pnnext',
    'a[aria-label="Next"]',
    'a[aria-label="下一页"]'
  ];

  console.log(`  Looking for next page button (current URL: ${page.url().slice(0, 80)}...)`);

  for (const selector of nextCandidates) {
    try {
      const next = page.locator(selector).first();
      const count = await next.count();
      console.log(`    Checking selector "${selector}": ${count} found`);
      
      if (count > 0) {
        const isVisible = await next.isVisible().catch(() => false);
        console.log(`    Selector "${selector}" is visible: ${isVisible}`);
        
        if (isVisible) {
          try {
            // Get current URL to detect navigation
            const currentUrl = page.url();
            
            // Scroll into view and click
            await next.scrollIntoViewIfNeeded({ timeout: 5000 });
            await sleep(500);
            
            // Click without waiting for navigation
            await next.click({ timeout: 5000, noWaitAfter: true });
            console.log(`    Clicked next page with selector: ${selector}`);
            
            // Wait for URL to change (indicates navigation happened)
            console.log(`    Waiting for URL to change...`);
            let urlChanged = false;
            for (let i = 0; i < 30; i++) {
              await sleep(1000);
              const newUrl = page.url();
              if (newUrl !== currentUrl) {
                console.log(`    URL changed, new URL: ${newUrl.slice(0, 80)}...`);
                urlChanged = true;
                break;
              }
            }
            
            if (!urlChanged) {
              console.log(`    URL did not change after 30 seconds`);
              return false;
            }
            
            // Wait for page to be ready
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
            console.log(`    Page loaded successfully`);
            return true;
          } catch (err) {
            console.log(`    Failed to click next with selector ${selector}: ${err.message}`);
            // Continue trying other selectors.
          }
        }
      }
    } catch (err) {
      console.log(`    Error checking selector ${selector}: ${err.message}`);
    }
  }

  console.log('  No next page button found');
  return false;
}

async function clearBrowserData(context) {
  await context.clearCookies();
  console.log('Browser cookies cleared');
}

function isGoogleCaptchaPage(url) {
  return /google\.[a-z]+\/sorry\//.test(url);
}

function isGoogleBlockedPage(url) {
  return url.includes('google.com/sorry') || 
         url.includes('google.com.hk/sorry') ||
         url.includes('/recaptcha') ||
         url.includes('异常流量') ||
         url.includes('unusual traffic');
}

async function checkProxyStatus(page) {
  try {
    // Check if we can access a simple page to verify proxy
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
        const data = await res.json();
        return { success: true, ip: data.ip };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });
    
    if (response.success) {
      console.log(`  Current public IP: ${response.ip}`);
    }
    return response;
  } catch (err) {
    console.log(`  Failed to check proxy: ${err.message}`);
    return { success: false };
  }
}

async function waitForCaptchaResolution(page) {
  console.log('\n========================================');
  console.log('  CAPTCHA DETECTED!');
  console.log('  Please complete the verification manually.');
  console.log('  The script will continue automatically after you complete it.');
  console.log('========================================\n');

  const startTime = Date.now();
  let lastUrl = page.url();

  while (Date.now() - startTime < CONFIG.captchaTimeout) {
    await sleep(CONFIG.captchaCheckInterval);
    
    const currentUrl = page.url();
    
    // Some captcha flows keep the same URL; only requiring URL change can cause false timeout.
    if (!isGoogleCaptchaPage(currentUrl)) {
      console.log('Captcha resolved! New URL:', currentUrl);
      console.log('Waiting 3 seconds for page to stabilize...');
      await sleep(3000);
      console.log('Continuing...\n');
      return true;
    }
    
    lastUrl = currentUrl;
    
    // Print waiting message every 10 seconds
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed % 10 === 0) {
      console.log(`  Waiting for captcha resolution... (${elapsed}s elapsed)`);
    }
  }
  
  console.log('Timeout waiting for captcha resolution (10 minutes)');
  return false;
}

async function checkAndWaitForCaptcha(page, clashController = null) {
  const currentUrl = page.url();
  
  // Check for captcha page
  if (isGoogleCaptchaPage(currentUrl)) {
    const resolved = await waitForCaptchaResolution(page);
    if (!resolved) {
      throw new Error('Captcha not resolved within timeout');
    }
    return true;
  }
  
  // Check for blocked page (unusual traffic)
  if (isGoogleBlockedPage(currentUrl)) {
    console.log('\n========================================');
    console.log('  GOOGLE BLOCKED - UNUSUAL TRAFFIC DETECTED');
    console.log('  IP may be flagged. Attempting to switch node...');
    console.log('========================================\n');
    
    // Try to switch node if Clash is enabled
    if (clashController) {
      console.log('  Switching to a different proxy node...');
      await clashController.switchToNextNode(CONFIG.clashProxyGroup || null);
      
      const pauseAfterSwitch = randomDelay(Number(process.env.PAUSE_AFTER_SWITCH_MS || 5000));
      console.log(`  Waiting ${pauseAfterSwitch}ms for new connection...`);
      await sleep(pauseAfterSwitch);
      
      // Check new IP
      await checkProxyStatus(page);
    }
    
    // Wait for manual resolution
    console.log('  Waiting for block to be resolved...');
    const startTime = Date.now();
    while (Date.now() - startTime < CONFIG.captchaTimeout) {
      await sleep(CONFIG.captchaCheckInterval);
      const newUrl = page.url();
      if (!isGoogleBlockedPage(newUrl) && !isGoogleCaptchaPage(newUrl)) {
        console.log('  Block resolved, continuing...\n');
        return true;
      }
    }
    console.log('  Timeout waiting for block resolution');
    throw new Error('Google block not resolved within timeout');
  }
  
  return true;
}

async function safeGoto(page, url, options, clashController = null) {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, options);
      await checkAndWaitForCaptcha(page, clashController);
      return; // Success, exit function
    } catch (err) {
      const errorMessage = String(err?.message || err);
      const isTimeout = errorMessage.includes('TIMED_OUT') || 
                        errorMessage.includes('timeout') ||
                        errorMessage.includes('ERR_CONNECTION');
      
      if (isTimeout && attempt < maxRetries) {
        console.log(`  [Retry ${attempt}/${maxRetries}] Connection failed: ${errorMessage}`);
        
        // Try switching node if Clash is available
        if (clashController) {
          console.log('  Switching to different node due to connection issue...');
          await clashController.switchToNextNode(CONFIG.clashProxyGroup || null);
          const pauseAfterSwitch = randomDelay(Number(process.env.PAUSE_AFTER_SWITCH_MS || 5000));
          console.log(`  Waiting ${pauseAfterSwitch}ms for new connection...`);
          await sleep(pauseAfterSwitch);
        }
        
        console.log(`  Retrying...`);
        continue;
      }
      
      // Non-timeout error or max retries reached
      throw err;
    }
  }
}

async function run() {
  const keywords = readSimpleCsvLines('keywords.csv');
  const companyInfoNeedles = readSimpleCsvLines('info.csv').map((s) => s.toLowerCase());
  const logger = openLogFile();

  if (keywords.length === 0) {
    throw new Error('keywords.csv is empty.');
  }

  if (companyInfoNeedles.length === 0) {
    throw new Error('info.csv is empty.');
  }

  const statusBar = createRuntimeStatusBar(keywords.length);
  const consoleGuard = createStatusAwareConsole(statusBar);
  statusBar.update({
    totalKeywords: keywords.length,
    pageIndex: 0,
    maxPages: CONFIG.maxGooglePages,
    phase: '准备启动'
  });

  try {

  let clashController = null;
  if (CONFIG.enableClashSwitch) {
    statusBar.update({ proxyMode: 'Clash', phase: '连接 Clash API' });
    clashController = new ClashController();
    const connected = await clashController.testConnection();
    if (connected) {
      console.log('Clash API connected');
      console.log('Switching to next node on start...');
      statusBar.update({ phase: '切换初始节点', switchInfo: '启动切换中' });
      await clashController.switchToNextNode(CONFIG.clashProxyGroup || null);
      const pauseAfterSwitch = randomDelay(Number(process.env.PAUSE_AFTER_SWITCH_MS || 5000));
      if (pauseAfterSwitch > 0) {
        console.log(`Pausing ${pauseAfterSwitch}ms after initial switch...`);
        await sleep(pauseAfterSwitch);
      }
      statusBar.update({ switchInfo: '已切换', phase: '准备搜索' });
    } else {
      console.log('Warning: Cannot connect to Clash API, switching disabled');
      clashController = null;
      statusBar.update({ proxyMode: 'Local', switchInfo: '不可用', phase: '准备搜索' });
    }
  } else {
    statusBar.update({ proxyMode: 'Local', phase: '准备搜索' });
  }

  const browser = await chromium.launch({
    channel: 'chromium',
    headless: CONFIG.headless,
    slowMo: 120,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const stealthScript = getStealthInitScript();

  let context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: chromeUserAgent,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 1,
    colorScheme: 'light',
    hasTouch: false,
    ignoreHTTPSErrors: true,
    permissions: ['notifications']
  });
  await context.addInitScript(stealthScript);

  let searchPage = await context.newPage();
  let detailPage = await context.newPage();

  // Check proxy status at startup
  console.log('\n--- Checking proxy status ---');
  await checkProxyStatus(searchPage);
  console.log('');

  let keywordCount = 0;
  let round = 1;

  console.log(`\n=== Round ${round} started ===`);
  while (CONFIG.loopAllKeywords || keywordCount < keywords.length) {
    const keywordIndexInRound = (keywordCount % keywords.length) + 1;
    const keyword = keywords[keywordIndexInRound - 1];

    if (keywordIndexInRound === 1 && keywordCount > 0) {
      round += 1;
      console.log(`\n=== Round ${round} started ===`);
      statusBar.update({
        keywordIndex: 0,
        keyword: '',
        pageIndex: 0,
        phase: `第 ${round} 轮开始`
      });
    }

    keywordCount++;
    statusBar.update({
      keywordIndex: keywordIndexInRound,
      keyword,
      pageIndex: 0,
      phase: `第 ${round} 轮进入关键词`
    });

    if (keywordCount > 1 && CONFIG.switchNodeInterval > 0 && (keywordCount - 1) % CONFIG.switchNodeInterval === 0) {
      console.log(`\n--- Switching after ${CONFIG.switchNodeInterval} keywords ---`);
      statusBar.update({ phase: '节点切换', switchInfo: '切换中' });

      if (clashController) {
        await clashController.switchToNextNode(CONFIG.clashProxyGroup || null);
      }

      if (CONFIG.clearCookiesOnSwitch) {
        await searchPage.close();
        await detailPage.close();
        await context.close();

        context = await browser.newContext({
          viewport: { width: 1400, height: 900 },
          userAgent: chromeUserAgent,
          locale: 'en-US',
          timezoneId: 'America/New_York',
          deviceScaleFactor: 1,
          colorScheme: 'light',
          hasTouch: false,
          ignoreHTTPSErrors: true,
          permissions: ['notifications']
        });
        await context.addInitScript(stealthScript);

        searchPage = await context.newPage();
        detailPage = await context.newPage();
        console.log('Browser context recreated (cookies cleared)');
      }

      const pauseAfterSwitch = randomDelay(Number(process.env.PAUSE_AFTER_SWITCH_MS || 5000));
      if (pauseAfterSwitch > 0) {
        console.log(`Pausing ${pauseAfterSwitch}ms after switch...`);
        await sleep(pauseAfterSwitch);
      }

      console.log('--- Continue searching ---\n');
      statusBar.update({ switchInfo: '已切换', phase: '继续搜索' });
    }

    // Wrap entire keyword processing in try-catch
    try {
      const pageTrail = [];
      const detailLines = [];

      await safeGoto(searchPage, CONFIG.googleUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      }, clashController);
      
      // Check captcha after loading Google
      await checkAndWaitForCaptcha(searchPage, clashController);

      await tryAcceptGoogleConsent(searchPage);

      const q = searchPage.locator('textarea[name="q"], input[name="q"]').first();
      await q.fill(keyword);
      await sleepRandom(2000);
      await q.press('Enter');
      await searchPage.waitForLoadState('domcontentloaded', { timeout: 30000 });
      
      // Check captcha after search
      await checkAndWaitForCaptcha(searchPage, clashController);

    let pageIndex = 1;
    console.log(`\n=== Starting keyword: "${keyword}" ===`);
    console.log(`Will search up to ${CONFIG.maxGooglePages} pages`);
    statusBar.update({ pageIndex, phase: '关键词搜索中' });
    
    while (pageIndex <= CONFIG.maxGooglePages) {
      console.log(`\n--- Processing page ${pageIndex} ---`);
      statusBar.update({ pageIndex, phase: '抓取结果页' });
      
      // Check for captcha before processing page
      await checkAndWaitForCaptcha(searchPage, clashController);
      
      await sleepRandom(3000);
      console.log(`  Extracting results from page ${pageIndex}...`);
      const results = await extractGoogleResults(searchPage);
      console.log(`  Found ${results.length} results on page ${pageIndex}`);
      const hits = results.filter((r) => matchesCompanyInfo(r, companyInfoNeedles));
      console.log(`  Found ${hits.length} hits matching company info`);
      statusBar.addHits(hits.length);

      const pageTag = `P${pageIndex}`;
      const hasHit = hits.length > 0;
      pageTrail.push(hasHit ? `${pageTag}✔` : pageTag);

      if (hasHit) {
        const targetHits = CONFIG.processAllHitsInPage ? hits : hits.slice(0, 1);
        console.log(`  Processing ${targetHits.length} hit(s)...`);

        for (let i = 0; i < targetHits.length; i++) {
          const hit = targetHits[i];
          console.log(`  [Hit ${i + 1}/${targetHits.length}] Visiting: ${hit.title}`);
          console.log(`    URL: ${hit.href}`);
          statusBar.update({ phase: `处理命中 ${i + 1}/${targetHits.length}` });
          const visited = [];

          try {
            // Ensure detail page is valid before navigating
            const result = await ensureDetailPage(detailPage, context);
            if (result.recreated) {
              detailPage = result.page;
            }
            
            await sleepRandom(5000);
            console.log(`    Navigating to page...`);
            await safeGoto(detailPage, hit.href, {
              waitUntil: 'domcontentloaded',
              timeout: 45000
            }, clashController);
            
            // Check captcha after navigation
            await checkAndWaitForCaptcha(detailPage, clashController);

            console.log(`    Scrolling for ${CONFIG.dwellMsPerPage}ms...`);
            await slowScrollForDuration(detailPage, randomDelay(CONFIG.dwellMsPerPage));

            const deepLinks = await collectInternalLinks(
              detailPage,
              CONFIG.deepBrowsePages
            );
            console.log(`    Found ${deepLinks.length} internal links to browse`);

            for (let j = 0; j < deepLinks.length; j++) {
              const link = deepLinks[j];
              console.log(`    [Deep ${j + 1}/${deepLinks.length}] ${link.slice(0, 60)}...`);
              visited.push(link);
              
              // Ensure detail page is valid before navigating
              const deepResult = await ensureDetailPage(detailPage, context);
              if (deepResult.recreated) {
                detailPage = deepResult.page;
              }
              
              await sleepRandom(5000);
              await safeGoto(detailPage, link, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
              }, clashController);
              
              // Check captcha after navigation
              await checkAndWaitForCaptcha(detailPage, clashController);
              
              await slowScrollForDuration(detailPage, randomDelay(CONFIG.dwellMsPerPage));
            }
            console.log(`    Done visiting hit ${i + 1}`);
          } catch (err) {
            console.log(`    ERROR: ${err.message}`);
            statusBar.addError();
            statusBar.update({ phase: '命中处理异常' });
            visited.push(`ERROR:${String(err.message || err).slice(0, 80)}`);
            
            // Try to recreate detail page after error
            try {
              detailPage = await context.newPage();
            } catch (e) {
              console.log(`    Failed to recreate detail page: ${e.message}`);
            }
          }

          detailLines.push(
            `${keyword}-${pageTag}-${hit.href}-${visited[0] || ''}-${visited[1] || ''}`
          );
        }
      }

      console.log(`  Finished page ${pageIndex}, attempting to go to next page...`);
      const hasNext = await goNextGooglePage(searchPage);
      if (!hasNext) {
        console.log(`  No next page available, breaking loop at page ${pageIndex}`);
        statusBar.update({ phase: '到达末页' });
        break;
      }

      console.log(`  Successfully navigated to next page`);
      const pageTurnDelay = Math.floor(randomBetween(CONFIG.pageTurnDelayMin, CONFIG.pageTurnDelayMax));
      console.log(`  [Page turn delay: ${pageTurnDelay}ms]`);
      await sleep(pageTurnDelay);
      
      // Check captcha after page turn
      await checkAndWaitForCaptcha(searchPage, clashController);

      pageIndex += 1;
      console.log(`  Now processing page ${pageIndex}`);
      statusBar.update({ pageIndex, phase: '翻页完成' });
    }

    const summary = `${keyword} - ${pageTrail.join('-')}${detailLines.length === 0 ? '-到末页' : ''}`;
      logger.append(summary);

      for (const line of detailLines) {
        logger.append(line);
      }

      await sleepRandom(CONFIG.perKeywordPauseMs);
      statusBar.update({ phase: '关键词完成' });

      if (keywordIndexInRound === keywords.length) {
        console.log(`=== Round ${round} finished ===`);
        if (CONFIG.loopAllKeywords) {
          statusBar.update({ phase: `第 ${round + 1} 轮待开始` });
        }
      }
    } catch (err) {
      console.log(`\n[ERROR] Failed to process keyword "${keyword}": ${err.message}`);
      statusBar.addError();
      statusBar.update({ phase: '关键词恢复中' });
      
      // Try to recover by switching node and recreating browser context
      if (clashController) {
        console.log('  Switching node due to error...');
        await clashController.switchToNextNode(CONFIG.clashProxyGroup || null);
        statusBar.update({ switchInfo: '异常后切换', phase: '恢复中' });
      }
      
      try {
        // Recreate browser context
        await searchPage.close().catch(() => {});
        await detailPage.close().catch(() => {});
        await context.close().catch(() => {});
        
        context = await browser.newContext({
          viewport: { width: 1400, height: 900 },
          userAgent: chromeUserAgent,
          locale: 'en-US',
          timezoneId: 'America/New_York',
          deviceScaleFactor: 1,
          colorScheme: 'light',
          hasTouch: false,
          ignoreHTTPSErrors: true,
          permissions: ['notifications']
        });
        await context.addInitScript(stealthScript);

        searchPage = await context.newPage();
        detailPage = await context.newPage();
        console.log('  Browser context recreated, continuing with next keyword...\n');
        statusBar.update({ phase: '恢复完成' });
      } catch (e) {
        console.log(`  Failed to recover: ${e.message}`);
        statusBar.addError();
        statusBar.update({ phase: '恢复失败' });
      }
    }
  }

  await context.close();
  await browser.close();

  statusBar.update({
    keywordIndex: keywords.length,
    pageIndex: 0,
    phase: '全部完成'
  });
  console.log(`Done. Log written to ${logger.fileName}`);
  } finally {
    statusBar.teardown();
    consoleGuard.restore();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
