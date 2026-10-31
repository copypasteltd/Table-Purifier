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
  'docs/implementation-decisions.md', 'docs/repository-verification.md', 'docs/preview/README.md', 'docs/media/README.md','docs/实施/B方案前端还原与验收.md',
  'docs/deployment/README.md','docs/deployment/README.en.md','docs/brand/README.md','docs/brand/logo-exploration.md',
  'assets/brand/ciyuan-shixu/v1.0.0/README.md','assets/brand/logo-exploration/2026-11-01/README.md'];
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
const design=JSON.parse(await readFile(path.join(root,'docs/实施/验证记录/ui-design-fidelity-2026-11-01.json'),'utf8'));
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
// These are integrity checks of dated server evidence, not new live acceptance.
const deployment = JSON.parse(await readFile(path.join(root, 'docs/deployment/verification-2026-10-31.json'), 'utf8'));
check('deployment_evidence_scope', deployment.scope === 'AUTHORIZED_NATIVE_UBUNTU_HTTP_DEPLOYMENT' && deployment.status === 'PASS');
check('deployment_http_only', deployment.https_configured === false && deployment.public_url === 'http://192.168.31.20:18707');
check('deployment_no_local_virtualization', deployment.local_virtualization_used === false);
check('deployment_no_connection_secrets', deployment.credentials_in_git === false && !JSON.stringify(deployment).includes('postgresql://'));
check('deployment_boot_services', deployment.services.length === 4 && deployment.services.every(service => service.ActiveState === 'active' && service.enabled === 'enabled'));
check('deployment_restart_evidence', deployment.restart_check.result === 'PASS' && deployment.restart_check.host_rebooted === false);
check('deployment_native_probe', deployment.native_probe.result === 'PASS' && deployment.native_probe.live_process_tree_killed === true && deployment.native_probe.session_and_process_group_removed === true);
check('deployment_external_gates', deployment.live_model === 'NOT_CONFIGURED' && deployment.live_platform_payment === 'NOT_CONFIGURED' && deployment.complete_paid_business_workflow === 'NOT_RUN');
check('deployment_migration_count', deployment.migrations.length === 12);
for (const migration of deployment.migrations) {
  const file = path.resolve(root, 'migrations', migration.name);
  check(`deployment_migration:${migration.name}`, inside(file) && migration.disk_sha256_matches === true && hash(await readFile(file)) === migration.sha256);
}
check('deployment_http_evidence', deployment.http.every(row => !row.hsts_present && !row.https_upgrade_present));
check('deployment_browser_closed', deployment.browser_preview.browser_closed === true);
check('deployment_preview_count', deployment.browser_preview.pages.length === 2);
for (const capture of deployment.browser_preview.pages) {
  const file = path.resolve(root, 'docs/deployment/screenshots', capture.file);
  const data = await readFile(file);
  check(`deployment_screenshot:${capture.provider}`, inside(file) && data.length === capture.bytes && hash(data) === capture.sha256);
  check(`deployment_browser:${capture.provider}`, capture.status === 200 && capture.synthetic_marker.includes('SYNTHETIC') && capture.javascript_errors.length === 0 && capture.broken_images.length === 0);
}
const logoRoot = path.join(root, 'assets/brand/logo-exploration/2026-11-01');
const logos = JSON.parse(await readFile(path.join(logoRoot, 'concepts.json'), 'utf8'));
const logoManifest = JSON.parse(await readFile(path.join(logoRoot, 'manifest.json'), 'utf8'));
check('logo_count', logos.concepts.length === 10 && logoManifest.generated_originals === 10);
check('logo_historical_generation_state', logos.status === 'TEN_GENERATED_CANDIDATES_AWAITING_SELECTION' && logoManifest.selection_status === 'AWAITING_USER_SELECTION');
check('logo_requested_route', logoManifest.provider_route === 'sub2-image-gen' && logoManifest.requested_model === 'gpt-image-2.5' && logoManifest.fallback_model_used === false);
check('logo_asset_count', logoManifest.files.length === 81);
check('logo_no_frozen_design_change', logoManifest.existing_design_baseline_modified === false);
const logoHashes = new Set();
for (const logo of logos.concepts) {
  const receipt = JSON.parse(await readFile(path.join(logoRoot, logo.receipt), 'utf8'));
  const original = await readFile(path.join(logoRoot, logo.original));
  logoHashes.add(receipt.sha256);
  check(`logo_generated:${logo.id}`, receipt.status === 'GENERATED' && receipt.requested_model === 'gpt-image-2.5' && receipt.fallback_model_used === false);
  check(`logo_original:${logo.id}`, hash(original) === receipt.sha256 && receipt.retained_file === logo.original);
  check(`logo_transparent:${logo.id}`, receipt.has_transparent_pixels === true && receipt.alpha_extrema[0] === 0 && original[25] === 6);
  check(`logo_prompt:${logo.id}`, hash(await readFile(path.join(logoRoot, logo.prompt))) === receipt.prompt_sha256);
  for (const size of [1024, 512, 256, 128, 64, 32]) {
    const image = await readFile(path.join(logoRoot, logo.exports, `${size}.png`));
    check(`logo_export:${logo.id}:${size}`, image.readUInt32BE(16) === size && image.readUInt32BE(20) === size && image[25] === 6);
  }
}
check('logo_distinct_originals', logoHashes.size === 10);
for (const asset of logoManifest.files) {
  const file = path.resolve(logoRoot, asset.path), data = await readFile(file);
  check(`logo_file:${asset.path}`, inside(file) && data.length === asset.bytes && hash(data) === asset.sha256);
  check(`logo_dimensions:${asset.path}`, data.readUInt32BE(16) === asset.width && data.readUInt32BE(20) === asset.height);
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const identity = JSON.parse(await readFile(path.join(root, 'assets/brand/current.json'), 'utf8'));
const brandRoot = path.resolve(root, identity.asset_directory);
const brandManifest = JSON.parse(await readFile(path.join(brandRoot, 'manifest.json'), 'utf8'));
check('brand_user_approved', identity.status === 'USER_APPROVED' && identity.name_zh === '词元拾序' && identity.selection.concept_id === '06');
check('brand_release_consistent', identity.release_id === brandManifest.release_id && identity.release_id === design.brand_release_id && design.brand_name === identity.name_zh);
check('brand_selected_original', hash(await readFile(path.join(root, identity.selection.source))) === identity.selection.source_sha256 && hash(await readFile(path.join(brandRoot, 'originals/06-folded-paper.png'))) === identity.selection.source_sha256);
check('brand_no_regeneration', brandManifest.new_image_generation === false && brandManifest.source_bytes_unchanged === true);
check('brand_local_scope', identity.scope.application_deployment === false && identity.scope.new_image_generation === false);
for (const asset of brandManifest.files) {
  const file = path.resolve(brandRoot, asset.path), data = await readFile(file);
  check(`brand_file:${asset.path}`, inside(file) && data.length === asset.bytes && hash(data) === asset.sha256);
  if (asset.path.endsWith('.png')) check(`brand_dimensions:${asset.path}`, data.readUInt32BE(16) === asset.width && data.readUInt32BE(20) === asset.height);
}
const nativeLogo = await readFile(path.join(root, brandManifest.native_asset.path));
check('brand_native_copy', hash(nativeLogo) === brandManifest.native_asset.sha256 && hash(nativeLogo) === hash(await readFile(path.join(brandRoot, 'marks/logo-color-128.png'))));
for (const target of ['mini-alipay', 'mini-douyin']) {
  const directory = path.join(root, 'src', target), native = JSON.parse(await readFile(path.join(directory, 'source-manifest.json'), 'utf8'));
  const config = JSON.parse(await readFile(path.join(directory, 'app.json'), 'utf8'));
  const home = JSON.parse(await readFile(path.join(directory, 'pages/MP01/index.json'), 'utf8'));
  const project = JSON.parse(await readFile(path.join(directory, target === 'mini-alipay' ? 'mini.project.json' : 'project.config.json'), 'utf8'));
  check(`brand_native:${target}`, native.brand_release_id === identity.release_id && native.brand_name === identity.name_zh && (config.window.defaultTitle ?? config.window.navigationBarTitleText) === identity.name_zh && (home.defaultTitle ?? home.navigationBarTitleText) === identity.name_zh && project.projectname === identity.name_zh);
  check(`brand_native_image:${target}`, hash(await readFile(path.join(directory, 'assets/brand/logo.png'))) === hash(nativeLogo));
}
for (const name of ['docs:preview', 'docs:capture', 'docs:media', 'docs:verify','design:audit','design:before','design:icons']) check(`documented_script:${name}`, typeof pkg.scripts[name] === 'string');
const report = { status: failures.length ? 'FAIL' : 'PASS', checks_passed: checks.length - failures.length,
  checks_failed: failures.length, links_checked: links, captured_pages: 36, media_files: manifest.files.length, deployment_screenshots: deployment.browser_preview.pages.length,
  logo_concepts: logos.concepts.length, logo_png_assets: logoManifest.files.length, approved_brand: identity.name_zh, selected_logo: identity.selection.concept_id, approved_brand_assets: brandManifest.files.length, errors: failures,
  scope: 'Local documentation, source/media integrity and saved deployment evidence; no new live network, model or payment requests.' };
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
