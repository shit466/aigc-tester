import { access, mkdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");
const zipPath = path.join(releaseDir, "papertrace-web.zip");

await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });

const candidates = [
  "dist",
  "src",
  "index.html",
  "package.json",
  "package-lock.json",
  "README.md",
  "vite.config.js",
  "eslint.config.js"
];

const files = [];
for (const candidate of candidates) {
  try {
    await access(path.join(root, candidate));
    files.push(candidate);
  } catch {
    // Optional release inputs, such as package-lock.json, may be absent.
  }
}

await new Promise((resolve, reject) => {
  const zip = spawn("zip", ["-qr", zipPath, ...files], { cwd: root, stdio: ["ignore", "ignore", "pipe"] });
  let error = "";
  zip.stderr.on("data", chunk => {
    error += chunk.toString();
  });
  zip.on("error", reject);
  zip.on("close", code => {
    if (code === 0) resolve();
    else reject(new Error(error || `zip exited with ${code}`));
  });
});

const marker = createWriteStream(path.join(releaseDir, "README.txt"));
marker.end("PaperTrace release package. Unzip, run npm install, then npm run dev. Static build is in dist/.\\n");

console.log(`Created ${zipPath}`);
