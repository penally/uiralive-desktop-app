// Export all extension communication functions
export * from "./compatibility";
export * from "./messages";
export * from "./plasmo";
export * from "./request";
export * from "./streams";

import { isExtensionActive, extensionInfo } from "./messages";

// Check and log extension status on initialization
export async function checkExtensionStatus(): Promise<void> {
  try {
    const info = await extensionInfo();
    const isActive = await isExtensionActive();
    
    if (isActive) {
      console.log("✅ Browser extension is ENABLED and ready");
      console.log("Extension info:", info);
    } else if (info) {
      console.log("⚠️ Browser extension detected but NOT ACTIVE");
      console.log("Extension info:", info);
    } else {
      console.log("❌ Browser extension is NOT DETECTED");
    }
  } catch (error) {
    console.log("❌ Browser extension is NOT DETECTED (error checking)");
  }
}

// Auto-check extension status when module loads (optional)
// Uncomment the line below if you want automatic checking on page load
// checkExtensionStatus();
