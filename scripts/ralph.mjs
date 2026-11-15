import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_BRANCH = 'main';
const BLOCKED_LABEL = 'blocked';
const MAX_ATTEMPTS = 3;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, '.claude/ralph.config.json');
const counterPath = path.join(root, '.claude/ralph.iterations.json');
const progressPath = path.join(root, '.claude/ralph.progress.md');

class Stop extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

const run = (command, args) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function succeeds(command, args) {
  try {
    run(command, args);
    return true;
  } catch {
    return false;
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const writeCounter = (count) =>
  writeFileSync(counterPath, `${JSON.stringify({ count })}\n`);

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

function loadConfig() {
  const config = readJson(configPath, null);
  if (!config) throw new Stop(`Не удалось прочитать ${configPath}.`);
  if (!config.milestone) {
    throw new Stop('Укажи milestone в .claude/ralph.config.json.');
  }
  if (!config.branch || config.branch === BASE_BRANCH) {
    throw new Stop(
      `Укажи в .claude/ralph.config.json рабочую ветку (не ${BASE_BRANCH}).`,
    );
  }
  for (const key of ['maxIterations', 'maxTurns']) {
    if (!isPositiveInteger(config[key])) {
      throw new Stop(
        `${key} в .claude/ralph.config.json должен быть целым числом больше 0.`,
      );
    }
  }
  for (const key of ['model', 'reviewModel']) {
    if (config[key] !== undefined && typeof config[key] !== 'string') {
      throw new Stop(`${key} в .claude/ralph.config.json должен быть строкой.`);
    }
  }
  return config;
}

function assertMilestone(milestone) {
  const titles = JSON.parse(
    run('gh', [
      'api',
      'repos/{owner}/{repo}/milestones?state=all&per_page=100',
    ]),
  ).map(({ title }) => title);
  if (!titles.includes(milestone)) {
    throw new Stop(`Milestone «${milestone}» не найден на GitHub.`);
  }
}

const codeChanges = () =>
  run('git', ['status', '--porcelain', '--', 'apps', 'packages']);

function ensureBranch(branch) {
  const current = run('git', ['branch', '--show-current']);
  if (current === branch) return;

  if (current !== BASE_BRANCH) {
    throw new Stop(
      `Текущая ветка ${current || 'detached HEAD'}. Ralph стартует только с ${BASE_BRANCH} или с ${branch}.`,
    );
  }
  if (codeChanges()) {
    throw new Stop(
      `В ${BASE_BRANCH} есть незакоммиченные изменения в apps/ или packages/. Закоммить или убери их.`,
    );
  }

  run('git', ['fetch', 'origin', BASE_BRANCH]);
  if (
    succeeds('git', [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ])
  ) {
    run('git', ['switch', branch]);
    console.log(`🔀 Переключился на ветку ${branch}.`);
  } else if (run('git', ['ls-remote', '--heads', 'origin', branch])) {
    run('git', ['switch', '-c', branch, '--track', `origin/${branch}`]);
    console.log(`🔀 Взял ветку ${branch} с origin.`);
  } else {
    run('git', ['switch', '--no-track', '-c', branch, `origin/${BASE_BRANCH}`]);
    console.log(`🔀 Создал ветку ${branch} от свежего origin/${BASE_BRANCH}.`);
  }
}

function openIssues(milestone) {
  const output = run('gh', [
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

function openPullRequest(milestone, branch) {
  const existing = JSON.parse(
    run('gh', [
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
  if (existing.length > 0) {
    console.log(`PR уже открыт: ${existing[0].url}`);
    return null;
  }

  const ahead = Number(
    run('git', ['rev-list', '--count', `${BASE_BRANCH}..HEAD`]),
  );
  if (ahead === 0) {
    console.log(
      `В ${branch} нет новых коммитов относительно ${BASE_BRANCH}, PR не создан.`,
    );
    return null;
  }

  run('git', ['push', '-u', 'origin', branch]);
  const url = run('gh', [
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
  console.log(`PR: ${url}`);
  return url;
}

function buildPrompt(config, issue) {
  const prompt = config.prompt
    .replaceAll('{milestone}', config.milestone)
    .replaceAll('{issue}', `#${issue.number}`)
    .replaceAll('{branch}', config.branch);
  return `${prompt}\n\nТекущая Issue #${issue.number}: ${issue.title}`;
}

function runClaude({ prompt, maxTurns, model, extraArgs = [] }) {
  const args = [
    '-p',
    prompt,
    '--max-turns',
    String(maxTurns),
    '--permission-mode',
    'auto',
    ...(model ? ['--model', model] : []),
    ...extraArgs,
  ];
  const result = spawnSync('claude', args, { cwd: root, stdio: 'inherit' });
  if (result.error)
    throw new Stop(`Не удалось запустить claude: ${result.error.message}`);
  if (result.signal)
    throw new Stop(`Агент остановлен сигналом ${result.signal}.`);
  if (result.status !== 0) {
    console.log(
      `⚠️ Агент завершился с кодом ${result.status} (возможно, исчерпан maxTurns).`,
    );
  }
  return result.status === 0;
}

function reviewPullRequest(config, url) {
  console.log(`🔍 Финальное ревью PR моделью ${config.reviewModel}…`);
  const ok = runClaude({
    prompt: `Прочитай .claude/ralph-review.md и проведи по этим правилам финальное ревью PR ${url} для milestone «${config.milestone}». Базовая ветка — ${BASE_BRANCH}.`,
    maxTurns: config.maxTurns,
    model: config.reviewModel,
    extraArgs: ['--disallowedTools', 'Edit', 'Write', 'NotebookEdit'],
  });
  console.log(
    ok
      ? `✅ Ревью оставлено в PR: ${url}`
      : `⚠️ Финальное ревью не завершилось, PR остался без него: ${url}`,
  );
}

function loop(config) {
  let previous = null;
  let attempts = 0;

  for (;;) {
    const { count } = readJson(counterPath, { count: 0 });
    if (count >= config.maxIterations) {
      throw new Stop(
        `⛔ Достигнут лимит итераций (${config.maxIterations}). Ralph останавливается.`,
        0,
      );
    }

    if (codeChanges()) {
      throw new Stop(
        'В apps/ или packages/ остались незакоммиченные изменения: прошлая итерация не довела работу до коммита. Разберись вручную.',
      );
    }

    const open = openIssues(config.milestone);
    const blocked = open.filter(isBlocked);
    const issues = open.filter((issue) => !isBlocked(issue));

    if (issues.length === 0) {
      if (blocked.length > 0) {
        throw new Stop(
          `Остались только Issues с меткой ${BLOCKED_LABEL}: ${blocked.map(({ number }) => `#${number}`).join(', ')}. Разбери их и сними метку, PR не создан.`,
        );
      }
      console.log(`✅ Milestone «${config.milestone}» завершён. Создаём PR.`);
      const url = openPullRequest(config.milestone, config.branch);
      if (url && config.reviewModel) reviewPullRequest(config, url);
      if (existsSync(progressPath)) {
        console.log(
          '📝 Выводы агента — в .claude/ralph.progress.md: перенеси ценное в CLAUDE.md и удали файл перед следующим milestone.',
        );
      }
      return;
    }

    const next = issues[0];
    attempts = previous === next.number ? attempts + 1 : 1;
    previous = next.number;
    if (attempts > MAX_ATTEMPTS) {
      throw new Stop(
        `Issue #${next.number} всё ещё открыта после ${MAX_ATTEMPTS} итераций. Разберись вручную.`,
      );
    }

    writeCounter(count + 1);
    console.log(
      `🔄 Итерация ${count + 1}/${config.maxIterations} — Issue #${next.number}: ${next.title} (попытка ${attempts} из ${MAX_ATTEMPTS})`,
    );
    runClaude({
      prompt: buildPrompt(config, next),
      maxTurns: config.maxTurns,
      model: config.model,
    });
  }
}

try {
  const config = loadConfig();
  assertMilestone(config.milestone);
  ensureBranch(config.branch);
  try {
    loop(config);
  } finally {
    writeCounter(0);
  }
} catch (error) {
  if (error instanceof Stop) {
    console.log(error.message);
    process.exitCode = error.code;
  } else {
    console.error(`Ralph упал: ${error.message}`);
    process.exitCode = 1;
  }
}
