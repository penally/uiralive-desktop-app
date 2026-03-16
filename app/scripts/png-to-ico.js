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
  const square256 = await sharp(fs.readFileSync(pngPath))
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
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
