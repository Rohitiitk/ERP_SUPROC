// scripts/run-backend.cjs
const { spawn } = require('child_process');
const { join } = require('path');
const { existsSync } = require('fs');

// Prefer a local virtualenv if present, then fall back to PATH candidates.
const venvCandidates = [
  join(__dirname, '..', 'v', 'Scripts', 'python.exe'), // Windows venv
  join(__dirname, '..', 'v', 'Scripts', 'python'),     // Windows alternate
  join(__dirname, '..', 'v', 'bin', 'python')          // Unix venv
];

const fallback = [
  process.env.PYTHON, // explicit override if set
  'python3',
  'python',
  'py -3', // Windows launcher with arg
  'py'     // Windows launcher fallback
].filter(Boolean);

const candidates = [];
for (const p of venvCandidates) if (existsSync(p)) candidates.push(p);
for (const f of fallback) candidates.push(f);

function spawnCmd(cmd, args, opts) {
  // If cmd looks like a path (contains a slash or backslash) treat it as a single executable path.
  if (cmd.includes('/') || cmd.includes('\\')) {
    return spawn(cmd, args, opts);
  }
  // Otherwise split on space to allow commands like "py -3" to include args.
  const parts = cmd.split(' ');
  return spawn(parts.shift(), [...parts, ...args], opts);
}

function attempt(index) {
  if (index >= candidates.length) {
    console.error('[backend] Python 3 not found. Install Python 3.10+ and ensure it is on PATH, or create a local venv at `v`.');
    process.exit(1);
  }

  const exe = candidates[index];
  if (!exe) return attempt(index + 1);
  if ((exe.includes('/') || exe.includes('\\')) && !existsSync(exe)) {
    return attempt(index + 1);
  }

  try {
    const child = spawnCmd(exe, ['-m', 'api.app'], { stdio: 'inherit', cwd: join(__dirname, '..') });
    child.on('exit', code => process.exit(code ?? 0));
    child.on('error', (err) => {
      console.error(`[backend] Failed to spawn "${exe}": ${err.message}`);
      attempt(index + 1);
    });
  } catch (err) {
    console.error(`[backend] Error starting "${exe}": ${err.message}`);
    attempt(index + 1);
  }
}

attempt(0);
