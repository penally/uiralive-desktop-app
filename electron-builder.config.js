require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const pkg = require("./package.json");
const updateUrl = process.env.UPDATE_SERVER_URL || "http://localhost:8080";
const useGitHub = process.env.PUBLISH_GITHUB === "true";

// Releases always go to penally/uiralive-desktop-app (NOT penally/uiralive)
const RELEASE_OWNER = "penally";
const RELEASE_REPO = "uiralive-desktop-app";

module.exports = {
  ...pkg.build,
  publish: useGitHub
    ? {
        provider: "github",
        owner: RELEASE_OWNER,
        repo: RELEASE_REPO,
        releaseType: "release",
        vPrefixedTagName: true,
      }
    : {
        provider: "generic",
        url: updateUrl,
      },
};
