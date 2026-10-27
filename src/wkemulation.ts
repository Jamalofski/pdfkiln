// Emulation of wkhtmltopdf 0.12.6 layout quirks measured by the bench, for
// the compatibility mode. Each one is optional so that its weight can be
// measured on the corpus.
import type { CDPSession } from 'puppeteer-core';

const TRUE = '(min-width: 0px)';
const FALSE = '(min-width: 1000000px)';

// wkhtmltopdf without --viewport-size lays the page out in a 0 x 0 viewport:
// width and height media features are evaluated against 0. Rewrites them to
// a feature that is always true or always false in Chromium.
export function rewriteMediaPrelude(prelude: string, width: number, height: number): string {
  return prelude.replace(
    /\(\s*(min-|max-)?(width|height)\s*:\s*(-?[0-9.]+)\s*(px|em|rem)?\s*\)/gi,
    (_m, prefix: string | undefined, feature: string, value: string, unit: string | undefined) => {
      const v = Number(value) * (unit && unit.toLowerCase() !== 'px' ? 16 : 1);
      const actual = feature.toLowerCase() === 'width' ? width : height;
      const p = (prefix ?? '').toLowerCase();
      const ok = p === 'min-' ? actual >= v : p === 'max-' ? actual <= v : actual === v;
      return ok ? TRUE : FALSE;
    },
  );
}

export function rewriteMediaQueries(css: string, width: number, height: number): string {
  return css.replace(/@media([^{;]+)\{/g, (_m, prelude: string) => `@media${rewriteMediaPrelude(prelude, width, height)}{`);
}

// Rewrites the width and height media queries of every style sheet of the
// page and its frames, once loaded. CSS.enable reports the sheets already
// there; enabling before navigation does not survive the switch to a file:
// page's process.
export async function applyMediaWidth(cdp: CDPSession, width: number, height: number): Promise<number> {
  const ids: string[] = [];
  const added = (e: { header: { styleSheetId: string } }) => ids.push(e.header.styleSheetId);
  cdp.on('CSS.styleSheetAdded', added);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  cdp.off('CSS.styleSheetAdded', added);
  // Frames that load the same header share their sheets' text: rewrite once.
  const texts = await Promise.all(
    ids.map((styleSheetId) => cdp.send('CSS.getStyleSheetText', { styleSheetId }).then((r) => r.text, () => '')),
  );
  const rewritten = new Map<string, string>();
  let changed = 0;
  await Promise.all(ids.map((styleSheetId, i) => {
    const text = texts[i]!;
    let next = rewritten.get(text);
    if (next === undefined) rewritten.set(text, (next = rewriteMediaQueries(text, width, height)));
    if (next === text) return undefined;
    changed++;
    return cdp.send('CSS.setStyleSheetText', { styleSheetId, text: next });
  }));
  return changed;
}

// Runs in the page. Qt draws text at whole pixel sizes: wkhtmltopdf rounds
// every computed font size to the nearest pixel (13.5px becomes 14px).
export function roundFontSizes(): number {
  const elements = [...document.querySelectorAll<HTMLElement>('body, body *')];
  const sizes = elements.map((e) => parseFloat(getComputedStyle(e).fontSize));
  let changed = 0;
  elements.forEach((e, i) => {
    const s = sizes[i]!;
    if (Math.abs(s - Math.round(s)) > 0.001) {
      e.style.setProperty('font-size', `${Math.round(s)}px`, 'important');
      changed++;
    }
  });
  return changed;
}
