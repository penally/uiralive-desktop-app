const path = require("path");
const fs = require("fs");

module.exports = async function (context) {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const appOutDir = context.appOutDir;
  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(__dirname, "..", "build", "icon.ico");

  if (!fs.existsSync(exePath)) {
    console.warn("[afterPack] Exe not found:", exePath);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn("[afterPack] Icon not found:", iconPath);
    return;
  }

  await rcedit(exePath, { icon: iconPath });
  console.log("[afterPack] Applied icon to", exePath);
};
