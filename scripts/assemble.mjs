import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function assemble(dir, out) {
  const names = (await readdir(dir)).filter(n => n.endsWith('.part')).sort();
  if (!names.length) throw new Error(`No source parts found in ${dir}`);
  const chunks = await Promise.all(names.map(n => readFile(join(dir, n), 'utf8')));
  let output = chunks.join('');
  if (out.endsWith('main.js')) output = output.replace('<div>><span class="eyebrow">','<div><span class="eyebrow">');
  await mkdir(out.substring(0, out.lastIndexOf('/')), { recursive: true });
  await writeFile(out, output, 'utf8');
}

async function hardenApp2(){
  const file='src/app2.js';
  let output=await readFile(file,'utf8');
  // Server authentication is authoritative. Never fall back to browser-side password verification.
  output=output.replace("if(!user)user=await builtinLogin(login,password);if(!user){error.textContent='Could not sign in. Check credentials or hosting configuration.';return;}","if(!user){error.textContent='Could not sign in. Check credentials or hosting configuration.';return;}");
  output=output.replace("if(r.ok&&j.user)user=j.user;else if(r.status===401){error.textContent=j.error||'Invalid login or password';return;}","if(r.ok&&j.user)user=j.user;else{error.textContent=j.error||'Could not sign in.';return;}");
  // Password-derived Basic credentials must not be persisted client-side.
  output=output.replace(/sessionStorage\.setItem\('clinical_ops_auth',btoa\(`\$\{login\}:\$\{password\}`\)\);/g,'');
  await writeFile(file,output,'utf8');
}

await assemble('src/main.parts', 'src/main.js');
await assemble('src/style.parts', 'src/styles.css');
await hardenApp2();
console.log('Assembled browser sources and applied production auth hardening.');
