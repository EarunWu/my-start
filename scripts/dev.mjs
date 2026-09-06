import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Wrangler watches its whole assets directory, including ignored files. Keep its
// own generated bundles/state outside that directory to avoid a reload loop.
const assets = resolve(project, '.wrangler/local-assets');
const files = (await readFile(resolve(project, '.assetsignore'), 'utf8')).split(/\r?\n/)
  .filter(line => line.startsWith('!') && !line.endsWith('/')).map(line => line.slice(1));
async function copy(file) {
  const target = resolve(assets, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(project, file), target);
}
await Promise.all(files.map(copy));
const watchers = files.map(file => watch(resolve(project, file), () => copy(file).catch(console.error)));
const extra = process.argv.slice(2);
const port = extra.includes('--port') ? [] : ['--port', '4173'];
// Local development can reach Zhihu directly and does not need the production relay key.
const child = spawn(process.execPath, [resolve(project, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--ip', '127.0.0.1', ...port, '--local', '--var', 'ZHIHU_PROXY_URL:', '--assets', assets, ...extra], { cwd: project, stdio: 'inherit' });
const close = () => { for (const watcher of watchers) watcher.close(); };
child.on('exit', code => { close(); process.exitCode = code || 0; });
child.on('error', error => { close(); console.error(error); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { close(); child.kill(signal); });
