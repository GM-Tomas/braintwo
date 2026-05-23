import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

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

const testsDir = join(process.cwd(), '__tests__');

walkDir(testsDir, (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.mjs')) return;

  let content = readFileSync(filePath, 'utf-8');
  let changed = false;

  // We want to replace `from './something'` with the correct path to the original source.
  // The original source is at the same relative path inside `src`, `electron`, `scripts`, `shared`.
  // Wait, `__tests__/electron/services/db.test.ts` is trying to import `./db`.
  // Its depth relative to `__tests__` is `electron/services/db.test.ts` (3 levels).
  // To get back to root, it's `../../../`. Then to original it's `../../../electron/services/db`.
  
  const relToTests = relative(testsDir, filePath).replace(/\\/g, '/'); // e.g. electron/services/db.test.ts
  const depth = relToTests.split('/').length - 1;
  const backToRoot = '../'.repeat(depth + 1); // e.g. ../../../
  const originalDir = dirname(relToTests); // e.g. electron/services

  content = content.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, importPath) => {
    // importPath is like './db' or '../utils'
    // We want to resolve it relative to the ORIGINAL directory.
    
    // Quick hack for specific cases:
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
        // e.g. importPath = './db'
        // we replace it with `backToRoot + originalDir + '/' + importPath` (normalized)
        // A cleaner way is just to rewrite to use path aliases where possible!
        
        // Wait, for `electron/`, we don't have an alias. 
        // Let's just calculate the new path.
        let parts = originalDir.split('/').filter(Boolean);
        let importParts = importPath.split('/');
        
        for (const p of importParts) {
            if (p === '.') continue;
            if (p === '..') {
                parts.pop();
            } else {
                parts.push(p);
            }
        }
        
        const finalResolvedFromRoot = parts.join('/');
        const newImport = backToRoot + finalResolvedFromRoot;
        return `from '${newImport}'`;
    }
    return match;
  });

  if (content !== readFileSync(filePath, 'utf-8')) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated imports in ${relToTests}`);
  }
});
