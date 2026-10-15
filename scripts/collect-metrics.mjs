// Сбор метрик проекта: качество кода, тесты, размер, активность в git и CI.
// Запуск: npm run metrics (после test:cov / test:e2e в backend и frontend).
// Результат: metrics/metrics.json и metrics/metrics.md.
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const PROJECTS = {
  backend: { lint: '"{src,test}/**/*.ts"', sources: ['src', 'test'] },
  frontend: { lint: 'src', sources: ['src'] },
};
const SOURCE_EXT = new Set(['.ts', '.tsx', '.css']);
const OUT_DIR = join(ROOT, 'metrics');

function sh(command, cwd = ROOT) {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function shAllowFail(command, cwd) {
  try {
    return sh(command, cwd);
  } catch (error) {
    return error.stdout ?? '';
  }
}

const round = (value, digits = 2) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const average = (values) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

// 1. Статический анализ: ошибки и предупреждения ESLint.
function lintMetrics(dir, pattern) {
  const results = JSON.parse(
    shAllowFail(`npx eslint ${pattern} -f json`, dir) || '[]',
  );
  return {
    errors: results.reduce((sum, r) => sum + r.errorCount, 0),
    warnings: results.reduce((sum, r) => sum + r.warningCount, 0),
  };
}

// 2. Цикломатическая сложность функций (правило complexity с порогом 0 выдаёт значение для каждой функции).
function complexityMetrics(dir, pattern) {
  const output = shAllowFail(
    `npx eslint ${pattern} -f json --rule "complexity: [warn, 0]"`,
    dir,
  );
  const values = JSON.parse(output || '[]')
    .flatMap((r) => r.messages)
    .filter((m) => m.ruleId === 'complexity')
    .map((m) => Number(/complexity of (\d+)/.exec(m.message)?.[1]))
    .filter(Number.isFinite);
  return {
    functions: values.length,
    average: round(average(values)),
    max: values.length ? Math.max(...values) : 0,
  };
}

// 3. Покрытие кода тестами (coverage-summary.json от Jest / Vitest).
function coverageMetrics(dir) {
  const file = join(dir, 'coverage', 'coverage-summary.json');
  if (!existsSync(file)) return null;
  const { total } = JSON.parse(readFileSync(file, 'utf8'));
  return {
    lines: total.lines.pct,
    branches: total.branches.pct,
    functions: total.functions.pct,
  };
}

// 4. Результаты тестов (JUnit XML).
function testMetrics(dir) {
  const reportsDir = join(dir, 'reports');
  const totals = { tests: 0, failures: 0, durationSec: 0 };
  if (!existsSync(reportsDir)) return null;
  for (const file of readdirSync(reportsDir).filter((f) =>
    f.endsWith('.xml'),
  )) {
    const head =
      /<testsuites\b[^>]*>/.exec(
        readFileSync(join(reportsDir, file), 'utf8'),
      )?.[0] ?? '';
    const attr = (name) =>
      Number(new RegExp(`${name}="([\\d.]+)"`).exec(head)?.[1] ?? 0);
    totals.tests += attr('tests');
    totals.failures += attr('failures') + attr('errors');
    totals.durationSec += attr('time');
  }
  return {
    ...totals,
    passed: totals.tests - totals.failures,
    durationSec: round(totals.durationSec),
  };
}

// 5. Размер проекта: файлы и строки исходного кода.
function sizeMetrics(dir, sources) {
  let files = 0;
  let lines = 0;
  const walk = (path) => {
    if (!existsSync(path)) return;
    if (statSync(path).isDirectory())
      return readdirSync(path).forEach((name) => walk(join(path, name)));
    if (!SOURCE_EXT.has(extname(path))) return;
    files += 1;
    lines += readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim()).length;
  };
  sources.forEach((source) => walk(join(dir, source)));
  return { files, lines };
}

// 6. Активность в репозитории: частота и размер коммитов, доля Conventional Commits.
function gitMetrics() {
  const subjects = sh('git log --no-merges --format=%s')
    .split('\n')
    .filter(Boolean);
  const conventional = subjects.filter((s) =>
    /^(\w+)(\([\w-]+\))?!?: .+/.test(s),
  ).length;
  const changed = sh(
    `git log --no-merges --shortstat --format= -- . ":(exclude)**/package-lock.json"`,
  )
    .split('\n')
    .filter(Boolean)
    .map((line) =>
      [...line.matchAll(/(\d+) (insertion|deletion)/g)].reduce(
        (sum, m) => sum + Number(m[1]),
        0,
      ),
    );
  return {
    commits: subjects.length,
    commitsLast7Days: Number(
      sh('git rev-list --no-merges --count --since="7 days ago" HEAD').trim(),
    ),
    avgChangedLinesPerCommit: round(average(changed), 1),
    conventionalCommitsPct: subjects.length
      ? round((conventional / subjects.length) * 100, 1)
      : 0,
  };
}

