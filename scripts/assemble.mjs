import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function assemble(dir, out) {
  const names = (await readdir(dir)).filter(n => n.endsWith('.part')).sort();
  if (!names.length) throw new Error(`No source parts found in ${dir}`);
  const chunks = await Promise.all(names.map(n => readFile(join(dir, n), 'utf8')));
  let output = chunks.join('');
  // One part boundary lands inside the page-head template; normalize it after assembly.
  if (out.endsWith('main.js')) output = output.replace('<div>><span class="eyebrow">','<div><span class="eyebrow">');
  await mkdir(out.substring(0, out.lastIndexOf('/')), { recursive: true });
  await writeFile(out, output, 'utf8');
}

await assemble('src/main.parts', 'src/main.js');
await assemble('src/style.parts', 'src/styles.css');
console.log('Assembled browser sources.');
