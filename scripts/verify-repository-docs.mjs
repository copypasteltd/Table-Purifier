import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root } from '../docs/preview/build.mjs';

// Read-only repository checks: no browser, database, model, payment or deployment.
const failures = [], checks = [];
function check(name, ok) { checks.push({ name, result: ok ? 'PASS' : 'FAIL' }); if (!ok) failures.push(name); }
const hash = data => createHash('sha256').update(data).digest('hex');
const inside = file => { const rel = path.relative(root, file); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };
const entries = ['README.md', 'README.en.md', 'SOURCE_README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs/README.md',
  'docs/implementation-decisions.md', 'docs/repository-verification.md', 'docs/preview/README.md', 'docs/media/README.md','docs/实施/B方案前端还原与验收.md'];
let links = 0;
for (const entry of entries) {
  const full = path.join(root, entry), text = await readFile(full, 'utf8');
  check(`nonempty:${entry}`, text.length > 150);
  const targets = [...text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]);
  targets.push(...[...text.matchAll(/<img\s+[^>]*src="([^"]+)"/g)].map(match => match[1]));
  for (let target of targets) {
    target = target.trim().replace(/^<|>$/g, '');
    if (/^[a-z][\w+.-]*:/i.test(target) || target.startsWith('#')) continue;
    const file = path.resolve(path.dirname(full), decodeURIComponent(target.split('#')[0]));
    const exists = await stat(file).then(() => true, () => false);
    check(`link:${entry}:${target}`, inside(file) && exists); links++;
  }
}
for (const name of ['README.md', 'README.en.md']) {
  const text = await readFile(path.join(root, name), 'utf8');
  for (const term of ['PROVIDED', 'DISCOVER', 'READY_FOR_INPUT', 'PAID', '0.164.0', 'Ubuntu 22.04', 'Taro', 'standard.xlsx', 'manifest.json', 'docs:preview', 'docs:verify', 'CHANGELOG.md'])
    check(`readme_contract:${name}:${term}`, text.includes(term));
}
const captureBytes = await readFile(path.join(root, 'docs/media/capture-receipt.json'));
const capture = JSON.parse(captureBytes);
const manifest = JSON.parse(await readFile(path.join(root, 'docs/media/manifest.json'), 'utf8'));
check('capture_receipt_digest', hash(captureBytes) === manifest.capture_receipt_sha256);
check('capture_count', capture.screenshots.length === 38);
check('browser_resources_closed', capture.browser_closed === true);
check('preview_boundaries', ['live_codex', 'native_devices', 'real_payments', 'ubuntu_cleanup'].every(key => capture[key] === 'NOT_RUN' && manifest.verification[key] === 'NOT_RUN'));
for (const source of capture.source_files) check(`captured_source:${source.path}`, hash(await readFile(path.join(root, source.path))) === source.sha256);
const design=JSON.parse(await readFile(path.join(root,'docs/实施/验证记录/ui-design-fidelity-2026-10-28.json'),'utf8'));
check('design_failures',design.failures.length===0);
check('design_resources_closed',design.browser_closed===true);
for(const provider of ['ALIPAY','DOUYIN'])for(const width of [320,375,390,430])for(let n=1;n<=18;n++)check(`design_matrix:${provider}:${width}:${n}`,design.cases.some(c=>c.provider===provider&&c.page==='MP'+String(n).padStart(2,'0')&&c.viewport.width===width&&c.variant==='standard'&&c.passed));
check('design_edge_cases',design.cases.length===164&&design.cases.every(c=>c.passed));
check('design_interactions',design.regressions.length===14&&design.regressions.every(r=>r.passed));
for(const source of design.sources)check('design_source:'+source.path,hash(await readFile(path.join(root,source.path)))===source.sha256);
for(const screenshot of design.screenshots)check('design_capture:'+screenshot.path,hash(await readFile(path.join(root,screenshot.path)))===screenshot.sha256);
for(const target of ['mini-alipay','mini-douyin']){
 const directory=path.join(root,'src',target),native=JSON.parse(await readFile(path.join(directory,'source-manifest.json'),'utf8'));
 check('native_inventory:'+target,native.pages===18&&native.components===32&&native.native_device_status==='NOT_RUN');
 for(const input of native.source_inputs){const file=path.resolve(root,input.path);check('native_input:'+target+':'+input.path,inside(file)&&hash(await readFile(file))===input.sha256);}
 for(const item of native.files){const file=path.resolve(directory,item.path),rel=path.relative(directory,file),data=await readFile(file);check('native_output:'+target+':'+item.path,!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&data.length===item.bytes&&hash(data)===item.sha256);}
}
const listed = new Set(manifest.files.map(file => file.path));
check('media_unique_paths', listed.size === manifest.files.length);
for (const file of manifest.files) {
  const full = path.resolve(root, file.path), data = await readFile(full);
  check(`media_containment:${file.path}`, inside(full) && file.path.startsWith('docs/media/'));
  check(`media_digest:${file.path}`, data.length === file.bytes && hash(data) === file.sha256);
  check(`media_size:${file.path}`, data.length < 50 * 1024 * 1024);
  check(`media_dimensions:${file.path}`, file.width > 0 && file.height > 0);
  if (file.path.endsWith('.png')) check(`png_dimensions:${file.path}`, data.readUInt32BE(16) === file.width && data.readUInt32BE(20) === file.height);
  if (file.path.endsWith('.gif')) check(`gif_dimensions:${file.path}`, data.readUInt16LE(6) === file.width && data.readUInt16LE(8) === file.height);
}
for (const screenshot of capture.screenshots) check(`captured_image:${screenshot.path}`, manifest.files.some(file => file.path === screenshot.path && file.sha256 === screenshot.sha256));
for (const provider of ['alipay', 'douyin']) {
  for (let i = 1; i <= 18; i++) check(`page:${provider}:MP${i}`, listed.has(`docs/media/screenshots/${provider}/MP${String(i).padStart(2, '0')}.png`));
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(png|gif|mp4)$/.test(entry.name)) check(`no_unlisted_media:${entry.name}`, listed.has(path.relative(root, full).replaceAll('\\', '/')));
  }
}
await walk(path.join(root, 'docs/media'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
for (const name of ['docs:preview', 'docs:capture', 'docs:media', 'docs:verify','design:audit','design:before','design:icons']) check(`documented_script:${name}`, typeof pkg.scripts[name] === 'string');
const report = { status: failures.length ? 'FAIL' : 'PASS', checks_passed: checks.length - failures.length,
  checks_failed: failures.length, links_checked: links, captured_pages: 36, media_files: manifest.files.length, errors: failures,
  scope: 'Local documentation links, bilingual contracts, source hashes and media integrity only; no live integrations.' };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
