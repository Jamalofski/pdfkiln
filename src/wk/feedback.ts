// What wkhtmltopdf 0.12.6 writes on stderr while converting, byte for byte
// where libraries read it (src/shared/progressfeedback.cc): pdfkit, for
// one, accepts a failed run whose second to last line is "Done".
import type { LogLevel } from './settings.js';

const LEVEL: Record<LogLevel, number> = { none: 0, error: 1, warn: 2, info: 3 };

// With a patched Qt and no table of contents, phase 3 is skipped.
export const PHASES = [
  'Loading pages',
  'Counting pages',
  'Loading TOC',
  'Resolving links',
  'Loading headers and footers',
  'Printing pages',
  'Done',
] as const;

// src/lib/imageconverter.cc.
export const IMAGE_PHASES = ['Loading page', 'Rendering', 'Done'] as const;

export class Feedback {
  private lw = 0; // width of the progress bar on the current line
  private phase = -1;
  private progressText = '';

  constructor(
    private readonly level: LogLevel,
    private readonly write: (s: string) => void = (s) => process.stderr.write(s),
    private readonly phases: readonly string[] = PHASES,
  ) {}

  private pad(l: number): string {
    const s = l < this.lw ? ' '.repeat(this.lw - l) : '';
    this.lw = 0;
    return s;
  }

  warning(message: string): void {
    if (LEVEL[this.level] < LEVEL.warn) return;
    this.write(`Warning: ${message}${this.pad(9 + message.length)}\n`);
  }

  error(message: string): void {
    if (LEVEL[this.level] < LEVEL.error) return;
    this.write(`Error: ${message}${this.pad(7 + message.length)}\n`);
  }

  phaseChanged(phase: number): void {
    this.phase = phase;
    if (LEVEL[this.level] < LEVEL.info) return;
    let s = this.phases[phase]!;
    if (phase < this.phases.length - 1) s += ` (${phase + 1}/${this.phases.length - 1})`;
    this.write(`${s}${this.pad(s.length)}\n`);
  }

  get currentPhase(): number {
    return this.phase;
  }

  progressChanged(progress: number, text = this.progressText): void {
    this.progressText = text;
    if (LEVEL[this.level] < LEVEL.info) return;
    const w = 60;
    const p = Math.trunc((progress * w) / 100);
    let bar = '';
    for (let i = 0; i < w; i++) bar += i < p ? '=' : i === p ? '>' : ' ';
    const l = 1 + w + 2 + text.length;
    const s = `[${bar}] ${text}`;
    const tail = l < this.lw ? ' '.repeat(this.lw - l) : '';
    this.lw = l;
    this.write(`${s}${tail}\r`);
  }
}
