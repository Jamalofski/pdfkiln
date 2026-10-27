// Lengths and paper sizes, parsed and converted as wkhtmltopdf 0.12.6 and
// its Qt 4.8 do (src/lib/pdfsettings.cc strToUnitReal, qprinter.cpp).
import type { Unit, UnitReal } from './settings.js';

// A number without sign or exponent, then a unit: "10", "1.5cm", "2in".
export function strToUnitReal(s: string): UnitReal | null {
  const m = /^([0-9]*\.?[0-9]*)(.*)$/s.exec(s)!;
  const [, num, suffix] = m as unknown as [string, string, string];
  const units: Record<string, [Unit, number]> = {
    '': ['mm', 1], mm: ['mm', 1], millimeter: ['mm', 1],
    cm: ['mm', 10], centimeter: ['mm', 10],
    m: ['mm', 1000], meter: ['mm', 1000],
    didot: ['didot', 1],
    inch: ['inch', 1], in: ['inch', 1],
    pica: ['pica', 1], pc: ['pica', 1],
    cicero: ['cicero', 1],
    pixel: ['px', 1], px: ['px', 1],
    point: ['pt', 1], pt: ['pt', 1],
  };
  const u = units[suffix.toLowerCase()];
  // QString::toDouble: "" and "." are not numbers.
  if (!u || !/[0-9]/.test(num)) return null;
  return { value: Number(num) * u[1], unit: u[0] };
}

// Qt's multipliers to points; a device pixel depends on the resolution.
export function toPoints(u: UnitReal, dpi = 96): number {
  const k: Record<Unit, number> = {
    mm: 72 / 25.4,
    pt: 1,
    inch: 72,
    pica: 12,
    didot: 1.065826771,
    cicero: 12.789921252,
    px: 72 / dpi,
  };
  return u.value * k[u.unit];
}

export const toMm = (u: UnitReal, dpi = 96): number => (toPoints(u, dpi) * 25.4) / 72;

// QPrinter paper sizes of Qt 4.8, in millimetres, portrait.
export const PAGE_SIZES: Record<string, [number, number]> = {
  A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297],
  A5: [148, 210], A6: [105, 148], A7: [74, 105], A8: [52, 74], A9: [37, 52],
  B0: [1000, 1414], B1: [707, 1000], B10: [31, 44], B2: [500, 707], B3: [353, 500],
  B4: [250, 353], B5: [176, 250], B6: [125, 176], B7: [88, 125], B8: [62, 88], B9: [33, 62],
  C5E: [163, 229], Comm10E: [105, 241], DLE: [110, 220], Executive: [190.5, 254],
  Folio: [210, 330], Ledger: [431.8, 279.4], Legal: [215.9, 355.6], Letter: [215.9, 279.4],
  Tabloid: [279.4, 431.8],
};

// Case-insensitive, as QString::compare(Qt::CaseInsensitive).
export function strToPageSize(s: string): string | null {
  return Object.keys(PAGE_SIZES).find((k) => k.toLowerCase() === s.toLowerCase()) ?? null;
}

// QString::toInt and toFloat: surrounding spaces are allowed.
export function strToInt(s: string): number | null {
  if (!/^\s*[+-]?[0-9]+\s*$/.test(s)) return null;
  const n = Number(s.trim());
  return n >= -2147483648 && n <= 2147483647 ? n : null;
}

export function strToFloat(s: string): number | null {
  if (!/^\s*[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?\s*$/.test(s)) return null;
  const n = Number(s.trim());
  return Number.isFinite(n) && Math.abs(n) <= 3.4028234663852886e38 ? n : null;
}
