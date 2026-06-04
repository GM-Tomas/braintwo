import { readFileSync, writeFileSync } from 'node:fs';


// we don't have globSync locally easily, let's use the same walkDir
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const p = join(dir, file);
    if (statSync(p).isDirectory()) {
      walkDir(p, callback);
    } else {
      callback(p);
    }
  }
}

walkDir(join(process.cwd(), '__tests__'), (p) => {
  if (p.endsWith('.test.ts') || p.endsWith('.test.tsx')) {
    let content = readFileSync(p, 'utf-8');
    const newContent = content
      .replace(/\(cb\) => \{/g, '(cb: any) => {')
      .replace(/\(text\) =>/g, '(text: any) =>')
      .replace(/\(k\) =>/g, '(k: any) =>');
      
    if (newContent !== content) {
      writeFileSync(p, newContent, 'utf-8');
      console.log(`Fixed any in ${p}`);
    }
  }
});
