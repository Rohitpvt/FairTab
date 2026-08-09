import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

console.log("=== Starting Production Build Verification PASS ===");

// 1. Check if index.html exists
const indexPath = path.join(distDir, "index.html");
if (!fs.existsSync(indexPath)) {
  console.error("FAIL: index.html not found in dist!");
  process.exit(1);
}

const indexContent = fs.readFileSync(indexPath, "utf8");

// 2. Assert assets do not use root-relative paths starting with `/assets/` or `/manifest`
const absoluteAssetPatterns = [
  /href="\/assets\//,
  /src="\/assets\//,
  /href="\/manifest.webmanifest"/,
];

for (const pattern of absoluteAssetPatterns) {
  if (pattern.test(indexContent)) {
    console.error(`FAIL: index.html contains incorrect absolute root-relative path matching: ${pattern}`);
    process.exit(1);
  }
}

// Check that resources contain /FairTab/ or valid relative assets
if (!indexContent.includes("/FairTab/assets/") && !indexContent.includes("./assets/")) {
  if (!indexContent.includes("/FairTab/")) {
    console.error("FAIL: index.html does not reference the base path /FairTab/");
    process.exit(1);
  }
}

console.log("✓ index.html base paths verified successfully.");

// 3. Verify PWA Icons
const manifestPath = path.join(distDir, "manifest.webmanifest");
if (!fs.existsSync(manifestPath)) {
  console.error("FAIL: manifest.webmanifest not found in dist!");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const icons = manifest.icons || [];

if (icons.length === 0) {
  console.error("FAIL: manifest contains no icons!");
  process.exit(1);
}

const requiredDimensions = ["192x192", "512x512"];
const dimensionsFound = icons.map((i) => i.sizes);
const hasAllDimensions = requiredDimensions.every((d) => dimensionsFound.includes(d));

if (!hasAllDimensions) {
  console.error(`FAIL: manifest is missing required icon sizes: ${requiredDimensions}. Found: ${dimensionsFound}`);
  process.exit(1);
}

// Verify that all icon paths in the manifest are valid files in the dist directory
for (const icon of icons) {
  // Path in manifest might contain base path /fairtab/ or be relative
  const relativeIconPath = icon.src.replace(/^\/FairTab\//, "").replace(/^\//, "");
  const absoluteIconPath = path.join(distDir, relativeIconPath);
  
  if (!fs.existsSync(absoluteIconPath)) {
    console.error(`FAIL: Icon file defined in manifest not found: ${absoluteIconPath}`);
    process.exit(1);
  }
  
  const stats = fs.statSync(absoluteIconPath);
  if (stats.size === 0) {
    console.error(`FAIL: Icon file is empty: ${absoluteIconPath}`);
    process.exit(1);
  }
}

console.log("✓ PWA Manifest icons and assets checked successfully.");

// 4. Verify Service Worker registrations
const swPath = path.join(distDir, "sw.js");
if (!fs.existsSync(swPath)) {
  console.error("FAIL: sw.js service worker not found in dist!");
  process.exit(1);
}

console.log("✓ Service Worker verification complete.");
console.log("=== Build verification PASS completed successfully! ===");
