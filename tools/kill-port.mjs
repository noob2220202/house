#!/usr/bin/env node
// Stop whatever listens on the given TCP port(s) — cross-platform (Windows + POSIX).
// Usage: node tools/kill-port.mjs 3101 [3151 ...]
import { execSync } from 'node:child_process';

const ports = process.argv
  .slice(2)
  .map(Number)
  .filter((n) => Number.isInteger(n) && n > 0);
if (ports.length === 0) {
  console.error('Usage: node tools/kill-port.mjs <port> [port ...]');
  process.exit(2);
}
const run = (cmd) => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
};
for (const port of ports) {
  const pids = new Set();
  if (process.platform === 'win32') {
    for (const line of run('netstat -ano -p tcp').split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      if (cols[0] === 'TCP' && cols[1]?.endsWith(`:${port}`) && cols[3] === 'LISTENING')
        pids.add(cols[4]);
    }
    for (const pid of pids) run(`taskkill /PID ${pid} /T /F`);
  } else {
    for (const pid of run(`lsof -ti tcp:${port} -s tcp:LISTEN`).split(/\s+/).filter(Boolean))
      pids.add(pid);
    for (const pid of pids) run(`kill -TERM ${pid}`);
  }
  console.log(
    pids.size > 0
      ? `port ${port}: stopped pid ${[...pids].join(', ')}`
      : `port ${port}: nothing listening`,
  );
}
