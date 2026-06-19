import { copyFileSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname);
const DIST = join(__dirname, 'dist');

// Ensure dist exists
mkdirSync(DIST, { recursive: true });

// Read index.html and features.js
console.log('Reading index.html...');
let html = readFileSync(join(SRC, 'index.html'), 'utf8');

// Inline features.js if it exists
const featuresPath = join(SRC, 'src', 'features.js');
try {
  const features = readFileSync(featuresPath, 'utf8');
  // Insert features.js before the service worker script block
  const swMarker = "</script>\n<script>\nif ('serviceWorker'";
  const insertionPoint = html.indexOf(swMarker);
  if (insertionPoint !== -1) {
    html = html.slice(0, insertionPoint) + '\n/* ==== FEATURES MODULE ==== */\n' + features + '\n' + html.slice(insertionPoint);
    console.log('Inlined features.js (' + features.length + ' bytes)...');
  } else {
    // Fallback: insert before </body>
    const bodyEnd = html.lastIndexOf('</body>');
    if (bodyEnd !== -1) {
      html = html.slice(0, bodyEnd) + '<script>\n/* ==== FEATURES MODULE ==== */\n' + features + '\n</script>\n' + html.slice(bodyEnd);
      console.log('Inlined features.js via body fallback...');
    }
  }
} catch (e) {
  console.log('No features.js to inline (optional).');
}

// Write modified index.html
writeFileSync(join(DIST, 'index.html'), html);
console.log('Wrote index.html with features...');

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
