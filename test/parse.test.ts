// The command line rules of wkhtmltopdf 0.12.6.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ActionRequest, parseArguments, splitArgs, UsageError } from '../src/wk/parse.js';

const parse = (...a: string[]) => parseArguments(['wkhtmltopdf', ...a]);

test('defaults', () => {
  const p = parse('in.html', 'out.pdf');
  assert.equal(p.objects.length, 1);
  assert.equal(p.objects[0]!.page, 'in.html');
  assert.equal(p.g.out, 'out.pdf');
  assert.equal(p.g.pageSize, 'A4');
  assert.deepEqual(p.g.margin.top, { value: -1, unit: 'mm' });
  assert.equal(p.objects[0]!.load.jsdelay, 200);
  assert.equal(p.objects[0]!.load.blockLocalFileAccess, true);
  assert.equal(p.g.outline, true);
});

test('page options before the first page apply to every page', () => {
  const p = parse('--zoom', '2', 'a.html', 'b.html', '--zoom', '3', 'out.pdf');
  assert.deepEqual(p.objects.map((o) => o.load.zoomFactor), [2, 3]);
});

test('global options after a page are refused', () => {
  assert.throws(() => parse('a.html', '--page-size', 'A5', 'out.pdf'), (e: Error) => e instanceof UsageError && e.message === '--page-size specified in incorrect location');
});

test('unknown options, as wkhtmltopdf words them', () => {
  assert.throws(() => parse('--bogus', 'a', 'b'), /Unknown long argument --bogus$/);
  assert.throws(() => parse('-x', 'a', 'b'), /Unknown switch -x/);
  // No --name=value form.
  assert.throws(() => parse('--margin-top=10', 'a', 'b'), /Unknown long argument --margin-top=10/);
  assert.throws(() => parse('--', 'a', 'b'), /Unknown long argument --$/);
});

test('invalid and missing values', () => {
  assert.throws(() => parse('--margin-top', '-5mm', 'a', 'b'), /Invalid argument\(s\) parsed to --margin-top/);
  assert.throws(() => parse('--page-size', 'A11', 'a', 'b'), /Invalid argument/);
  assert.throws(() => parse('a.html', '--zoom'), /Not enough arguments parsed to --zoom/);
  assert.throws(() => parse(), /You need to specify at least one input file/);
  assert.throws(() => parse('out.pdf'), /You need to specify at least one input file/);
});

test('short switches, combined', () => {
  const p = parse('-qgO', 'Landscape', '-s', 'letter', '-T', '1in', '-B', '2cm', 'a.html', 'out.pdf');
  assert.equal(p.g.logLevel, 'none');
  assert.equal(p.g.grayscale, true);
  assert.equal(p.g.orientation, 'Landscape');
  assert.equal(p.g.pageSize, 'Letter');
  assert.deepEqual(p.g.margin.top, { value: 1, unit: 'inch' });
  assert.deepEqual(p.g.margin.bottom, { value: 20, unit: 'mm' });
});

test('cover drops headers, footers and the outline entry', () => {
  const p = parse('--header-center', 'H', 'cover', 'c.html', '--footer-left', 'F', 'a.html', 'out.pdf');
  assert.equal(p.objects[0]!.kind, 'cover');
  assert.equal(p.objects[0]!.header.center, '');
  assert.equal(p.objects[0]!.footer.left, '');
  assert.equal(p.objects[0]!.includeInOutline, false);
  assert.equal(p.objects[1]!.header.center, 'H');
  assert.throws(() => parse('cover', 'out.pdf'), /You need to specify a input file to cover/);
});

test('toc options only after toc', () => {
  assert.throws(() => parse('a.html', '--toc-header-text', 'x', 'out.pdf'), /incorrect location/);
  const p = parse('toc', '--toc-header-text', 'Contents', 'a.html', 'out.pdf');
  assert.equal(p.objects[0]!.kind, 'toc');
  assert.equal(p.objects[0]!.toc.captionText, 'Contents');
});

test('actions', () => {
  assert.throws(() => parse('--version'), (e) => e instanceof ActionRequest && e.action === 'version');
  assert.throws(() => parse('-H'), (e) => e instanceof ActionRequest && e.action === 'extended-help');
});

test('--default-header', () => {
  const p = parse('--default-header', 'a.html', 'out.pdf');
  assert.equal(p.objects[0]!.header.left, '[webpage]');
  assert.equal(p.objects[0]!.header.right, '[page]/[topage]');
  assert.equal(p.objects[0]!.header.line, true);
  assert.deepEqual(p.g.margin.top, { value: 20, unit: 'mm' });
});

test('repeatable options and pairs', () => {
  const p = parse('--custom-header', 'X-A', '1', '--custom-header', 'X-B', '2', '--cookie', 'c', 'v', '--allow', '/tmp', '--run-script', 'a()', 'in.html', 'out.pdf');
  assert.deepEqual(p.objects[0]!.load.customHeaders, [['X-A', '1'], ['X-B', '2']]);
  assert.deepEqual(p.objects[0]!.load.cookies, [['c', 'v']]);
  assert.deepEqual(p.objects[0]!.load.allowed, ['/tmp']);
  assert.deepEqual(p.objects[0]!.load.runScript, ['a()']);
});

test('read-args-from-stdin stops after the global options', () => {
  const p = parse('--read-args-from-stdin');
  assert.equal(p.g.readArgsFromStdin, true);
  assert.equal(p.objects.length, 0);
});

test('splitArgs, as wkhtmltopdf splits a line of the standard input', () => {
  assert.deepEqual(splitArgs(`a.html "b c.pdf"  'd\\'e' f\\ g ''\n`), ['a.html', 'b c.pdf', "d'e", 'f g']);
});
