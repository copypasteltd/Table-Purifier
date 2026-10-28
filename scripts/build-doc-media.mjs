import { spawnSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { root } from '../docs/preview/build.mjs';

const media = path.join(root, 'docs/media');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 8_000_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command}: ${result.stderr || result.stdout}`);
  return result.stdout;
}
const input = path.join(root, 'runtime/docs-recording/walkthrough.webm');
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-an', '-vf', 'scale=1440:954:flags=lanczos,setsar=1',
  '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-metadata', 'title=Table Purifier - synthetic source preview, no real model/payment/device verification', path.join(media, 'walkthrough.mp4')]);
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-an', '-filter_complex',
  '[0:v]setpts=0.55*PTS,fps=5,crop=1200:1020:140:0,scale=880:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
  '-loop', '0', path.join(media, 'walkthrough.gif')]);
const timeline = JSON.parse(await readFile(path.join(root, 'runtime/docs-recording/timeline.json'), 'utf8'));
const evidence = timeline.find(row => row.zh.includes('每个疑问'));
run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(evidence.seconds), '-t', '7', '-i', input, '-an',
  '-filter_complex', '[0:v]fps=8,crop=430:920:666:32,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
  '-loop', '0', path.join(media, 'evidence.gif')]);
const python = process.platform === 'win32' ? path.join(root, 'runtime/python-tools/Scripts/python.exe') : path.join(root, 'runtime/python-tools/bin/python3');
run(python, [path.join(root, 'scripts/build-doc-contact-sheets.py')]);
run(python, [path.join(root, 'scripts/build-design-comparison.py')]);
const captured = JSON.parse(await readFile(path.join(media, 'capture-receipt.json'), 'utf8'));
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(png|gif|mp4)$/.test(file)) {
      const data = await readFile(file);
      const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,nb_frames:format=duration', '-of', 'json', file]));
      const stream = probe.streams.find(s => s.codec_type === 'video');
      if (!stream || probe.streams.some(s => s.codec_type === 'audio')) throw new Error(`Unexpected media streams: ${file}`);
      const hash = createHash('sha256').update(data).digest('hex');
      files.push({ path: path.relative(root, file).replaceAll('\\', '/'), bytes: data.length, sha256: hash,
        width: stream.width, height: stream.height, codec: stream.codec_name, pixel_format: stream.pix_fmt,
        ...(probe.format.duration ? { duration_seconds: Number(probe.format.duration) } : {}),
        description: 'Synthetic documentation source preview; not native-device or live-integration evidence.' });
    }
  }
}
await walk(media);
files.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(path.join(media, 'manifest.json'), JSON.stringify({ protocol: 'P07-MEDIA-MANIFEST-1', captured_at: captured.captured_at,
  scope: captured.preview, verification: { live_codex: 'NOT_RUN', native_devices: 'NOT_RUN', real_payments: 'NOT_RUN', ubuntu_cleanup: 'NOT_RUN' },
  capture_receipt_sha256: createHash('sha256').update(await readFile(path.join(media, 'capture-receipt.json'))).digest('hex'),
  ffmpeg: run('ffmpeg', ['-version']).split('\n')[0], timeline, files }, null, 2) + '\n');
console.log(JSON.stringify({ media_files: files.length, total_bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  video_seconds: files.find(file => file.path.endsWith('.mp4')).duration_seconds, browser: 'not launched' }));
