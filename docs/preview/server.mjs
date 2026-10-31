import http from 'node:http';
import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPreview, output,root } from './build.mjs';

export async function createPreviewServer(port = 0,preparedDirectory=null) {
  const directory=preparedDirectory??output;
  const relative=path.relative(path.join(root,'runtime'),directory);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Preview directory must remain inside project runtime.');
  if(!preparedDirectory)await buildPreview();
  const files = new Set(['index.html', 'preview.css', 'native.css', 'ALIPAY.js', 'DOUYIN.js']);
  for(const name of await readdir(path.join(directory,'assets/icons')))if(/^[a-z-]+\.png$/.test(name))files.add('assets/icons/'+name);
  files.add('assets/brand/logo.png');
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!files.has(name)) { response.writeHead(404).end(); return; }
      let body = await readFile(path.join(directory, name));
      if (name === 'index.html' && url.searchParams.get('provider') === 'DOUYIN')
        body = Buffer.from(body.toString('utf8').replace('src="ALIPAY.js"', 'src="DOUYIN.js"'));
      response.writeHead(200, { 'Content-Type': name.endsWith('.png')?'image/png':name.endsWith('.js') ? 'text/javascript; charset=utf-8' : name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(body);
    } catch { response.writeHead(500).end('Documentation preview unavailable'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createPreviewServer(4173);
  console.log(`Documentation fixtures only: ${server.url} · Ctrl+C closes this local preview.`);
  const close = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
