import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const binDir = path.join(rootDir, 'bin');
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

const binaries = [
  { name: 'quest-server', path: './backend/cmd/quest' },
  { name: 'stream-server', path: './backend/cmd/stream' },
  { name: 'arychi-server', path: './backend/cmd/server' },
  { name: 'quest-bot', path: './backend/cmd/bot' },
  { name: 'spoofer', path: './backend/cmd/spoofer' },
];

console.log('\x1b[36m[Cross-Compile] Building Go binaries for Linux (GOOS=linux GOARCH=amd64)...\x1b[0m');

for (const b of binaries) {
  const outPath = path.join(binDir, b.name);
  console.log(`  -> Cross-compiling ${b.name} for Linux...`);
  execSync(`go build -o "${outPath}" ${b.path}`, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, GOOS: 'linux', GOARCH: 'amd64' },
  });
}

console.log('\x1b[32m[Cross-Compile] Successfully compiled Linux 64-bit binaries in bin/\x1b[0m');
