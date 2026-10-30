import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_BLOCKS = 3;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;
const STEP_TIMEOUT_MS = 100 * 1000;
const REPORT_LIMIT = 8 * 1024;
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

const step = (script, app) => ({ command: `npm run ${script} -w ${app}` });

const APPS = {
  api: ['test', 'test:e2e', 'check-types', 'lint'].map((script) =>
    step(script, 'api'),
  ),
  web: ['check-types', 'lint'].map((script) => step(script, 'web')),
};

const emit = (payload) => process.stdout.write(`${JSON.stringify(payload)}\n`);

function git(projectDir, args) {
  return execFileSync('git', args, {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function changedFiles(projectDir) {
  const scope = ['--', ...Object.keys(APPS).map((app) => `apps/${app}`)];
  const tracked = git(projectDir, [
    'diff',
    'HEAD',
    '--name-only',
    '--no-renames',
    '-z',
    ...scope,
  ]);
  const untracked = git(projectDir, [
    'ls-files',
    '-o',
    '--exclude-standard',
    '-z',
    ...scope,
  ]);
  const files = `${tracked}${untracked}`.split('\0').filter(Boolean);
  return [...new Set(files)].filter((file) => !file.endsWith('.md')).sort();
}

function fingerprintOf(projectDir, files) {
  const hash = createHash('sha256');
  for (const file of files) {
    const absolute = path.join(projectDir, file);
    const content = existsSync(absolute)
      ? createHash('sha256').update(readFileSync(absolute)).digest('hex')
      : 'deleted';
    hash.update(`${file}\0${content}\0`);
  }
  return hash.digest('hex');
}

function readState(statePath) {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}

const writeState = (statePath, state) =>
  writeFileSync(statePath, JSON.stringify(state));

function newest(names) {
  const parts = (name) => name.slice(1).split('.').map(Number);
  return names
    .sort((a, b) => {
      const [x, y] = [parts(a), parts(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    })
    .at(-1);
}

function toolchain(projectDir) {
  let env = process.env;
  try {
    const required = Number.parseInt(
      readFileSync(path.join(projectDir, '.nvmrc'), 'utf8')
        .trim()
        .replace(/^v/, ''),
      10,
    );
    if (Number(process.versions.node.split('.')[0]) < required) {
      const root = path.join(
        process.env.NVM_DIR ?? path.join(os.homedir(), '.nvm'),
        'versions/node',
      );
      const best = newest(
        readdirSync(root).filter((name) => name.startsWith(`v${required}.`)),
      );
      if (best) {
        env = {
          ...process.env,
          PATH: `${path.join(root, best, 'bin')}${path.delimiter}${process.env.PATH}`,
        };
      }
    }
  } catch {
    env = process.env;
  }
  const version = spawnSync('node', ['-v'], { env, encoding: 'utf8' });
  return { env, version: version.stdout?.trim() || 'unknown' };
}

function runStep(projectDir, env, { command }) {
  const result = spawnSync('sh', ['-c', `${command} 2>&1`], {
    cwd: projectDir,
    env,
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = (result.stdout ?? '').replace(ANSI, '');
  if (result.error) {
    const reason =
      result.error.code === 'ETIMEDOUT'
        ? `timed out after ${STEP_TIMEOUT_MS / 1000}s`
        : result.error.message;
    return { command, ok: false, reason, output };
  }
  return {
    command,
    ok: result.status === 0,
    reason: `exit ${result.status}`,
    output,
  };
}

function runChecks(projectDir, changed, env) {
  const steps = Object.keys(APPS)
    .filter((app) => changed.some((file) => file.startsWith(`apps/${app}/`)))
    .flatMap((app) =>
      app === 'api' && changed.includes('apps/api/prisma/schema.prisma')
        ? [step('db:generate', 'api'), ...APPS[app]]
        : APPS[app],
    );
  return steps
    .map((current) => runStep(projectDir, env, current))
    .filter((result) => !result.ok);
}

function tail(text, limit) {
  const lines = text.trimEnd().split('\n');
  const kept = [];
  let size = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (size + lines[i].length + 1 > limit) break;
    kept.unshift(lines[i]);
    size += lines[i].length + 1;
  }
  return kept.join('\n');
}

function describe(failures) {
  const budget = Math.floor(REPORT_LIMIT / failures.length);
  return failures
    .map(
      ({ command, reason, output }) =>
        `✖ ${command} (${reason})\n${tail(output, budget)}`,
    )
    .join('\n\n');
}

function main() {
  const projectDir = realpathSync(process.env.CLAUDE_PROJECT_DIR);
  const hooksDir = path.join(projectDir, '.claude/hooks');
  const statePath = path.join(hooksDir, '.verify-state.json');

  if (
    process.env.VERIFY_HOOK === '0' ||
    existsSync(path.join(hooksDir, '.verify-off'))
  ) {
    return;
  }

  const changed = changedFiles(projectDir);
  if (changed.length === 0) {
    rmSync(statePath, { force: true });
    return;
  }

  const fingerprint = fingerprintOf(projectDir, changed);
  const state = readState(statePath);
  if (state.status === 'passed' && state.fingerprint === fingerprint) return;

  const blocks =
    state.status === 'failed' && Date.now() - state.at < BLOCK_WINDOW_MS
      ? state.blocks
      : 0;
  if (blocks >= MAX_BLOCKS && state.fingerprint === fingerprint) {
    emit({
      systemMessage: `Проверка всё ещё красная после ${MAX_BLOCKS} блокировок, хук больше не блокирует. Не проходит: ${state.failed.join(', ')}.`,
    });
    return;
  }

  const { env, version } = toolchain(projectDir);
  const failures = runChecks(projectDir, changed, env);
  if (failures.length === 0) {
    writeState(statePath, { status: 'passed', fingerprint });
    return;
  }

  const blocking = blocks < MAX_BLOCKS;
  writeState(statePath, {
    status: 'failed',
    fingerprint,
    blocks: blocking ? blocks + 1 : blocks,
    at: Date.now(),
    failed: failures.map(({ command }) => command),
  });

  const report = describe(failures);
  emit(
    blocking
      ? {
          decision: 'block',
          reason: `Verification failed (block ${blocks + 1} of ${MAX_BLOCKS}, Node ${version}). Fix the problems below, then finish again: the checks re-run automatically.\n\n${report}\n\nRe-run a command above to see its full output.`,
        }
      : {
          systemMessage: `Проверка красная, но лимит блокировок (${MAX_BLOCKS}) исчерпан, хук больше не блокирует.\n\n${report}`,
        },
  );
}

function drainStdin() {
  try {
    readFileSync(0);
  } catch {
    return;
  }
}

try {
  drainStdin();
  main();
} catch (error) {
  emit({ systemMessage: `Хук проверки не смог отработать: ${error.message}` });
}
