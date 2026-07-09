import type { FingerprintConfig } from './profile.schema';

const CHROME_VERSIONS = [
  '120.0.6099.109', '121.0.6167.85', '122.0.6261.57',
  '123.0.6312.58', '124.0.6367.91', '125.0.6422.76',
];

const FIREFOX_VERSIONS = [
  '121.0', '122.0', '123.0', '124.0', '125.0',
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080, ratio: 1 },
  { width: 2560, height: 1440, ratio: 1 },
  { width: 1366, height: 768, ratio: 1 },
  { width: 1440, height: 900, ratio: 2 },
  { width: 1536, height: 864, ratio: 1.25 },
  { width: 2560, height: 1600, ratio: 2 },
];

const GPU_COMBOS = [
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)',
  },
  {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660)',
  },
  {
    vendor: 'Google Inc. (AMD)',
    renderer: 'ANGLE (AMD, AMD Radeon RX 580)',
  },
  {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel UHD Graphics 630)',
  },
  {
    vendor: 'Google Inc. (Apple)',
    renderer: 'ANGLE (Apple, Apple M1)',
  },
];

const TIMEZONE_MAP: Record<string, string[]> = {
  US: [
    'America/New_York', 'America/Chicago',
    'America/Denver', 'America/Los_Angeles',
  ],
  GB: ['Europe/London'],
  DE: ['Europe/Berlin'],
  JP: ['Asia/Tokyo'],
  CN: ['Asia/Shanghai'],
  KR: ['Asia/Seoul'],
  BR: ['America/Sao_Paulo'],
  AU: ['Australia/Sydney'],
  IN: ['Asia/Kolkata'],
  FR: ['Europe/Paris'],
};

const LOCALE_MAP: Record<string, string> = {
  US: 'en-US', GB: 'en-GB', DE: 'de-DE',
  JP: 'ja-JP', CN: 'zh-CN', KR: 'ko-KR',
  BR: 'pt-BR', AU: 'en-AU', IN: 'hi-IN',
  FR: 'fr-FR',
};

