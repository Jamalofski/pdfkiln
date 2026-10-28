// What wkhtmltopdf writes on stderr and how it exits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explain } from '../src/engine/browser.js';
import { Feedback } from '../src/wk/feedback.js';
import { handleError, qtErrorForHttpStatus } from '../src/wk/qtnet.js';

test('exit codes, measured on wkhtmltopdf 0.12.6', () => {
  // An HTTP 404 reaches wkhtmltopdf as Qt's ContentNotFoundError: exit 1.
  assert.deepEqual(handleError(true, 1000 + qtErrorForHttpStatus(404)), { code: 1, line: 'Exit with code 1 due to network error: ContentNotFoundError' });
  assert.deepEqual(handleError(true, 1000 + qtErrorForHttpStatus(401)), { code: 1, line: 'Exit with code 1 due to network error: AuthenticationRequiredError' });
  assert.deepEqual(handleError(true, 1000 + qtErrorForHttpStatus(500)), { code: 1, line: 'Exit with code 1 due to network error: UnknownContentError' });
  assert.deepEqual(handleError(false, 0), { code: 1, line: 'Exit with code 1, due to unknown error.' });
  assert.deepEqual(handleError(true, 0), { code: 0 });
  // What the code of wkhtmltopdf would do with a bare HTTP status.
  assert.deepEqual(handleError(true, 404), { code: 2, line: 'Exit with code 2 due to http error: 404 Page not found' });
});

test('Chromium that does not start: the reason, with the fix', () => {
  const closed = 'Protocol error (Target.setDiscoverTargets): Target closed';
  assert.equal(explain(closed, () => false), `Chromium did not start: ${closed}`);
  assert.match(explain(closed, () => true), /^Chromium does not run on Windows Server Core: .* Desktop Experience/);
  assert.match(explain('Running as root without --no-sandbox is not supported', () => false), /refuses to run as root/);
});

test('phases, padded over the progress bar', () => {
  let s = '';
  const fb = new Feedback('info', (x) => (s += x));
  fb.phaseChanged(0);
  fb.progressChanged(100, '100%');
  fb.phaseChanged(1);
  fb.phaseChanged(6);
  assert.equal(s.split('\r')[0], 'Loading pages (1/6)\n[' + '='.repeat(60) + '] 100%');
  assert.match(s, /\rCounting pages \(2\/6\) {47}\nDone\n$/);
});

test('log levels', () => {
  let s = '';
  const fb = new Feedback('warn', (x) => (s += x));
  fb.phaseChanged(0);
  fb.warning('w');
  fb.error('e');
  assert.equal(s, 'Warning: w\nError: e\n');
  s = '';
  const quiet = new Feedback('none', (x) => (s += x));
  quiet.error('e');
  assert.equal(s, '');
});
