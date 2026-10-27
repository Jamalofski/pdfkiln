// The image formats wkhtmltoimage's Qt wrote, from the PNG Chromium
// captures: BMP, PPM, XPM and XBM from its pixels, SVG around it.
import { inflateSync } from 'node:zlib';

export interface Raster {
  width: number;
  height: number;
  rgba: Buffer; // 4 bytes per pixel, rows from the top
}

// Chromium's PNG: 8 bits per channel, RGB or RGBA, not interlaced.
export function decodePng(png: Buffer): Raster {
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, color, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8 || (color !== 2 && color !== 6) || interlace !== 0) throw new Error('unsupported PNG');
      channels = color === 6 ? 4 : 3;
    } else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i]! + add) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      line.copy(rgba, o, x * channels, x * channels + 3);
      rgba[o + 3] = channels === 4 ? line[x * channels + 3]! : 255;
    }
    prev = line;
  }
  return { width, height, rgba };
}

// Over white: the formats below have no alpha.
const pixel = (r: Raster, i: number): [number, number, number] => {
  const a = r.rgba[i * 4 + 3]! / 255;
  const over = (v: number) => Math.round(v * a + 255 * (1 - a));
  return [over(r.rgba[i * 4]!), over(r.rgba[i * 4 + 1]!), over(r.rgba[i * 4 + 2]!)];
};

// 24 bits, rows from the bottom, padded to 4 bytes; 75 dpi, as Qt wrote.
export function toBmp(r: Raster): Buffer {
  const row = Math.ceil((r.width * 3) / 4) * 4;
  const size = row * r.height;
  const out = Buffer.alloc(54 + size);
  out.write('BM', 0, 'latin1');
  out.writeUInt32LE(54 + size, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(r.width, 18);
  out.writeInt32LE(r.height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(size, 34);
  out.writeInt32LE(2953, 38);
  out.writeInt32LE(2953, 42);
  for (let y = 0; y < r.height; y++) {
    const at = 54 + (r.height - 1 - y) * row;
    for (let x = 0; x < r.width; x++) {
      const [R, G, B] = pixel(r, y * r.width + x);
      out[at + x * 3] = B;
      out[at + x * 3 + 1] = G;
      out[at + x * 3 + 2] = R;
    }
  }
  return out;
}

export function toPpm(r: Raster): Buffer {
  const head = Buffer.from(`P6\n${r.width} ${r.height}\n255\n`, 'latin1');
  const body = Buffer.alloc(r.width * r.height * 3);
  for (let i = 0; i < r.width * r.height; i++) body.set(pixel(r, i), i * 3);
  return Buffer.concat([head, body]);
}

// The colours of the image, each named by as many printable characters as
// their number needs.
export function toXpm(r: Raster): Buffer {
  const chars = ' .XoO+@#$%&*=-;:>,<1234567890qwertyuipasdfghjklzxcvbnmMNBVCZASDFGHJKLPIUYTREWQ!~^/()_`\'][{}|';
  const ids = new Map<number, number>();
  const px = new Uint32Array(r.width * r.height);
  for (let i = 0; i < px.length; i++) {
    const [R, G, B] = pixel(r, i);
    const c = (R << 16) | (G << 8) | B;
    if (!ids.has(c)) ids.set(c, ids.size);
    px[i] = ids.get(c)!;
  }
  let cpp = 1;
  while (chars.length ** cpp < ids.size) cpp++;
  const name = (n: number) => {
    let s = '';
    for (let k = 0; k < cpp; k++, n = Math.floor(n / chars.length)) s += chars[n % chars.length];
    return s;
  };
  const lines = ['/* XPM */', 'static char *dummy[]={', `"${r.width} ${r.height} ${ids.size} ${cpp}",`];
  for (const [c, n] of ids) lines.push(`"${name(n)} c #${c.toString(16).padStart(6, '0')}",`);
  for (let y = 0; y < r.height; y++) {
    let s = '';
    for (let x = 0; x < r.width; x++) s += name(px[y * r.width + x]!);
    lines.push(`"${s}"${y < r.height - 1 ? ',' : '};'}`);
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'latin1');
}

// One bit per pixel, set where the pixel is dark; Qt dithered, this does
// not.
export function toXbm(r: Raster): Buffer {
  const bytes: string[] = [];
  const row = Math.ceil(r.width / 8);
  for (let y = 0; y < r.height; y++) {
    for (let b = 0; b < row; b++) {
      let v = 0;
      for (let k = 0; k < 8; k++) {
        const x = b * 8 + k;
        if (x >= r.width) break;
        const [R, G, B] = pixel(r, y * r.width + x);
        if (0.299 * R + 0.587 * G + 0.114 * B < 128) v |= 1 << k;
      }
      bytes.push(`0x${v.toString(16).padStart(2, '0')}`);
    }
  }
  const body: string[] = [];
  for (let i = 0; i < bytes.length; i += 15) body.push(` ${bytes.slice(i, i + 15).join(',')}`);
  return Buffer.from(`#define _width ${r.width}\n#define _height ${r.height}\nstatic char _bits[] = {\n${body.join(',\n')} };\n`, 'latin1');
}

// Qt drew the page as vectors; Chromium gives pixels, embedded here.
export function toSvg(png: Buffer, width: number, height: number): Buffer {
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.2" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<image width="${width}" height="${height}" xlink:href="data:image/png;base64,${png.toString('base64')}"/>
</svg>
`);
}