const FONT_SETS = {
  windows: [
    'Arial', 'Calibri', 'Cambria', 'Consolas',
    'Courier New', 'Georgia', 'Helvetica',
    'Lucida Console', 'Segoe UI', 'Tahoma',
    'Times New Roman', 'Trebuchet MS', 'Verdana',
  ],
  macos: [
    'Arial', 'Avenir', 'Courier New', 'Geneva',
    'Georgia', 'Helvetica', 'Helvetica Neue',
    'Lucida Grande', 'Menlo', 'Monaco',
    'San Francisco', 'Times New Roman', 'Verdana',
  ],
  linux: [
    'Arial', 'Courier New', 'DejaVu Sans',
    'DejaVu Serif', 'FreeMono', 'Georgia',
    'Liberation Mono', 'Liberation Sans',
    'Noto Sans', 'Times New Roman', 'Ubuntu',
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildUserAgent(
  os: string,
  browser: string,
  version: string
): string {
  const osStr: Record<string, string> = {
    windows: 'Windows NT 10.0; Win64; x64',
    macos: 'Macintosh; Intel Mac OS X 10_15_7',
    linux: 'X11; Linux x86_64',
    android: 'Linux; Android 13; Pixel 7',
    ios: 'iPhone; CPU iPhone OS 17_0 like Mac OS X',
  };

  const platform = osStr[os] ?? osStr.windows;

  if (browser === 'firefox') {
    return (
      `Mozilla/5.0 (${platform}; rv:${version}) ` +
      `Gecko/20100101 Firefox/${version}`
    );
  }

  return (
    `Mozilla/5.0 (${platform}) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${version} Safari/537.36`
  );
}

export function generateFingerprint(opts: {
  os?: string;
  browser?: string;
  country?: string;
}): FingerprintConfig {
  const os = opts.os ?? pick(['windows', 'macos', 'linux']);
  const browser = opts.browser ?? 'chrome';
  const country = (opts.country ?? 'US').toUpperCase();

  const versions =
    browser === 'firefox' ? FIREFOX_VERSIONS : CHROME_VERSIONS;
  const version = pick(versions);
  const screen = pick(SCREEN_RESOLUTIONS);
  const gpu = pick(GPU_COMBOS);
  const cpuCores = pick([4, 8, 12, 16]);
  const memoryGb = pick([4, 8, 16, 32]);

  const timezones = TIMEZONE_MAP[country] ?? ['UTC'];
  const timezone = pick(timezones);
  const locale = LOCALE_MAP[country] ?? 'en-US';
  const lang = locale.split('-')[0];
  const fontOs = os === 'macos' ? 'macos'
    : os === 'linux' ? 'linux' : 'windows';

  return {
    os: os as FingerprintConfig['os'],
    browser: browser as FingerprintConfig['browser'],
    browser_version: version,
    user_agent: buildUserAgent(os, browser, version),
    platform:
      os === 'windows' ? 'Win32'
      : os === 'macos' ? 'MacIntel'
      : 'Linux x86_64',
    screen: {
      width: screen.width,
      height: screen.height,
      color_depth: 24,
      device_pixel_ratio: screen.ratio,
    },
    hardware: {
      cpu_cores: cpuCores,
      memory_gb: memoryGb,
      gpu_vendor: gpu.vendor,
      gpu_renderer: gpu.renderer,
      max_touch_points: os === 'android' || os === 'ios'
        ? randInt(1, 5) : 0,
    },
    canvas: {
      mode: 'noise',
      noise_seed: randInt(1, 999999),
    },
    webgl: {
      mode: 'noise',
      vendor: gpu.vendor,
      renderer: gpu.renderer,
      noise_seed: randInt(1, 999999),
    },
    audio: {
      mode: 'noise',
      noise_seed: randInt(1, 999999),
    },
    webrtc: { mode: 'fake' },
    location: {
      timezone,
      locale,
      languages: [locale, lang],
    },
    fonts: FONT_SETS[fontOs] ?? FONT_SETS.windows,
    client_hints: {
      brands: [
        { brand: 'Chromium', version: version.split('.')[0] },
        { brand: 'Google Chrome', version: version.split('.')[0] },
        { brand: 'Not_A Brand', version: '8' },
      ],
      mobile: os === 'android' || os === 'ios',
      platform:
        os === 'windows' ? 'Windows'
        : os === 'macos' ? 'macOS'
        : os === 'linux' ? 'Linux'
        : os === 'android' ? 'Android'
        : 'iOS',
      platform_version: '10.0.0',
      architecture: os === 'android' || os === 'ios'
        ? 'arm' : 'x86',
      bitness: '64',
    },
  };
}

export interface ValidationResult {
  valid: boolean;
  consistency_score: number;
  warnings: string[];
}

export function validateFingerprint(
  fp: FingerprintConfig,
  proxyCountry?: string
): ValidationResult {
  const warnings: string[] = [];
  let score = 100;

  if (proxyCountry && fp.location?.timezone) {
    const expected = TIMEZONE_MAP[proxyCountry.toUpperCase()];
    if (expected && !expected.includes(fp.location.timezone)) {
      warnings.push(
        `Timezone "${fp.location.timezone}" may not match ` +
        `proxy country "${proxyCountry}"`
      );
      score -= 20;
    }
  }

  if (proxyCountry && fp.location?.locale) {
    const expected = LOCALE_MAP[proxyCountry.toUpperCase()];
    if (expected) {
      const fpLang = fp.location.locale.split('-')[0];
      const expLang = expected.split('-')[0];
      if (fpLang !== expLang) {
        warnings.push(
          `Locale "${fp.location.locale}" does not match ` +
          `proxy country "${proxyCountry}"`
        );
        score -= 15;
      }
    }
  }

  if (fp.os && fp.user_agent) {
    const ua = fp.user_agent.toLowerCase();
    const osChecks: Record<string, string[]> = {
      windows: ['windows'],
      macos: ['macintosh', 'mac os'],
      linux: ['linux', 'x11'],
      android: ['android'],
      ios: ['iphone', 'ipad'],
    };
    const checks = osChecks[fp.os] ?? [];
    const matches = checks.some(c => ua.includes(c));
    if (!matches) {
      warnings.push(
        `User-Agent does not match OS "${fp.os}"`
      );
      score -= 25;
    }
  }

  if (fp.screen && fp.os) {
    const w = fp.screen.width ?? 0;
    if (
      (fp.os === 'android' || fp.os === 'ios') &&
      w > 1920
    ) {
      warnings.push(
        'Screen resolution too high for mobile OS'
      );
      score -= 10;
    }
  }

  return {
    valid: score >= 60,
    consistency_score: Math.max(0, score),
    warnings,
  };
}
