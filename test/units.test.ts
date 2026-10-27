import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strToFloat, strToInt, strToPageSize, strToUnitReal, toMm } from '../src/wk/units.js';
import { strToProxy } from '../src/wk/options.js';

test('lengths as wkhtmltopdf reads them', () => {
  assert.deepEqual(strToUnitReal('10'), { value: 10, unit: 'mm' });
  assert.deepEqual(strToUnitReal('1.5cm'), { value: 15, unit: 'mm' });
  assert.deepEqual(strToUnitReal('2IN'), { value: 2, unit: 'inch' });
  assert.deepEqual(strToUnitReal('.5'), { value: 0.5, unit: 'mm' });
  assert.equal(strToUnitReal('-1mm'), null);
  assert.equal(strToUnitReal('mm'), null);
  assert.equal(strToUnitReal('10 mm'), null);
  assert.equal(toMm({ value: 96, unit: 'px' }), 25.4);
  assert.ok(Math.abs(toMm({ value: 72, unit: 'pt' }) - 25.4) < 1e-9);
});

test('numbers as QString reads them', () => {
  assert.equal(strToInt(' 12 '), 12);
  assert.equal(strToInt('12a'), null);
  assert.equal(strToFloat('1.0666666666666667'), 1.0666666666666667);
  assert.equal(strToFloat('1e2'), 100);
  assert.equal(strToFloat('x'), null);
});

test('page sizes, any case', () => {
  assert.equal(strToPageSize('a4'), 'A4');
  assert.equal(strToPageSize('comm10e'), 'Comm10E');
  assert.equal(strToPageSize('A11'), null);
});

test('proxies', () => {
  assert.equal(strToProxy('none'), null);
  assert.deepEqual(strToProxy('socks5://u:p@h:1'), { type: 'socks5', host: 'h', port: 1, user: 'u', password: 'p' });
  assert.deepEqual(strToProxy('h'), { type: 'http', host: 'h', port: 1080, user: '', password: '' });
  assert.equal(strToProxy('h:99999'), undefined);
});
