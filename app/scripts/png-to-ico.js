const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const toIco = require('to-ico');

const appDir = path.join(__dirname, '..');
const pngPath = path.join(appDir, 'build', 'icon.png');
const icoPath = path.join(appDir, 'build', 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('build/icon.png not found. Copy manifest-icon-512.maskable.png to build/icon.png first.');
  process.exit(1);
}

async function run() {
  const img = sharp(fs.readFileSync(pngPath));
  const meta = await img.metadata();
  const bg = { r: 0, g: 0, b: 0, alpha: 1 };

  // Always ensure 512x512 PNG for macOS (electron-builder requires at least 512x512)
  const square512 = await img
    .clone()
    .resize(512, 512, { fit: 'contain', background: bg })
    .png()
    .toBuffer();
  fs.writeFileSync(pngPath, square512);
  if ((meta.width || 0) < 512 || (meta.height || 0) < 512) {
    console.log('Resized build/icon.png to 512x512 for macOS');
  }

  // Create .ico for Windows (256 max for ICO format)
  const square256 = await img
    .clone()
    .resize(256, 256, { fit: 'contain', background: bg })
    .png()
    .toBuffer();
  const buf = await toIco(square256, { resize: true, sizes: [16, 32, 48, 256] });
  fs.writeFileSync(icoPath, buf);
  console.log('Created build/icon.ico');
}

run().catch(err => {
  console.error('Failed to create icon.ico:', err.message);
  process.exit(1);
});
