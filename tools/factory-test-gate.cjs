const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const allowlistPath = '.github/factory-known-failures.json';

function key({ file, name }) {
  return JSON.stringify([file, name]);
}

function loadEntries(entries) {
  const byTest = new Map();
  for (const entry of entries) {
    if (
      !entry.file ||
      !entry.name ||
      !entry.reason ||
      !entry.baseline ||
      byTest.has(key(entry))
    ) {
      throw new Error('Invalid or duplicate known-failure entry.');
    }
    byTest.set(key(entry), entry);
  }
  return byTest;
}

function checkListCanOnlyShrink(allowlist, base) {
  if (!base) return;
  const fileExists = execFileSync(
    'git',
    ['ls-tree', base, '--', allowlistPath],
    { encoding: 'utf8' }
  ).trim();
  // The bootstrap PR establishes the list. Later PRs may only delete entries.
  if (!fileExists) return;
  const previous = loadEntries(
    JSON.parse(
      execFileSync('git', ['show', `${base}:${allowlistPath}`], {
        encoding: 'utf8'
      })
    )
  );
  for (const [test, entry] of allowlist) {
    if (JSON.stringify(previous.get(test)) !== JSON.stringify(entry)) {
      throw new Error(
        `Known-failure entries may only be removed: ${entry.file} :: ${entry.name}`
      );
    }
  }
}

function run() {
  const allowlist = loadEntries(
    JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
  );
  checkListCanOnlyShrink(allowlist, process.env.FACTORY_BASE_SHA);
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'factory-test-gate-')
  );
  try {
    const output = path.join(directory, 'failures.jsonl');
    const result = spawnSync(
      process.execPath,
      [
        '--test',
        '--test-reporter',
        pathToFileURL(path.join(__dirname, 'factory-baseline-reporter.cjs'))
          .href,
        '--test-reporter-destination',
        output,
        'test/*.test.cjs'
      ],
      { stdio: 'inherit' }
    );
    if (result.error) throw result.error;
    if (result.signal || ![0, 1].includes(result.status))
      throw new Error('Node did not finish the test run normally.');
    const failures = fs
      .readFileSync(output, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    if ((result.status === 1) !== failures.length > 0)
      throw new Error('Test exit and failure records disagree.');
    let unexpected = 0;
    const failedKnownTests = new Set();
    for (const failure of failures) {
      const known = !failure.fileFailure && allowlist.get(key(failure));
      if (known) failedKnownTests.add(key(failure));
      else unexpected++;
      console.log(
        `${known ? 'Known failure' : 'Unexpected failure'}: ${failure.file} :: ${failure.name} — ${failure.reason}`
      );
    }
    console.log(
      `${failures.length - unexpected} known failures, ${unexpected} unexpected failures.`
    );
    const stale = [...allowlist].filter(
      ([test]) => !failedKnownTests.has(test)
    );
    for (const [, entry] of stale) {
      console.error(
        `Remove passing or absent quarantine entry: ${entry.file} :: ${entry.name}`
      );
    }
    if (unexpected || stale.length) process.exitCode = 1;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run();
