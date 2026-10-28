import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createPreviewServer } from '../docs/preview/server.mjs';
import { root } from '../docs/preview/build.mjs';

// Every context and browser launched here is closed, including failed captures.
const media = path.join(root, 'docs/media'), records = [];
const smokeOnly = process.argv.includes('--smoke');
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, 'runtime/tools/playwright');
const { chromium } = await import('playwright');
const server = await createPreviewServer();
let browser;
const problems = [];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function ready(page, id) {
  await page.waitForFunction(id => window.__preview?.current?.data.page === id && !window.__preview.current.data.loading, id);
  const error = await page.evaluate(() => window.__preview.current.data.error);
  if (error) throw new Error(`${id}: ${error}`);
}
async function screenshot(page, file) {
  await page.locator('#cursor').evaluate(el => el.style.visibility = 'hidden');
  await page.screenshot({ path: path.join(media, file), animations: 'disabled' });
  await page.locator('#cursor').evaluate(el => el.style.visibility = '');
  const bytes = await readFile(path.join(media, file));
  records.push({ path: `docs/media/${file.replaceAll('\\', '/')}`, bytes: bytes.length, sha256: digest(bytes),
    provider: await page.evaluate(() => window.__preview.state.capability ? document.getElementById('provider').textContent : ''),
    page: await page.evaluate(() => document.body.dataset.page), viewport: page.viewportSize(), kind: 'SOURCE_PREVIEW_WITH_SYNTHETIC_FIXTURES' });
}
try {
  await mkdir(path.join(media, 'screenshots/alipay'), { recursive: true });
  await mkdir(path.join(media, 'screenshots/douyin'), { recursive: true });
  await mkdir(path.join(root, 'runtime/docs-recording'), { recursive: true });
  browser = await chromium.launch({ headless: true });
  for (const provider of smokeOnly ? ['ALIPAY'] : ['ALIPAY', 'DOUYIN']) {
    const context = await browser.newContext({ viewport: { width: 430, height: 920 }, deviceScaleFactor: 1, locale: 'zh-CN', reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => problems.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await page.goto(`${server.url}/?provider=${provider}`); await ready(page, 'MP01');
      for (let i = 1; i <= (smokeOnly ? 1 : 18); i++) {
        const id = `MP${String(i).padStart(2, '0')}`;
        const stage = i <= 2 ? 'ready' : [3, 6, 7].includes(i) ? 'analysis' : i === 4 ? 'quoted' : 'delivered';
        await page.evaluate(({ id, stage }) => window.__preview.seed(id, stage), { id, stage }); await ready(page, id);
        if (id === 'MP02') { await page.locator('textarea[data-field="text"]').fill(await page.evaluate(() => window.__preview.sampleText)); await ready(page, id); }
        await screenshot(page, `screenshots/${provider.toLowerCase()}/${id}.png`);
      }
    } finally { await context.close(); }
  }
  const context = await browser.newContext({ viewport: { width: 1600, height: 1060 }, deviceScaleFactor: 1, locale: 'zh-CN',
    ...(smokeOnly ? {} : { recordVideo: { dir: path.join(root, 'runtime/docs-recording'), size: { width: 1600, height: 1060 } } }) });
  let video;
  const timing = [];
  try {
    const page = await context.newPage(); video = page.video();
    page.on('pageerror', error => problems.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.goto(server.url); await ready(page, 'MP01');
    await page.evaluate(() => document.body.classList.add('recording'));
    await page.addStyleTag({ content: '#cursor{left:0;top:0}' });
    const started = Date.now();
    const pause = async (ms = 1300) => page.waitForTimeout(smokeOnly ? 30 : ms);
    const caption = async (step, zh, en) => {
      timing.push({ seconds: Number(((Date.now() - started) / 1000).toFixed(2)), step, zh, en });
      await page.evaluate(({ step, zh, en }) => window.__preview.caption(step, zh, en), { step, zh, en });
    };
    const click = async action => {
      const target = page.locator(`[data-action="${action}"]`).first(); await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox(); if (!box) throw new Error(`Missing action ${action}`);
      await page.evaluate(({ x, y }) => { const cursor = document.getElementById('cursor'); cursor.style.left = `${x - 11}px`; cursor.style.top = `${y - 11}px`; }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 }); await pause(350); await target.click();
      await page.waitForFunction(() => !window.__preview.current.data.loading);
      const error = await page.evaluate(() => window.__preview.current.data.error); if (error) throw new Error(error);
    };
    await caption(1, '先准备会话，再接收资料', 'Session + full Skill before any user input'); await pause(1600);
    await click('new'); await page.waitForFunction(() => window.__preview.current.data.ready); await pause();
    await caption(2, '粘贴资料，说明表格用途', 'Only user-submitted data enters the session');
    await page.locator('input[data-field="goal"]').fill('汇总活动报名信息，一位报名者对应一行');
    await click('go-MP02'); await ready(page, 'MP02');
    await page.locator('textarea[data-field="text"]').fill(await page.evaluate(() => window.__preview.sampleText)); await pause(1800); await click('add-text');
    await page.evaluate(() => window.__preview.navigate('MP17')); await ready(page, 'MP17'); await pause(); await click('consent');
    await page.evaluate(() => window.__preview.navigate('MP01')); await ready(page, 'MP01');
    await caption(3, '先分析全部资料，再提出规范', 'Synthetic Agent states · No live model call'); await click('analyze'); await ready(page, 'MP05');
    await page.waitForFunction(() => window.__preview.current.data.session?.status === 'WAITING_CONFIRMATION'); await pause(); await click('go-MP06'); await ready(page, 'MP06');
    await caption(4, '你确认一行是什么、字段是什么', 'Review the schema and a small preview before quoting'); await pause(2300);
    await screenshot(page, 'schema-desktop.png');
    await click('adopt'); await ready(page, 'MP04'); await pause();
    await caption(5, '确认方案，查看原单位封顶报价', '199 CNY fen is a fixture amount, not a service price'); await click('confirm-plan'); await pause(1800);
    await caption(6, '模拟实付确认后，才进入批量', 'Mock order verification · No checkout or money transfer'); await click('checkout'); await pause(); await click('start-run'); await ready(page, 'MP05');
    await page.waitForFunction(() => window.__preview.current.data.session?.status === 'CLOSED'); await pause(); await click('go-MP08'); await ready(page, 'MP08');
    await caption(7, '保留结果，把不确定的事实留给你', '2 accepted + 1 needs review · Missing does not become zero');
    await page.evaluate(() => document.getElementById('app').scrollTop = 0); await pause(2000);
    await screenshot(page, 'overview.png');
    await click('go-MP09'); await ready(page, 'MP09'); await pause(); await click('issue'); await ready(page, 'MP10'); await pause();
    await click('evidence'); await ready(page, 'MP11');
    await caption(7, '每个疑问，都能回到保留的依据', 'Evidence excerpt and locator remain with the result'); await pause(2000);
    await page.evaluate(() => window.__preview.navigate('MP12')); await ready(page, 'MP12');
    await caption(7, '九文件持续保留，任务环境整体清理', 'Simulated CLOSED state · Native Ubuntu cleanup is NOT_RUN'); await pause(2200);
    await page.locator('#app').evaluate(el => el.scrollTop = 460); await pause(1400);
    await writeFile(path.join(root, 'runtime/docs-recording/timeline.json'), JSON.stringify(timing, null, 2) + '\n');
  } finally { await context.close(); }
  if (video) await copyFile(await video.path(), path.join(root, 'runtime/docs-recording/walkthrough.webm'));
  if (problems.length) throw new Error(problems.join('\n'));
  const sourceFiles = ['miniapp/src/controller.js','miniapp/src/client.js', 'miniapp/src/components.js', 'miniapp/src/theme.css','miniapp/src/presentation.js','miniapp/src/navigation.js','miniapp/src/schema-editor.js',
    'docs/preview/main.js','docs/preview/client.js','docs/preview/platform.js','docs/preview/quotation-fixture.js','docs/preview/build.mjs','docs/preview/server.mjs','docs/preview/index.html','docs/preview/preview.css',
    ...Array.from({ length: 18 }, (_, i) => `miniapp/src/pages/MP${String(i + 1).padStart(2, '0')}.xml`)];
  const sources = [];
  for (const file of sourceFiles) sources.push({ path: file, sha256: digest(await readFile(path.join(root, file))) });
  const receipt = { protocol: 'P07-DOCUMENTATION-MEDIA-1', captured_at: new Date().toISOString(),
    preview: 'Actual native templates/components/controller rendered by documentation-only browser adapters; all data and server/payment/Agent/cleanup states are synthetic.',
    live_codex: 'NOT_RUN', native_devices: 'NOT_RUN', real_payments: 'NOT_RUN', ubuntu_cleanup: 'NOT_RUN',
    browser_closed: true, source_files: sources, screenshots: records };
  await writeFile(path.join(media, 'capture-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ screenshots: records.length, browser_errors: problems.length, video: !smokeOnly, closed_contexts: true }));
} finally {
  await browser?.close(); await server.close();
}
