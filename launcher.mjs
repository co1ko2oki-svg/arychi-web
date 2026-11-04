import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;

const PORTS = [3001, 3000, 5173];

const freePortOnWindows = (port) => {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = output.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const state = parts[3];
      const pid = parts[parts.length - 1];
      if (state === 'LISTENING' && pid && pid !== '0') {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
        console.log(`\x1b[33m[Port Guard] Da giai phong cong ${port} (PID: ${pid})\x1b[0m`);
      } catch {}
    }
  } catch {}
};

const preflightPortCheck = () => {
  if (process.platform === 'win32') {
    for (const port of PORTS) {
      freePortOnWindows(port);
    }
  }
};

const openBrowser = (url) => {
  try {
    if (process.platform === 'win32') {
      execSync(`start ${url}`, { stdio: 'ignore' });
    } else if (process.platform === 'darwin') {
      execSync(`open ${url}`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open ${url}`, { stdio: 'ignore' });
    }
  } catch {}
};

const children = [];

const terminateAllServices = () => {
  console.log('\n\x1b[31m[Launcher] Dang dung toan bo cac tien trinh dich vu...\x1b[0m');
  for (const item of children) {
    if (item.process && item.process.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${item.process.pid} /F /T`, { stdio: 'ignore' });
        } else {
          process.kill(-item.process.pid, 'SIGKILL');
        }
      } catch {}
    }
  }
  console.log('\x1b[32m[Launcher] Tat ca dich vu da duoc giai phong an toan. Tam biet!\x1b[0m\n');
  process.exit(0);
};

process.on('SIGINT', terminateAllServices);
process.on('SIGTERM', terminateAllServices);

const printBanner = () => {
  console.log('\x1b[36m===============================================================\x1b[0m');
  console.log('\x1b[36m     ARYCHI WEB SUITE v2.0 - UNIFIED PROCESS LAUNCHER          \x1b[0m');
  console.log('\x1b[36m===============================================================\x1b[0m');
  console.log(' \x1b[35m● [Quest Engine]\x1b[0m   http://localhost:3001 (WS/REST & Heartbeat)');
  console.log(' \x1b[33m● [StreamBot]\x1b[0m      http://localhost:3000 (Voice Stream & Farm)');
  console.log(' \x1b[32m● [Frontend UI]\x1b[0m    http://localhost:5173 (Vite + React UI)');
  console.log('\x1b[36m---------------------------------------------------------------\x1b[0m');
  console.log(' \x1b[90mNhan \x1b[0m\x1b[1m[Ctrl + C]\x1b[0m \x1b[90mde dong tat ca cac dich vu cung luc.\x1b[0m');
  console.log('\x1b[36m===============================================================\x1b[0m\n');
};

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
    return env;
  } catch {
    return {};
  }
};

const startServices = () => {
  preflightPortCheck();
  printBanner();

  const rootEnv = parseEnvFile(path.join(rootDir, '.env'));

  const questGoBin = path.join(rootDir, 'bin', process.platform === 'win32' ? 'quest-server.exe' : 'quest-server');
  const streamGoBin = path.join(rootDir, 'bin', process.platform === 'win32' ? 'stream-server.exe' : 'stream-server');

  if (!fs.existsSync(questGoBin)) {
    console.log('\x1b[33m[Launcher] Bien dich quest-server Go lan dau...\x1b[0m');
    try {
      execSync('go build -o bin/quest-server.exe ./backend/cmd/quest', { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
      console.warn('\x1b[31m[Launcher] Khong the build quest-server Go:\x1b[0m', err?.message);
    }
  }

  if (!fs.existsSync(streamGoBin)) {
    console.log('\x1b[33m[Launcher] Bien dich stream-server Go lan dau...\x1b[0m');
    try {
      execSync('go build -o bin/stream-server.exe ./backend/cmd/stream', { cwd: rootDir, stdio: 'inherit' });
    } catch (err) {
      console.warn('\x1b[31m[Launcher] Khong the build stream-server Go:\x1b[0m', err?.message);
    }
  }

  console.log('\x1b[32m[Launcher] Khoi dong cac dich vu Go Backend hieu nang cao (bin/quest-server & bin/stream-server)...\x1b[0m');

  const services = [
    {
      name: 'QUEST :3001 (Go)',
      color: '\x1b[35m',
      cwd: rootDir,
      cmd: questGoBin,
      args: [],
    },
    {
      name: 'STREAM :3000 (Go)',
      color: '\x1b[33m',
      cwd: rootDir,
      cmd: streamGoBin,
      args: [],
    },
    {
      name: 'WEB :5173',
      color: '\x1b[32m',
      cwd: path.join(rootDir, 'frontend'),
      cmd: process.platform === 'win32' ? 'cmd.exe' : 'npx',
      args: process.platform === 'win32' ? ['/c', 'npx', 'vite', '--port', '5173'] : ['vite', '--port', '5173'],
    },
  ];

  let browserOpened = false;

  services.forEach((service) => {
    const child = spawn(service.cmd, service.args, {
      cwd: service.cwd,
      env: { ...process.env, ...rootEnv, FORCE_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    children.push({ name: service.name, process: child });

    const prefix = `${service.color}[${service.name}]\x1b[0m `;

    const formatLogs = (data) => {
      const lines = data.toString().split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        console.log(`${prefix}${line}`);

        if (!browserOpened && (line.includes('5173') || line.includes('Local:'))) {
          browserOpened = true;
          setTimeout(() => {
            console.log(`\x1b[32m[Launcher] Dang tu dong mo trinh duyet den http://localhost:5173...\x1b[0m`);
            openBrowser('http://localhost:5173');
          }, 800);
        }
      }
    };

    child.stdout.on('data', formatLogs);
    child.stderr.on('data', formatLogs);

    child.on('error', (err) => {
      console.error(`${prefix}\x1b[31mLoi khoi chay:\x1b[0m`, err?.message || err);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(`${prefix}\x1b[33mDich vu da thoat voi ma: ${code}\x1b[0m`);
      }
    });
  });

  setTimeout(() => {
    if (!browserOpened) {
      browserOpened = true;
      console.log(`\x1b[32m[Launcher] Dang tu dong mo trinh duyet den http://localhost:5173...\x1b[0m`);
      openBrowser('http://localhost:5173');
    }
  }, 2500);
};

startServices();