// 7–8. Pull Request'ы и стабильность пайплайна CI (GitHub API).
function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  return /github\.com[:/](.+?)(\.git)?$/.exec(
    sh('git remote get-url origin').trim(),
  )?.[1];
}

function githubApi(path) {
  try {
    return JSON.parse(sh(`gh api "${path}"`));
  } catch {
    return null;
  }
}

function githubMetrics() {
  const slug = repoSlug();
  const pulls = githubApi(`repos/${slug}/pulls?state=all&per_page=100`);
  const runs = githubApi(
    `repos/${slug}/actions/workflows/ci.yml/runs?status=completed&per_page=50`,
  );
  const hours = (from, to) => (new Date(to) - new Date(from)) / 36e5;
  const merged = (pulls ?? []).filter((p) => p.merged_at);
  const finished = (runs?.workflow_runs ?? []).filter(
    (r) => r.conclusion !== 'cancelled' && r.conclusion !== 'skipped',
  );
  return {
    pullRequests: pulls && {
      total: pulls.length,
      merged: merged.length,
      open: pulls.filter((p) => p.state === 'open').length,
      avgHoursToMerge: round(
        average(merged.map((p) => hours(p.created_at, p.merged_at))),
        1,
      ),
    },
    pipeline: finished.length
      ? {
          runs: finished.length,
          successRatePct: round(
            (finished.filter((r) => r.conclusion === 'success').length /
              finished.length) *
              100,
            1,
          ),
          avgDurationMin: round(
            average(
              finished.map((r) => hours(r.run_started_at, r.updated_at) * 60),
            ),
            1,
          ),
        }
      : null,
  };
}

function collect() {
  const projects = {};
  for (const [name, config] of Object.entries(PROJECTS)) {
    const dir = join(ROOT, name);
    projects[name] = {
      lint: lintMetrics(dir, config.lint),
      complexity: complexityMetrics(dir, config.lint),
      coverage: coverageMetrics(dir),
      tests: testMetrics(dir),
      size: sizeMetrics(dir, config.sources),
    };
  }
  return {
    collectedAt: new Date().toISOString(),
    ref:
      process.env.GITHUB_REF_NAME ??
      sh('git rev-parse --abbrev-ref HEAD').trim(),
    commit: sh('git rev-parse --short HEAD').trim(),
    projects,
    git: gitMetrics(),
    ...githubMetrics(),
  };
}

function toMarkdown(m) {
  const value = (v, suffix = '') =>
    v === null || v === undefined ? '—' : `${v}${suffix}`;
  const row = (label, pick) =>
    `| ${label} | ${Object.values(m.projects).map(pick).join(' | ')} |`;
  return [
    `## Метрики проекта (${m.ref}, ${m.commit})`,
    '',
    `Дата сбора: ${m.collectedAt}`,
    '',
    `| Метрика | ${Object.keys(m.projects).join(' | ')} |`,
    `|---|${Object.keys(m.projects)
      .map(() => '---')
      .join('|')}|`,
    row(
      'Ошибки / предупреждения ESLint',
      (p) => `${p.lint.errors} / ${p.lint.warnings}`,
    ),
    row(
      'Цикломатическая сложность (средн. / макс.)',
      (p) => `${p.complexity.average} / ${p.complexity.max}`,
    ),
    row('Покрытие строк', (p) => value(p.coverage?.lines, '%')),
    row('Покрытие ветвлений', (p) => value(p.coverage?.branches, '%')),
    row('Тесты (пройдено / всего)', (p) =>
      p.tests ? `${p.tests.passed} / ${p.tests.tests}` : '—',
    ),
    row('Время выполнения тестов', (p) => value(p.tests?.durationSec, ' с')),
    row(
      'Размер (файлов / строк кода)',
      (p) => `${p.size.files} / ${p.size.lines}`,
    ),
    '',
    '| Метрика | Значение |',
    '|---|---|',
    `| Коммитов всего / за 7 дней | ${m.git.commits} / ${m.git.commitsLast7Days} |`,
    `| Средний размер коммита (строк) | ${m.git.avgChangedLinesPerCommit} |`,
    `| Коммитов по Conventional Commits | ${m.git.conventionalCommitsPct}% |`,
    `| Pull Request'ов (всего / слито / открыто) | ${m.pullRequests ? `${m.pullRequests.total} / ${m.pullRequests.merged} / ${m.pullRequests.open}` : '—'} |`,
    `| Среднее время до слияния PR | ${value(m.pullRequests?.avgHoursToMerge, ' ч')} |`,
    `| Успешных запусков CI | ${value(m.pipeline?.successRatePct, '%')} |`,
    `| Средняя длительность CI | ${value(m.pipeline?.avgDurationMin, ' мин')} |`,
    '',
  ].join('\n');
}

const metrics = collect();
const markdown = toMarkdown(metrics);
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, 'metrics.json'),
  `${JSON.stringify(metrics, null, 2)}\n`,
);
writeFileSync(join(OUT_DIR, 'metrics.md'), markdown);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
