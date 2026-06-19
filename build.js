import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname);
const DIST = join(__dirname, 'dist');

// Ensure dist exists
mkdirSync(DIST, { recursive: true });

// Copy index.html
console.log('Copying index.html...');
copyFileSync(join(SRC, 'index.html'), join(DIST, 'index.html'));

// Copy all files from public/
const publicDir = join(SRC, 'public');
try {
  const files = readdirSync(publicDir);
  for (const file of files) {
    const srcPath = join(publicDir, file);
    const destPath = join(DIST, file);
    const stat = statSync(srcPath);
    if (stat.isFile()) {
      console.log(`Copying public/${file}...`);
      copyFileSync(srcPath, destPath);
    }
  }
} catch (e) {
  console.log('No public/ directory or empty.');
}

console.log('Build complete: dist/ is ready for deployment.');
