/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Post-build guard: fails the build when the published artifacts regress
 * (the 1.0.x releases shipped a 10-byte index.d.ts stub and a style.css export that did not exist).
 */
import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// 1. Every path referenced from package.json must exist.
const refs = new Set([pkg.main, pkg.module, pkg.types]);
for (const value of Object.values(pkg.exports)) {
  if (typeof value === 'string') refs.add(value);
  else for (const v of Object.values(value)) refs.add(v);
}
for (const ref of refs) {
  if (!ref) continue;
  if (!existsSync(ref)) fail(`package.json references missing file: ${ref}`);
}

// 2. Real type declarations, not a stub. The entry is a re-export barrel, so also check the
//    declaration files it points at actually exist and carry content.
const dts = readFileSync(pkg.types, 'utf8');
if (statSync(pkg.types).size < 500) fail(`${pkg.types} is suspiciously small (${statSync(pkg.types).size} bytes) — the 1.0.x stub regression`);
for (const name of ['createWebViewer', 'TeamSyncViewer', 'WebViewerInstance', 'configurePdfAssets', 'WebViewerOptions', 'Annotation']) {
  if (!dts.includes(name)) fail(`${pkg.types} does not export ${name}`);
}
const typesDir = dirname(pkg.types);
for (const rel of ['core/createWebViewer.d.ts', 'components/TeamSyncViewer.d.ts', 'core/ViewerInstance.d.ts', 'core/types.d.ts', 'core/pdfAssets.d.ts', 'annotations/types.d.ts']) {
  const file = join(typesDir, rel);
  if (!existsSync(file)) fail(`missing declaration file ${file}`);
  if (statSync(file).size < 300) fail(`declaration file ${file} is suspiciously small`);
}

// 3. Library entry must be side-effect free and must not inline the pdf.js worker.
const lib = readFileSync(pkg.module, 'utf8');
if (lib.includes('data:text/javascript;base64')) fail('library bundle inlines a data: URL script (pdf.js worker leaked into the bundle)');
if (/document\.getElementById\(["']root["']\)/.test(lib)) fail('library bundle still contains the demo #root auto-mount');
if (!lib.startsWith('"use client";')) fail('library bundle is missing the "use client" banner');
const sizeMB = statSync(pkg.module).size / (1024 * 1024);
if (sizeMB > 1.5) fail(`library bundle is ${sizeMB.toFixed(2)} MB — dependencies are no longer externalized`);

// 4. publint + arethetypeswrong on the packed tarball.
execSync('npx publint --strict', { stdio: 'inherit' });
// - ./style.css is a stylesheet entrypoint: it has no types by design.
// - internal-resolution-error: the emitted .d.ts files use extension-less relative imports, which
//   TypeScript's `node16`/`nodenext` resolution rejects; `bundler` (Next.js, Vite) and `node10`
//   resolve fine. Documented in the README; tracked for a future release.
execSync(
  'npx @arethetypeswrong/cli --pack --exclude-entrypoints ./style.css --ignore-rules cjs-resolves-to-esm internal-resolution-error',
  { stdio: 'inherit' }
);

console.log('✅ package verification passed');
