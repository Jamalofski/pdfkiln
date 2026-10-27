// Prototype command used by the bench:
//   node dist/src/proto-cli.js <input> <output.pdf> [options]
// It is not the v1 command line.
import { parseArgs } from 'node:util';
import { renderFile, type RenderOptions } from './render.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scale: { type: 'string' },
    'margin-top': { type: 'string' },
    'margin-right': { type: 'string' },
    'margin-bottom': { type: 'string' },
    'margin-left': { type: 'string' },
    'javascript-delay': { type: 'string' },
    'print-media-type': { type: 'boolean' },
    'no-background': { type: 'boolean' },
    outline: { type: 'boolean' },
    tagged: { type: 'boolean' },
    timings: { type: 'boolean' },
  },
});

const [input, output] = positionals;
if (!input || !output) {
  console.error('usage: proto-cli <input> <output.pdf> [--scale n] [--margin-top mm] [--outline] [--timings]');
  process.exit(1);
}

const num = (v: string | undefined) => (v === undefined ? undefined : Number(v));
const margin: RenderOptions['margin'] = {};
for (const side of ['top', 'right', 'bottom', 'left'] as const) {
  const v = num(values[`margin-${side}`]);
  if (v !== undefined) margin[side] = v;
}

const opts: RenderOptions = { margin };
if (values.scale) opts.scale = Number(values.scale);
if (values['javascript-delay']) opts.javascriptDelay = Number(values['javascript-delay']);
if (values['print-media-type']) opts.printMediaType = true;
if (values['no-background']) opts.background = false;
if (values.outline) opts.outline = true;
if (values.tagged) opts.tagged = true;

const timings = await renderFile(input, output, opts);
if (values.timings) console.log(JSON.stringify(timings));
