// Print stable identifiers for individual Node test failures. File-load failures
// are reported separately so they cannot be treated as individual test cases.
const path = require('node:path');

module.exports = async function* report(source) {
  for await (const event of source) {
    if (event.type !== 'test:fail') continue;

    const { name, file, details } = event.data;
    const error = details.error;
    if (error.failureType === 'subtestsFailed') continue;

    const relativeFile = file ? path.relative(process.cwd(), file).split(path.sep).join('/') : null;
    const fileFailure = !relativeFile || path.basename(name) === path.basename(relativeFile);
    const reason = (error.cause?.message || error.message).split(/\r?\n/).find(line => line.trim());
    yield JSON.stringify({ file: relativeFile, name, reason, fileFailure }) + '\n';
  }
};
