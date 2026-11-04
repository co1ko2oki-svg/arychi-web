import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const ext = isWin ? '.exe' : '';
const binDir = path.join(rootDir, 'bin');

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const binaries = [
  { name: `quest-server${ext}`, path: './backend/cmd/quest' },
  { name: `stream-server${ext}`, path: './backend/cmd/stream' },
  { name: `arychi-server${ext}`, path: './backend/cmd/server' },
  { name: `quest-bot${ext}`, path: './backend/cmd/bot' },
  { name: `spoofer${ext}`, path: './backend/cmd/spoofer' },
];

console.log(`\x1b[36m[Build] Compiling Go binaries for ${process.platform} (${process.arch})...\x1b[0m`);

for (const b of binaries) {
  const outPath = path.join(binDir, b.name);
  console.log(`  -> Building ${b.name}...`);
  execSync(`go build -o "${outPath}" ${b.path}`, { cwd: rootDir, stdio: 'inherit' });
  if (!isWin) {
    try {
      fs.chmodSync(outPath, 0o755);
    } catch {}
  }
}

console.log(`\x1b[32m[Build] All binaries compiled successfully in bin/\x1b[0m`);
