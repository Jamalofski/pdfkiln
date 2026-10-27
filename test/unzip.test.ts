import assert from 'node:assert/strict';
import { lstatSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { crc32, deflateRawSync } from 'node:zlib';
import { extractZip } from '../src/engine/unzip.js';

const dir = mkdtempSync(join(tmpdir(), 'pdfkiln-unzip-'));
after(() => rmSync(dir, { recursive: true, force: true }));

interface Entry { name: string; data?: string; mode?: number; deflate?: boolean }

// A zip file "made on Unix" (version made by 3.x), as Chrome for Testing's.
function zip(entries: Entry[]): string {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const data = Buffer.from(e.data ?? '');
    const body = e.deflate ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(e.deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((e.mode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  const file = join(dir, `${entries.length}-${Math.random()}.zip`);
  writeFileSync(file, Buffer.concat([...locals, cd, end]));
  return file;
}

test('files, modes, deflate, directories and links', () => {
  const out = join(dir, 'out');
  extractZip(zip([
    { name: 'app/', mode: 0o040755 },
    { name: 'app/run', data: '#!/bin/sh\n', mode: 0o100755 },
    { name: 'app/data.txt', data: 'x'.repeat(10000), deflate: true },
    // Links need privileges on Windows.
    ...(process.platform === 'win32' ? [] : [{ name: 'app/link', data: 'run', mode: 0o120777 }]),
  ]), out);
  assert.equal(readFileSync(join(out, 'app', 'data.txt'), 'utf8'), 'x'.repeat(10000));
  if (process.platform !== 'win32') {
    assert.equal(lstatSync(join(out, 'app', 'run')).mode & 0o777, 0o755);
    assert.equal(readlinkSync(join(out, 'app', 'link')), 'run');
  }
});

test('an entry outside the destination is refused', () => {
  assert.throws(() => extractZip(zip([{ name: '../evil', data: 'x' }]), join(dir, 'out2')), /outside the archive/);
  assert.throws(() => extractZip(zip([{ name: '/etc/evil', data: 'x' }]), join(dir, 'out3')), /outside the archive/);
});

test('a corrupt entry is refused', () => {
  const file = zip([{ name: 'a.txt', data: 'hello' }]);
  const bytes = readFileSync(file);
  bytes[30 + 'a.txt'.length]! ^= 1;
  writeFileSync(file, bytes);
  assert.throws(() => extractZip(file, join(dir, 'out4')), /corrupt entry/);
});
