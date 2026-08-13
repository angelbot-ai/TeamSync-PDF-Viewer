#!/bin/bash
set -e

PROJECT_ROOT=$(pwd)
DIST_DIR="$PROJECT_ROOT/dist"
PACKAGE_DIR="$PROJECT_ROOT/teamsync-pdfviewer-package"
ZIP_PATH="$PROJECT_ROOT/teamsync-pdfviewer-package.zip"

echo "📦 Starting packaging process..."

echo -e "\n🔨 Building the application..."
npm run build

echo -e "\n📁 Preparing package directory..."
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

echo "📄 Copying assets..."
cp -r "$DIST_DIR/"* "$PACKAGE_DIR/"
cp "$PROJECT_ROOT/public/webviewer.js" "$PACKAGE_DIR/webviewer.js" || true # Ignore if Vite already copied it
cp "$PROJECT_ROOT/LICENSE" "$PACKAGE_DIR/LICENSE" || true

echo -e "\n🗜️ Creating ZIP archive..."
rm -f "$ZIP_PATH"
cd "$PROJECT_ROOT"
zip -qr "teamsync-pdfviewer-package.zip" "teamsync-pdfviewer-package"

echo -e "\n✅ Packaging complete!"
echo "📁 Package folder: $PACKAGE_DIR"
echo "📦 Archive created: $ZIP_PATH"
echo -e "\nHand over 'teamsync-pdfviewer-package.zip' to your developers."
