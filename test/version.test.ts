import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { chromiumVersion, version } from '../src/version.js';
import { versionLine } from '../src/wk/help.js';

const root = resolve(import.meta.dirname, '..', '..');

test('versions follow package.json and chromium.json', () => {
  assert.equal(version, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version);
  assert.equal(chromiumVersion, JSON.parse(readFileSync(join(root, 'chromium.json'), 'utf8')).version);
});

test('--version reads as wkhtmltopdf 0.12.6 to the libraries', () => {
  const v = versionLine();
  // wicked_pdf (lib/wicked_pdf/binary.rb).
  assert.equal(/wkhtmltopdf\s*(\d*\.\d*\.\d*\w*)/.exec(v)?.[1], '0.12.6');
  // Odoo (ir_actions_report.py): the first run of digits and dots.
  assert.equal(/([0-9.]+)/.exec(v)?.[1], '0.12.6');
  // Frappe (frappe/utils/pdf.py): "qt" means headers and footers work.
  assert.ok(v.toLowerCase().includes('qt'));
  assert.equal(v.split(' ')[1], '0.12.6');
});
