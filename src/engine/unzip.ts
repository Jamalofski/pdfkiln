// Unpacks a zip archive (Chrome for Testing's) with zlib alone: the
// machines the npm package lands on have no unzip program for sure.
// Stored and deflated entries, Zip64, Unix modes and symbolic links; an
// entry that would land outside the destination is refused.
import { chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { crc32, inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX32 = 0xffffffff;

export function extractZip(archive: string, dest: string): void {
  const zip = readFileSync(archive);
  const bad = (what: string) => new Error(`${archive}: ${what}`);

  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i--) {
    if (zip.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw bad('not a zip file');
  let count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  if ((count === 0xffff || offset === MAX32) && eocd >= 20 && zip.readUInt32LE(eocd - 20) === ZIP64_LOCATOR) {
    const z = Number(zip.readBigUInt64LE(eocd - 12));
    if (zip.readUInt32LE(z) !== ZIP64_EOCD) throw bad('bad Zip64 record');
    count = Number(zip.readBigUInt64LE(z + 32));
    offset = Number(zip.readBigUInt64LE(z + 48));
  }

  mkdirSync(dest, { recursive: true });
  for (let n = 0, p = offset; n < count; n++) {
    if (zip.readUInt32LE(p) !== CENTRAL) throw bad('bad central directory');
    const madeBy = zip.readUInt16LE(p + 4);
    const method = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    let size = zip.readUInt32LE(p + 20);
    let length = zip.readUInt32LE(p + 24);
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    const attributes = zip.readUInt32LE(p + 38);
    let local = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLength);
    // Zip64: the 64-bit values of the fields set to 0xffffffff, in order.
    for (let e = p + 46 + nameLength; e < p + 46 + nameLength + extraLength; e += 4 + zip.readUInt16LE(e + 2)) {
      if (zip.readUInt16LE(e) !== 1) continue;
      let v = e + 4;
      const next = () => Number(zip.readBigUInt64LE((v += 8) - 8));
      if (length === MAX32) length = next();
      if (size === MAX32) size = next();
      if (local === MAX32) local = next();
    }
    p += 46 + nameLength + extraLength + commentLength;

    const relative = normalize(name);
    if (isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw bad(`entry outside the archive: ${name}`);
    const target = join(dest, relative);
    const mode = madeBy >> 8 === 3 ? attributes >>> 16 : 0;
    const type = mode & 0o170000;
    if (name.endsWith('/') || type === 0o040000) {
      mkdirSync(target, { recursive: true });
      continue;
    }
    if (zip.readUInt32LE(local) !== LOCAL) throw bad(`bad local header: ${name}`);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const raw = zip.subarray(start, start + size);
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (!data) throw bad(`compression method ${method}: ${name}`);
    if (data.length !== length || crc32(data) !== crc) throw bad(`corrupt entry: ${name}`);
    mkdirSync(dirname(target), { recursive: true });
    if (type === 0o120000) {
      symlinkSync(data.toString('utf8'), target);
      continue;
    }
    writeFileSync(target, data);
    if (mode & 0o777 && sep === '/') chmodSync(target, mode & 0o777);
  }
}
