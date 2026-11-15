import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MAX_ATTEMPTS = 3;
const BASE_BRANCH = 'main';
const BLOCKED_LABEL = 'blocked';

const output = { messages: [] };

function emit({ systemMessage, ...rest }) {
  if (systemMessage) output.messages.push(systemMessage);
  Object.assign(output, rest);
}

function flush() {
  const { messages, ...rest } = output;
  const payload = messages.length
    ? { ...rest, systemMessage: messages.join('\n') }
    : rest;
  if (Object.keys(payload).length > 0) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  }
}

const run = (projectDir, command, args) =>
  execFileSync(command, args, {
    cwd: projectDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function openIssues(projectDir, milestone) {
  const output = run(projectDir, 'gh', [
    'issue',
    'list',
    '--milestone',
    milestone,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,title,labels',
  ]);
  return JSON.parse(output).sort((a, b) => a.number - b.number);
}

const isBlocked = (issue) =>
  issue.labels.some(({ name }) => name === BLOCKED_LABEL);

function openPullRequest(projectDir, milestone, branch) {
  const existing = JSON.parse(
    run(projectDir, 'gh', [
      'pr',
      'list',
      '--head',
      branch,
      '--state',
      'open',
      '--json',
      'url',
    ]),
  );
  if (existing.length > 0) return null;

  const ahead = Number(
    run(projectDir, 'git', ['rev-list', '--count', `${BASE_BRANCH}..HEAD`]),
  );
  if (ahead === 0) return null;

  run(projectDir, 'git', ['push', '-u', 'origin', branch]);
  return run(projectDir, 'gh', [
    'pr',
    'create',
    '--base',
    BASE_BRANCH,
    '--head',
    branch,
    '--title',
    `feat: ${milestone}`,
    '--body',
    `Закрывает все Issues из milestone «${milestone}».`,
  ]);
}

const codeChanges = (projectDir) =>
  run(projectDir, 'git', ['status', '--porcelain', '--', 'apps', 'packages']);

function succeeds(projectDir, command, args) {
  try {
    run(projectDir, command, args);
    return true;
  } catch {
    return false;
  }
}

function ensureBranch(projectDir, branch) {
  const current = run(projectDir, 'git', ['branch', '--show-current']);
  if (current === branch) return branch;

  if (current !== BASE_BRANCH) {
    emit({
      systemMessage: `Ralph loop пропущен: текущая ветка ${current || 'detached HEAD'}. Хук стартует только с ${BASE_BRANCH} или с ${branch} из ralph.config.json.`,
    });
    return null;
  }
  if (codeChanges(projectDir)) {
    emit({
      systemMessage: `Ralph loop пропущен: в ${BASE_BRANCH} есть незакоммиченные изменения в apps/ или packages/. Закоммить или убери их, чтобы хук переключился на ${branch}.`,
    });
    return null;
  }

  run(projectDir, 'git', ['fetch', 'origin', BASE_BRANCH]);
  if (
    succeeds(projectDir, 'git', [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ])
  ) {
    run(projectDir, 'git', ['switch', branch]);
    emit({ systemMessage: `Ralph loop: переключился на ветку ${branch}.` });
  } else if (
    run(projectDir, 'git', ['ls-remote', '--heads', 'origin', branch])
  ) {
    run(projectDir, 'git', [
      'switch',
      '-c',
      branch,
      '--track',
      `origin/${branch}`,
    ]);
    emit({
      systemMessage: `Ralph loop: взял ветку ${branch} с origin и переключился на неё.`,
    });
  } else {
    run(projectDir, 'git', [
      'switch',
      '--no-track',
      '-c',
      branch,
      `origin/${BASE_BRANCH}`,
    ]);
    emit({
      systemMessage: `Ralph loop: создал ветку ${branch} от свежего origin/${BASE_BRANCH}.`,
    });
  }
  return branch;
}

function main() {
  const projectDir = realpathSync(process.env.CLAUDE_PROJECT_DIR);
  const configPath = path.join(projectDir, '.claude/ralph.config.json');
  const statePath = path.join(projectDir, '.claude/hooks/.ralph-state.json');
  const config = readJson(configPath, {});

  if (!config.milestone || process.env.RALPH_HOOK === '0') return;

  const milestones = JSON.parse(
    run(projectDir, 'gh', [
      'api',
      'repos/{owner}/{repo}/milestones?state=all&per_page=100',
    ]),
  ).map(({ title }) => title);
  if (!milestones.includes(config.milestone)) {
    emit({
      systemMessage: `Ralph loop пропущен: milestone «${config.milestone}» не найден на GitHub.`,
    });
    return;
  }

  if (!config.branch || config.branch === BASE_BRANCH) {
    emit({
      systemMessage: `Ralph loop пропущен: укажи в ralph.config.json рабочую ветку (не ${BASE_BRANCH}).`,
    });
    return;
  }
  const branch = ensureBranch(projectDir, config.branch);
  if (!branch) return;

  const dirty = codeChanges(projectDir);
  const open = openIssues(projectDir, config.milestone);
  const blocked = open.filter(isBlocked);
  const issues = open.filter((issue) => !isBlocked(issue));

  if (issues.length === 0 && blocked.length > 0) {
    rmSync(statePath, { force: true });
    emit({
      systemMessage: `Ralph loop остановлен: в milestone «${config.milestone}» остались только Issues с меткой ${BLOCKED_LABEL}: ${blocked.map(({ number }) => `#${number}`).join(', ')}. Разбери их и сними метку, PR не создан.`,
    });
    return;
  }

  if (issues.length === 0) {
    rmSync(statePath, { force: true });
    if (dirty) {
      emit({
        decision: 'block',
        reason: `Все Issues milestone «${config.milestone}» закрыты, но в apps/ остались незакоммиченные изменения. Доведи проверки до зелёного и закоммить их.`,
      });
      return;
    }
    const url = openPullRequest(projectDir, config.milestone, branch);
    if (url) {
      emit({
        systemMessage: `✅ Milestone «${config.milestone}» завершён. PR: ${url}`,
      });
    }
    return;
  }

  const next = issues[0];
  const state = readJson(statePath, {});
  const attempts = state.issue === next.number ? state.attempts + 1 : 1;
  if (attempts > MAX_ATTEMPTS) {
    emit({
      systemMessage: `Ralph loop остановлен: Issue #${next.number} всё ещё открыта после ${MAX_ATTEMPTS} попыток. Разберись вручную; счётчик сбросится, когда Issue закроется или удалишь .claude/hooks/.ralph-state.json.`,
    });
    return;
  }
  writeFileSync(
    statePath,
    JSON.stringify({ issue: next.number, attempts, at: Date.now() }),
  );

  const prompt = (config.prompt ?? '')
    .replaceAll('{milestone}', config.milestone)
    .replaceAll('{issue}', `#${next.number}`)
    .replaceAll('{branch}', config.branch);
  const pending = dirty
    ? '\n\nВ apps/ есть незакоммиченные изменения: сначала доведи проверки до зелёного и закоммить их.'
    : '';

  emit({
    decision: 'block',
    reason: `🔄 Ralph loop, попытка ${attempts} из ${MAX_ATTEMPTS}. Следующая Issue #${next.number}: ${next.title}\n\n${prompt}${pending}`,
    systemMessage: `🔄 Ralph loop: Issue #${next.number} «${next.title}» (осталось ${issues.length})`,
  });
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
  emit({ systemMessage: `Ralph loop не смог отработать: ${error.message}` });
}
flush();
