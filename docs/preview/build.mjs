import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const output = path.join(root, 'runtime/docs-preview');
export async function buildPreview() {
  await mkdir(output, { recursive: true });
  const templates = {};
  for (let i = 1; i <= 18; i++) {
    const id = `MP${String(i).padStart(2, '0')}`;
    templates[id] = await readFile(path.join(root, `miniapp/src/pages/${id}.xml`), 'utf8');
  }
  const theme = await readFile(path.join(root, 'miniapp/src/theme.css'), 'utf8');
  for (const provider of ['ALIPAY', 'DOUYIN']) {
    await build({
      entryPoints: [path.join(root, 'docs/preview/main.js')], bundle: true,
      outfile: path.join(output, `${provider}.js`), format: 'iife', platform: 'browser', target: 'es2022',
      define: { __P07_PROVIDER__: JSON.stringify(provider), __TEMPLATES__: JSON.stringify(templates) },
      plugins: [{ name: 'documentation-only-fixtures', setup(builder) {
        builder.onResolve({ filter: /^\.\/(client|platform)\.js$/ }, args => {
          if (args.importer.replaceAll('\\', '/').endsWith('/miniapp/src/controller.js'))
            return { path: path.join(root, `docs/preview/${args.path.slice(2)}`) };
        });
      } }],
    });
  }
  await writeFile(path.join(output, 'native.css'), theme);
  for (const name of ['index.html', 'preview.css'])
    await writeFile(path.join(output, name), await readFile(path.join(root, `docs/preview/${name}`)));
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPreview(); console.log('Documentation preview built in runtime/docs-preview. No services started.');
}
