// Command line parser of wkhtmltopdf 0.12.6, rule for rule
// (src/pdf/pdfcommandlineparser.cc parseArguments,
// src/shared/commandlineparserbase.cc parseArg).
import { byLong, byShort, type Action, type Mode, type OptionSpec } from './options.js';
import { cloneObject, defaultGlobal, defaultObject, type PdfGlobal, type PdfObject } from './settings.js';

export interface Parsed {
  g: PdfGlobal;
  objects: PdfObject[];
  // Options accepted with a limited effect, for the warnings.
  used: OptionSpec[];
}

// A usage error: wkhtmltopdf prints the message and its usage on stderr
// and exits with 1.
export class UsageError extends Error {}

// An option that prints something and exits, such as --version.
export class ActionRequest extends Error {
  constructor(readonly action: Action) {
    super(action);
  }
}

const SECTIONS: Record<Mode, number> = { global: 1, page: 2, toc: 4 };

function isOption(arg: string, defaultMode: boolean): boolean {
  return arg.startsWith('-') && arg.length > 1 && !defaultMode;
}

export function parseArguments(argv: string[], fromStdin = false): Parsed {
  const g = defaultGlobal();
  const objects: PdfObject[] = [];
  const used: OptionSpec[] = [];
  const state = { defaultMode: false };
  const argc = argv.length;
  // argv[0] is the program, as in C.
  let arg = 1;

  const parseArg = (sections: number, o: PdfObject): void => {
    const a = argv[arg]!;
    const run = (spec: OptionSpec, label: string) => {
      if (!(SECTIONS[spec.mode] & sections)) throw new UsageError(`${label} specified in incorrect location`);
      if (argc - arg < spec.args.length + 1) throw new UsageError(`Not enough arguments parsed to ${label}`);
      const values = argv.slice(arg + 1, arg + 1 + spec.args.length);
      if (spec.action) throw new ActionRequest(spec.action);
      if (!spec.apply!({ g, o }, values)) throw new UsageError(`Invalid argument(s) parsed to ${label}`);
      used.push(spec);
      return spec.args.length;
    };
    if (a[1] === '-') {
      // wkhtmltopdf tests for the character '0', not for the end of the
      // string: "--0..." switches to default mode, "--" is unknown.
      if (a[2] === '0') {
        state.defaultMode = true;
        return;
      }
      const spec = byLong.get(a.slice(2));
      if (!spec) throw new UsageError(`Unknown long argument ${a}`);
      arg += run(spec, a);
    } else {
      for (const ch of a.slice(1)) {
        const spec = byShort.get(ch);
        if (!spec) throw new UsageError(`Unknown switch -${ch}`);
        arg += run(spec, `-${ch}`);
      }
    }
  };

  // Global options, and page options that become every page's defaults.
  const def = defaultObject();
  for (; arg < argc; ++arg) {
    if (!isOption(argv[arg]!, state.defaultMode)) break;
    parseArg(SECTIONS.global | SECTIONS.page, def);
  }

  if (g.readArgsFromStdin && !fromStdin) return { g, objects, used };

  // Pages, each followed by its options; the last argument is the output.
  while (arg < argc - 1) {
    const ps = cloneObject(def);
    objects.push(ps);
    let sections = SECTIONS.page;
    if (argv[arg] === 'cover') {
      ++arg;
      if (arg >= argc - 1) throw new UsageError('You need to specify a input file to cover');
      ps.page = argv[arg++]!;
      ps.kind = 'cover';
      for (; arg < argc; ++arg) {
        if (!isOption(argv[arg]!, state.defaultMode)) break;
        parseArg(sections, ps);
      }
      // A cover has no header, footer or outline entry.
      ps.header.left = ps.header.right = ps.header.center = '';
      ps.footer.left = ps.footer.right = ps.footer.center = '';
      ps.header.line = ps.footer.line = false;
      ps.header.htmlUrl = ps.footer.htmlUrl = '';
      ps.includeInOutline = false;
      continue;
    } else if (argv[arg] === 'toc') {
      ++arg;
      sections = SECTIONS.page | SECTIONS.toc;
      ps.kind = 'toc';
    } else {
      if (argv[arg] === 'page') {
        ++arg;
        if (arg >= argc - 1) throw new UsageError('You need to specify a input file to page');
      }
      ps.page = argv[arg]!;
      ++arg;
    }
    for (; arg < argc; ++arg) {
      if (!isOption(argv[arg]!, state.defaultMode)) break;
      parseArg(sections, ps);
    }
  }

  if (objects.length === 0 || argc < 2) {
    throw new UsageError('You need to specify at least one input file, and exactly one output file\nUse - for stdin or stdout');
  }
  g.out = argv[argc - 1]!;
  return { g, objects, used };
}

// src/pdf/wkhtmltopdf.cc parseString: one line of --read-args-from-stdin,
// split like a shell would, with quotes and backslash escapes.
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let has = false;
  let state: 'skip' | 'tok' | 'q1' | 'q2' | 'tok_esc' | 'q1_esc' | 'q2_esc' = 'skip';
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    const space = c === ' ' || c === '\t' || c === '\r' || c === '\n';
    switch (state) {
      case 'skip':
        if (!space) {
          i--;
          state = 'tok';
        }
        break;
      case 'tok':
        if (c === "'") state = 'q1';
        else if (c === '"') state = 'q2';
        else if (c === '\\') state = 'tok_esc';
        else if (space) {
          state = 'skip';
          if (has) out.push(cur);
          cur = '';
          has = false;
        } else {
          cur += c;
          has = true;
        }
        break;
      case 'q1':
        if (c === "'") state = 'tok';
        else if (c === '\\') state = 'q1_esc';
        else {
          cur += c;
          has = true;
        }
        break;
      case 'q2':
        if (c === '"') state = 'tok';
        else if (c === '\\') state = 'q2_esc';
        else {
          cur += c;
          has = true;
        }
        break;
      default:
        cur += c;
        has = true;
        state = state === 'tok_esc' ? 'tok' : state === 'q1_esc' ? 'q1' : 'q2';
    }
  }
  if (has) out.push(cur);
  return out;
}
