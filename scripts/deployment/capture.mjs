// Capture only the deployed synthetic documentation preview. Always close every browser resource.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, 'runtime/tools/playwright');
const { chromium } = await import('playwright');
const output = path.join(root, 'docs/deployment/screenshots');
await mkdir(output, { recursive: true });
const receipt = { scope: 'ACTUAL_LAN_HTTP_SYNTHETIC_PREVIEW', at: new Date().toISOString(), pages: [], browser_closed: false };
let browser, context;
try {
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  for (const [provider, suffix] of [['ALIPAY', ''], ['DOUYIN', 'douyin.html']]) {
    const page = await context.newPage();
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    page.on('requestfailed', request => failures.push(request.url()));
    const response = await page.goto(`http://192.168.31.20:18707/preview/${suffix}`, { waitUntil: 'networkidle' });
    await page.locator('#app').waitFor({ state: 'visible' });
    const synthetic = await page.locator('.preview-label').innerText();
    const platform = await page.locator('#provider').innerText();
    const imageFailures = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute('src')));
    const file = `${provider.toLowerCase()}-http.png`;
    await page.screenshot({ path: path.join(output, file), fullPage: true, animations: 'disabled' });
    receipt.pages.push({ provider, url: page.url(), status: response.status(), synthetic_marker: synthetic, platform, file, javascript_errors: failures, broken_images: imageFailures });
    await page.close();
    if (response.status() !== 200 || !synthetic.includes('SYNTHETIC') || failures.length || imageFailures.length) throw new Error('Deployed preview check failed.');
  }
} finally {
  try { await context?.close(); } finally { await browser?.close(); receipt.browser_closed = true; }
  await writeFile(path.join(root, 'runtime/deploy/browser-check.json'), JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(receipt));
