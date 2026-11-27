#!/usr/bin/env bash
set -euo pipefail

# Bundle unchanged upstream source with esbuild, and run the original test
# callbacks through node:test. None of these probes call load-ts.cjs.
for suite in breaker transcript-usage; do
  if [[ "$suite" == breaker ]]; then
    entry=breaker
  else
    entry=transcript
  fi
  node_modules/.bin/esbuild "src/main/$entry.ts" --bundle --platform=node --format=cjs --outfile="test/.factory-$entry.cjs"
  node - "$suite" "$entry" <<'NODE'
const fs = require('node:fs');
const [suite, entry] = process.argv.slice(2);
const fsPath = `test/${suite}.test.cjs`;
const source = fs.readFileSync(fsPath, 'utf8');
const actual = fs.readFileSync(`../candidate/${fsPath}`, 'utf8');
const originalTests = source.slice(source.indexOf("\ntest('")).replace(/\nprocess.exit\(failures \? 1 : 0\);\s*$/, '').trim();
const candidateTests = actual.slice(actual.indexOf("\ntest('")).trim();
if (originalTests !== candidateTests) throw new Error(`The assertions differ from the pinned baseline: ${fsPath}`);
const load = "require('./load-ts.cjs')('src/main/" + entry + ".ts')";
if (!actual.includes(load)) throw new Error(`Expected loader call missing: ${fsPath}`);
fs.writeFileSync(fsPath, actual.replace(load, "require('./.factory-" + entry + ".cjs')"));
NODE
done

exit_code=0
node --test --test-reporter ../candidate/tools/factory-baseline-reporter.cjs test/breaker.test.cjs test/transcript-usage.test.cjs > "$RUNNER_TEMP/factory-native-proof.jsonl" || exit_code=$?
test "$exit_code" -le 1
test -s "$RUNNER_TEMP/factory-native-proof.jsonl"
