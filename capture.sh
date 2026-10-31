#!/usr/bin/env bash
# Capture the deployed game from CAPTURE_URL into CAPTURE_DIR.
# Exit 75 means temporary navigation/browser infrastructure trouble; exit 1
# means the script or the rendered page is defective.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
: "${CAPTURE_URL:?Set CAPTURE_URL to the deployed game URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory outside the source tree.}"

timed() {
  echo "+ $*" >&2
  /usr/bin/time -p "$@"
}

export CAPTURE_URL CAPTURE_DIR PROJECT_ROOT="$ROOT"

timed node --input-type=module <<'NODE'
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright');
const require = createRequire(join(runtime, 'package.json'));
const { chromium } = require('playwright');

// Keep the controller's screenshot provenance instrumentation when present.
try {
  const { instrument } = require(join(process.env.RUNTIME_DIR || '', 'scripts/wip-screenshots.cjs'));
  instrument(chromium);
} catch {
  // Instrumentation is optional evidence; capture still works without it.
}

const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (process.platform === 'linux') {
  process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim();
}

const url = process.env.CAPTURE_URL;
const output = resolve(process.env.CAPTURE_DIR);
const projectRoot = resolve(process.env.PROJECT_ROOT);

const fail = (message, code = 1) => {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
};
const transient = error => {
  error.exitCode = 75;
  return error;
};
const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);

let parsed;
try {
  parsed = new URL(url);
} catch {
  fail(`CAPTURE_URL is not a valid URL: ${url}`);
}
if (!/^https?:$/.test(parsed.protocol)) fail(`CAPTURE_URL must be http(s): ${url}`);

const insideProject = relative(projectRoot, output);
if (!isAbsolute(output) || insideProject === '' || (!insideProject.startsWith('..') && !isAbsolute(insideProject))) {
  fail(`CAPTURE_DIR must be an absolute path outside the project: ${output}`);
}

mkdirSync(output, { recursive: true });

let browser;
let exitCode = 0;
try {
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(transient);

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
      isMobile: name === 'mobile',
      hasTouch: name === 'mobile'
    }).catch(transient);
    page.setDefaultTimeout(30000);

    const pageErrors = [];
    page.on('pageerror', error => {
      console.error(`${name} page error: ${error.message}`);
      pageErrors.push(error.message);
    });

    let response;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (error) {
      throw transient(error);
    }
    if (!response) throw transient(new Error(`No HTTP response loading ${url}`));
    if (!response.ok()) {
      const status = response.status();
      const code = TRANSIENT_HTTP.has(status) || status >= 500 ? 75 : 1;
      throw Object.assign(new Error(`HTTP ${status} loading ${url}`), { exitCode: code });
    }

    await page.locator('body').waitFor({ state: 'visible', timeout: 30000 });

    // Wait for the game boot module before interacting with the overlay.
    await page.waitForFunction(
      () => Boolean(window.__weedfirm) && Boolean(document.querySelector('canvas#scene')) && Boolean(document.querySelector('#hud')),
      null,
      { timeout: 30000 }
    ).catch(() => fail(`${name}: game boot module did not render`));

    const startButton = page.locator('#start-btn');
    if (await startButton.isVisible().catch(() => false)) {
      try {
        await startButton.click({ timeout: 5000 });
        console.log(`${name}: clicked Start`);
      } catch (error) {
        throw transient(error);
      }
    } else {
      console.log(`${name}: Start overlay already dismissed`);
    }

    await page.waitForFunction(
      () => window.__weedfirm?.state?.started === true,
      null,
      { timeout: 15000 }
    ).catch(() => fail(`${name}: game did not enter the running state after Start`));

    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.waitForTimeout(1200);

    if (pageErrors.length) fail(`${name}: page errors: ${pageErrors.join('; ')}`);

    const path = join(output, `final-${name}.png`);
    try {
      await page.screenshot({ path, timeout: 30000 });
    } catch (error) {
      if (error.name === 'TimeoutError' || !browser.isConnected()) throw transient(error);
      throw error;
    }

    const bytes = statSync(path).size;
    const fd = openSync(path, 'r');
    const header = Buffer.alloc(8);
    readSync(fd, header, 0, 8, 0);
    closeSync(fd);
    if (bytes < 10_000 || header.toString('hex') !== '89504e470d0a1a0a') {
      fail(`${name}: screenshot looks empty or invalid (${bytes} bytes)`);
    }
    console.log(`${name}: wrote ${path} (${bytes} bytes)`);

    await page.close();
  }
} catch (error) {
  console.error(error?.stack || error);
  exitCode = error?.exitCode || 1;
} finally {
  await browser?.close().catch(error => {
    console.error(error);
    if (!exitCode) exitCode = 75;
  });
}

if (exitCode) process.exit(exitCode);
NODE
