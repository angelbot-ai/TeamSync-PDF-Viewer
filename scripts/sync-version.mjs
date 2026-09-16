/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * Helper script to synchronize src/version.ts with package.json and GitHub release tags.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const packageJsonUrl = new URL('../package.json', import.meta.url);
const versionFileUrl = new URL('../src/version.ts', import.meta.url);

const pkg = JSON.parse(fs.readFileSync(packageJsonUrl, 'utf8'));

let releaseVersion = pkg.version;

try {
  const gitTag = execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
  if (gitTag && gitTag.startsWith('v')) {
    const tagNum = gitTag.slice(1);
    if (tagNum) {
      releaseVersion = tagNum;
    }
  }
} catch {
  // Fall back to package.json version if git is unavailable
}

const content = `/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 * TeamSync PDF Viewer SDK Version.
 *
 * This version is automatically synchronized with package.json and GitHub release tags.
 * DO NOT EDIT MANUALLY.
 */
declare const __APP_VERSION__: string | undefined;

export const VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '${releaseVersion}';
`;

fs.writeFileSync(versionFileUrl, content, 'utf8');
console.log(`✓ Synchronized src/version.ts to version ${releaseVersion}`);
