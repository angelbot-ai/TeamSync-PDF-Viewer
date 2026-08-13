const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PACKAGE_DIR = path.join(PROJECT_ROOT, 'teamsync-pdfviewer-package');
const ZIP_PATH = path.join(PROJECT_ROOT, 'teamsync-pdfviewer-package.zip');

async function packageApp() {
  console.log('📦 Starting packaging process...');

  // 1. Build the Vite app
  console.log('\n🔨 Building the application...');
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });

  // 2. Prepare the package directory
  console.log('\n📁 Preparing package directory...');
  if (fs.existsSync(PACKAGE_DIR)) {
    fs.rmSync(PACKAGE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PACKAGE_DIR);

  // 3. Copy dist/ into package/lib/ui/ (to mimic legacy structure somewhat, or just package/)
  console.log('📄 Copying assets...');
  
  // We'll put the built react app in pdfviewer-package/
  fs.copySync(DIST_DIR, PACKAGE_DIR);
  
  // Ensure webviewer.js is explicitly at the root of the package if not already copied by Vite
  const webviewerSrc = path.join(PROJECT_ROOT, 'public', 'webviewer.js');
  const webviewerDest = path.join(PACKAGE_DIR, 'webviewer.js');
  if (!fs.existsSync(webviewerDest)) {
    fs.copySync(webviewerSrc, webviewerDest);
  }

  const licenseSrc = path.join(PROJECT_ROOT, 'LICENSE');
  const licenseDest = path.join(PACKAGE_DIR, 'LICENSE');
  if (fs.existsSync(licenseSrc)) {
    fs.copySync(licenseSrc, licenseDest);
  }

  // 4. Create ZIP archive
  console.log('\n🗜️ Creating ZIP archive...');
  const output = fs.createWriteStream(ZIP_PATH);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log(`\n✅ Packaging complete!`);
      console.log(`📁 Package folder: ${PACKAGE_DIR}`);
      console.log(`📦 Archive created: ${ZIP_PATH} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`\nHand over the 'teamsync-pdfviewer-package.zip' to your developers.`);
      resolve();
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(PACKAGE_DIR, 'teamsync-pdfviewer-package');
    archive.finalize();
  });
}

packageApp().catch(console.error);
