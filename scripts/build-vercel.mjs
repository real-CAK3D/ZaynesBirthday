import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of ['index.html', 'styles.css', 'script.js', '.nojekyll']) {
  await copyFile(join(root, file), join(dist, file));
}

console.log('Built static Vercel output in dist/');
