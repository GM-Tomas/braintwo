import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';


// Since we may not have glob, let's use a simple recursive readdir
import { readdirSync, statSync } from 'node:fs';

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const p = join(dir, file);
    if (statSync(p).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '__tests__' && file !== 'out' && file !== 'build') {
        walkDir(p, callback);
      }
    } else {
      callback(p);
    }
  }
}

const rootDir = process.cwd();
const targetRoot = join(rootDir, '__tests__');

console.log('Moving test files to __tests__...');

let count = 0;
walkDir(rootDir, (filePath) => {
  if (filePath.includes('.test.') || filePath.includes('test-utils')) {
    // Skip if already in __tests__ or node_modules
    if (filePath.includes('__tests__') || filePath.includes('node_modules')) return;
    
    // We want to move test-utils entire dir, but wait, test-utils is a directory
    // Let's handle files individually. The glob above handles all files inside test-utils too.
  }
  
  const isTestFile = filePath.endsWith('.test.ts') || filePath.endsWith('.test.tsx') || filePath.endsWith('.test.mjs');
  const isTestUtilsFile = filePath.includes('test-utils\\') || filePath.includes('test-utils/');
  
  if (isTestFile || isTestUtilsFile) {
    const relPath = relative(rootDir, filePath);
    const destPath = join(targetRoot, relPath);
    const destDir = dirname(destPath);
    
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    
    renameSync(filePath, destPath);
    console.log(`Moved: ${relPath} -> __tests__/${relPath}`);
    count++;
  }
});

console.log(`Moved ${count} files.`);
