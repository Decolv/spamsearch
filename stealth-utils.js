/**
 * Stealth utilities to reduce automation detection in Playwright.
 *
 * Injects scripts before page load to mask headless/browser-automation signatures.
 */

function getStealthInitScript() {
  return `
    // Remove navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });

    // Fake plugins
    function makeFakePlugins() {
      const PluginArray = function() {};
      PluginArray.prototype.item = function(index) { return this[index] || null; };
      PluginArray.prototype.namedItem = function(name) { return this[name] || null; };
      PluginArray.prototype.length = 3;
      PluginArray.prototype.refresh = function() {};

      const p = new PluginArray();
      p[0] = {
        name: 'Chrome PDF Plugin',
        filename: 'internal-pdf-viewer',
        description: 'Portable Document Format',
        version: undefined,
        length: 0,
        item: () => null,
        namedItem: () => null
      };
      p[1] = {
        name: 'Chrome PDF Viewer',
        filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
        description: 'Portable Document Format',
        version: undefined,
        length: 0,
        item: () => null,
        namedItem: () => null
      };
      p[2] = {
        name: 'Native Client',
        filename: 'internal-nacl-plugin',
        description: '',
        version: undefined,
        length: 0,
        item: () => null,
        namedItem: () => null
      };
      p['Chrome PDF Plugin'] = p[0];
      p['Chrome PDF Viewer'] = p[1];
      p['Native Client'] = p[2];
      return p;
    }

    Object.defineProperty(navigator, 'plugins', {
      get: makeFakePlugins,
      configurable: true
    });

    // Fake mimeTypes
    function makeFakeMimeTypes() {
      const MimeTypeArray = function() {};
      MimeTypeArray.prototype.item = function(index) { return this[index] || null; };
      MimeTypeArray.prototype.namedItem = function(name) { return this[name] || null; };
      MimeTypeArray.prototype.length = 4;

      const m = new MimeTypeArray();
      const pdfPlugin = navigator.plugins['Chrome PDF Plugin'];
      const pdfViewer = navigator.plugins['Chrome PDF Viewer'];

      m[0] = { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: pdfPlugin };
      m[1] = { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: pdfViewer };
      m[2] = { type: 'application/x-nacl', suffixes: '', description: 'Native Client executable', enabledPlugin: navigator.plugins['Native Client'] };
      m[3] = { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client executable', enabledPlugin: navigator.plugins['Native Client'] };

      m['application/x-google-chrome-pdf'] = m[0];
      m['application/pdf'] = m[1];
      m['application/x-nacl'] = m[2];
      m['application/x-pnacl'] = m[3];
      return m;
    }

    Object.defineProperty(navigator, 'mimeTypes', {
      get: makeFakeMimeTypes,
      configurable: true
    });

    // Fake languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true
    });

    // Override Notification.permission
    const originalNotification = window.Notification;
    Object.defineProperty(window, 'Notification', {
      value: function(title, options) {
        if (originalNotification) {
          return new originalNotification(title, options);
        }
      },
      configurable: true,
      writable: true
    });
    if (originalNotification) {
      Object.defineProperty(window.Notification, 'permission', {
        get: () => 'default',
        configurable: true
      });
      window.Notification.requestPermission = function() {
        return Promise.resolve('default');
      };
      Object.setPrototypeOf(window.Notification, originalNotification.prototype);
    }

    // Override permissions.query to hide automation signatures
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = function(parameters) {
        if (parameters && parameters.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return originalQuery(parameters);
      };
    }

    // chrome.runtime / window.chrome
    window.chrome = window.chrome || {};
    window.chrome.runtime = window.chrome.runtime || {
      OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
      OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
      PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", MIPS64EL: "mips64el", MIPSEL: "mipsel", X86_32: "x86-32", X86_64: "x86-64" },
      PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", MIPS64EL: "mips64el", MIPSEL: "mipsel", MIPS_EL: "mipsel", X86_32: "x86-32", X86_64: "x86-64" },
      PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
      RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" }
    };

    // Hide Playwright-specific properties on window
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__pw_resume;
    delete window.__pw_recorderState;
    delete window.__pw_refresh_overlay;
  `;
}

module.exports = { getStealthInitScript };
