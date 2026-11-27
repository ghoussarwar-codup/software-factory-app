const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const knownPath = '.github/factory-known-failures.json';
const flakyPath = '.github/factory-flaky-tests.json';

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

function checkListCanOnlyShrink(allowlist, allowlistPath, base) {
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
        `Quarantine entries may only be removed: ${entry.file} :: ${entry.name}`
      );
    }
  }
}

function run() {
  const allowlist = loadEntries(JSON.parse(fs.readFileSync(knownPath, 'utf8')));
  const flaky = loadEntries(JSON.parse(fs.readFileSync(flakyPath, 'utf8')));
  for (const [test, entry] of flaky) {
    if (!entry.id || !entry.owner || allowlist.has(test)) {
      throw new Error('Invalid or overlapping flaky test entry.');
    }
  }
  checkListCanOnlyShrink(allowlist, knownPath, process.env.FACTORY_BASE_SHA);
  checkListCanOnlyShrink(flaky, flakyPath, process.env.FACTORY_BASE_SHA);
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
    const records = fs
      .readFileSync(output, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const failures = records.filter(({ outcome }) => outcome === 'failed');
    const suiteFailed = result.status === 1;
    if (suiteFailed !== failures.length > 0 || records.length === 0)
      throw new Error('Test exit and result records disagree.');

    const failedKnownTests = new Set();
    const ranFlakyTests = new Set();
    let unexpected = 0;
    for (const record of records) {
      const test = key(record);
      if (
        !record.fileFailure &&
        flaky.has(test) &&
        record.outcome !== 'skipped'
      ) {
        ranFlakyTests.add(test);
        console.log(`Flaky test ${flaky.get(test).id}: ${record.outcome}`);
        continue;
      }
      if (record.outcome !== 'failed') continue;

      const known = !record.fileFailure && allowlist.get(test);
      if (known) failedKnownTests.add(test);
      else unexpected++;
      const reason = known?.reason || 'See the test result for details.';
      console.log(
        `${known ? 'Known failure' : 'Unexpected failure'}: ${record.file} :: ${record.name} — ${reason}`
      );
    }
    const stale = [...allowlist].filter(
      ([test]) => !failedKnownTests.has(test)
    );
    for (const [, entry] of stale) {
      console.error(
        `Remove passing or absent quarantine entry: ${entry.file} :: ${entry.name}`
      );
    }
    const missing = [...flaky].filter(([test]) => !ranFlakyTests.has(test));
    for (const [, entry] of missing) {
      console.error(
        `Flaky test missing or skipped: ${entry.id} ${entry.file} :: ${entry.name}`
      );
    }
    console.log(
      `${failedKnownTests.size} known failures, ${ranFlakyTests.size} flaky tests ran, ${unexpected} unexpected failures.`
    );
    if (unexpected || stale.length || missing.length) process.exitCode = 1;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run();
