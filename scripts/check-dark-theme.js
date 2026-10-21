/**
 * Flags CSS classes that hard-code a colour but have no override in styles/dark-theme.css,
 * so new UI doesn't ship unreadable in dark mode (the ICEMAN tabs did, Oct 2026).
 *
 *   npm run check:dark            fail on gaps not in the baseline
 *   npm run check:dark -- --update   rewrite the baseline (after a deliberate review)
 *
 * The baseline lists classes that were already uncovered when this check was added —
 * many are fine (white text on a brand-blue button). Shrink it as they get looked at.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const DARK_THEME = path.join(root, 'styles', 'dark-theme.css');
const BASELINE = path.join(__dirname, 'dark-theme-baseline.json');
// The office TV display has no dark mode.
const SKIP = new Set(['dark-theme.css', 'tv-display.css']);
const STYLE_DIRS = [path.join(root, 'styles'), path.join(root, 'src', 'styles')];

const COLOR_PROPS = /^(color|background|background-color|border|border-(top|right|bottom|left)|border(-(top|right|bottom|left))?-color|outline-color|fill|stroke)$/;
const COLOR_VALUE = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b/i;

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Innermost `selector { declarations }` blocks; @media wrappers are looked through. */
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const selector = m[1].trim();
    if (!selector.startsWith('@')) out.push({ selector, body: m[2] });
  }
  return out;
}

function hardCodesColor(body) {
  return body.split(';').some((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return false;
    const prop = decl.slice(0, i).trim().toLowerCase();
    return COLOR_PROPS.test(prop) && COLOR_VALUE.test(decl.slice(i + 1));
  });
}

/** The class the rule styles: the last class in each comma-separated selector. */
function subjectClasses(selector) {
  return selector
    .split(',')
    .map((s) => s.replace(/::?[a-z-]+(\([^)]*\))?/gi, ''))
    .map((s) => (s.match(/\.[A-Za-z_][\w-]*/g) || []).pop())
    .filter(Boolean)
    .map((c) => c.slice(1));
}

const darkCss = stripComments(fs.readFileSync(DARK_THEME, 'utf8'));
const darkClasses = new Set((darkCss.match(/\.[A-Za-z_][\w-]*/g) || []).map((c) => c.slice(1)));

const gaps = new Map(); // class -> file
for (const dir of STYLE_DIRS) {
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.css') && !SKIP.has(f))) {
    const css = stripComments(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const { selector, body } of rules(css)) {
      if (!hardCodesColor(body)) continue;
      for (const cls of subjectClasses(selector)) {
        if (!darkClasses.has(cls) && !gaps.has(cls)) gaps.set(cls, path.relative(root, path.join(dir, file)).replace(/\\/g, '/'));
      }
    }
  }
}

const sorted = [...gaps.keys()].sort();

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline updated: ${sorted.length} classes.`);
  process.exit(0);
}

const baseline = new Set(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : []);
const fresh = sorted.filter((cls) => !baseline.has(cls));

if (fresh.length) {
  console.error('These classes hard-code a colour but have no dark-theme.css override:\n');
  for (const cls of fresh) console.error(`  .${cls}  (${gaps.get(cls)})`);
  console.error('\nAdd overrides in styles/dark-theme.css, or run `npm run check:dark -- --update` if they are fine in dark mode.');
  process.exit(1);
}
console.log(`Dark theme check passed (${baseline.size} baseline classes).`);
