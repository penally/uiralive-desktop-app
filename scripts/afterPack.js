const path = require("path");
const fs = require("fs");

function findExeFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      findExeFiles(full, files);
    } else if (e.name.endsWith(".exe")) {
      files.push(full);
    }
  }
  return files;
}

module.exports = async function (context) {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = await import("rcedit");
  const appOutDir = context.appOutDir;
  const appInfo = context.packager.appInfo;
  const productFilename = appInfo.productFilename;
  const productName = appInfo.productName || "Uira Live";
  const iconPath = path.resolve(__dirname, "..", "build", "icon.ico");

  if (!fs.existsSync(iconPath)) {
    console.warn("[afterPack] Icon not found:", iconPath);
    return;
  }

  const exeFiles = findExeFiles(appOutDir);

  for (const exePath of exeFiles) {
    const exeName = path.basename(exePath);
    try {
      await rcedit(exePath, {
        icon: iconPath,
        "version-string": {
          FileDescription: productName,
          ProductName: productName,
          CompanyName: "Uira Live",
          OriginalFilename: exeName,
        },
        "file-version": appInfo.version,
        "product-version": appInfo.version,
      });
      console.log("[afterPack] Applied icon and metadata to", path.basename(exePath));
    } catch (err) {
      console.warn("[afterPack] Could not apply to", path.basename(exePath), "(Wine may be missing on Linux):", err.message);
    }
  }
};
