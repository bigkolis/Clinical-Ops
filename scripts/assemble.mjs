import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function assemble(dir, out) {
  const names = (await readdir(dir)).filter(n => n.endsWith('.part')).sort();
  if (!names.length) throw new Error(`No source parts found in ${dir}`);
  const chunks = await Promise.all(names.map(n => readFile(join(dir, n), 'utf8')));
  await mkdir(out.substring(0, out.lastIndexOf('/')), { recursive: true });
  await writeFile(out, chunks.join(''), 'utf8');
}

await assemble('src/main.parts', 'src/main.js');
await assemble('src/style.parts', 'src/styles.css');
console.log('Assembled browser sources.');
