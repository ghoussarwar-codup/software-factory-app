// File-load failures stay distinct from named test results.
const path = require('node:path');

module.exports = async function* report(source) {
  for await (const event of source) {
    if (!['test:pass', 'test:fail'].includes(event.type)) continue;
    const { name, file, details, skip, todo } = event.data;
    const error = details.error;
    if (error?.failureType === 'subtestsFailed') continue;
    const relativeFile = file
      ? path.relative(process.cwd(), file).split(path.sep).join('/')
      : null;
    const fileFailure =
      !relativeFile ||
      path.basename(name.replaceAll('\\', '/')) === path.basename(relativeFile);
    const outcome = skip || todo ? 'skipped' : error ? 'failed' : 'passed';
    const reason =
      error &&
      (error.cause?.message || error.message)
        .split(/\r?\n/)
        .find((line) => line.trim());
    yield JSON.stringify({
      file: relativeFile,
      name,
      outcome,
      reason,
      fileFailure
    }) + '\n';
  }
};
