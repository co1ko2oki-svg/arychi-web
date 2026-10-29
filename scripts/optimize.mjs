import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const getDirSizeInMB = (dirPath) => {
  if (!fs.existsSync(dirPath)) return 0;
  let totalBytes = 0;

  const calculate = (currentPath) => {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        try {
          if (entry.isDirectory()) {
            calculate(fullPath);
          } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            totalBytes += stats.size;
          }
        } catch {}
      }
    } catch {}
  };

  calculate(dirPath);
  return Number((totalBytes / (1024 * 1024)).toFixed(2));
};

const removeDirectory = (targetPath) => {
  if (fs.existsSync(targetPath)) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return true;
    } catch (err) {
      console.warn(`[Optimize] Khong the xoa ${targetPath}:`, err?.message || err);
    }
  }
  return false;
};

const runOptimization = () => {
  console.log('\x1b[36m===================================================\x1b[0m');
  console.log('\x1b[36m   ARYCHI SUITE - OPTIMIZE DEPENDENCY STORAGE      \x1b[0m');
  console.log('\x1b[36m===================================================\x1b[0m');

  const targets = [
    { name: 'Frontend (font end)', dir: path.join(rootDir, 'font end', 'node_modules') },
    { name: 'Quest Backend', dir: path.join(rootDir, 'quest', 'node_modules') },
    { name: 'StreamBot Voice', dir: path.join(rootDir, 'stream', 'node_modules') },
  ];

  let initialTotalMB = 0;
  targets.forEach((t) => {
    const size = getDirSizeInMB(t.dir);
    initialTotalMB += size;
    console.log(`\x1b[90m- ${t.name}: \x1b[0m\x1b[33m${size} MB\x1b[0m`);
  });
  console.log(`\x1b[1mTong dung luong ban dau: \x1b[33m${initialTotalMB.toFixed(2)} MB\x1b[0m\n`);

  let removedItemsCount = 0;

  if (process.platform === 'win32') {
    const mingwPath = path.join(rootDir, 'stream', 'node_modules', '@seydx', 'node-av-win32-x64-mingw');
    if (fs.existsSync(mingwPath)) {
      const mingwSize = getDirSizeInMB(mingwPath);
      if (removeDirectory(mingwPath)) {
        console.log(`\x1b[32m[OK]\x1b[0m Da go bo binary MinGW khong su dung (@seydx/node-av-win32-x64-mingw): -\x1b[32m${mingwSize} MB\x1b[0m`);
        removedItemsCount++;
      }
    }
  }

  const viteCache = path.join(rootDir, 'font end', 'node_modules', '.vite');
  if (fs.existsSync(viteCache)) {
    const cacheSize = getDirSizeInMB(viteCache);
    if (removeDirectory(viteCache)) {
      console.log(`\x1b[32m[OK]\x1b[0m Da don dep bo nho cache tam Vite (.vite): -\x1b[32m${cacheSize} MB\x1b[0m`);
      removedItemsCount++;
    }
  }

  let finalTotalMB = 0;
  console.log('\n\x1b[36mKet qua sau khi toi uu:\x1b[0m');
  targets.forEach((t) => {
    const size = getDirSizeInMB(t.dir);
    finalTotalMB += size;
    console.log(`\x1b[90m- ${t.name}: \x1b[0m\x1b[32m${size} MB\x1b[0m`);
  });

  const savedMB = Math.max(0, initialTotalMB - finalTotalMB);
  console.log('\n\x1b[32m===================================================\x1b[0m');
  console.log(`\x1b[32m  Hoan tat toi uu! Tiet kiem duoc: ${savedMB.toFixed(2)} MB\x1b[0m`);
  console.log(`\x1b[32m  Dung luong hien tai: ${finalTotalMB.toFixed(2)} MB\x1b[0m`);
  console.log('\x1b[32m===================================================\x1b[0m');
};

runOptimization();
