import katex from 'katex';
import { MathFormulaToken } from '../types';

export function convertComputationalCodeToLatex(code: string): string {
  const lines = code.split('\n');
  const convertedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$$') || trimmed.startsWith('```') || trimmed.startsWith('#')) {
      convertedLines.push(line);
      continue;
    }

    let s = line;

    // Power ** -> ^
    s = s.replace(/\*\*([0-9a-zA-Z_]+|\([^)]+\))/g, '^{$1}');
    s = s.replace(/\^\{([0-9a-zA-Z_]+)\}/g, '^{$1}');

    // Multiplication: 4 * x or 4*x -> 4 \cdot x
    s = s.replace(/(\d+)\s*\*\s*([a-zA-Z])/g, '$1 \\cdot $2');
    s = s.replace(/([a-zA-Z0-9])\s*\*\s*([a-zA-Z0-9])/g, '$1 \\cdot $2');

    // Square root: sqrt(...) -> \sqrt{...}
    for (let i = 0; i < 3; i++) {
      s = s.replace(/\bsqrt\(([^()]+)\)/g, '\\sqrt{$1}');
    }

    // Fractions: (num)/(den) -> \frac{num}{den}
    s = s.replace(/\(([^\/()]+)\)\s*\/\s*\(([^\/()]+)\)/g, '\\frac{$1}{$2}');
    s = s.replace(/(\b[a-zA-Z0-9_]+)\s*\/\s*(\b[a-zA-Z0-9_]+)/g, '\\frac{$1}{$2}');

    // Greek letters
    const greek: Record<string, string> = {
      alpha: '\\alpha',
      beta: '\\beta',
      gamma: '\\gamma',
      delta: '\\delta',
      epsilon: '\\epsilon',
      zeta: '\\zeta',
      eta: '\\eta',
      theta: '\\theta',
      iota: '\\iota',
      kappa: '\\kappa',
      lambda: '\\lambda',
      mu: '\\mu',
      nu: '\\nu',
      xi: '\\xi',
      pi: '\\pi',
      rho: '\\rho',
      sigma: '\\sigma',
      tau: '\\tau',
      phi: '\\phi',
      chi: '\\chi',
      psi: '\\psi',
      omega: '\\omega',
      Delta: '\\Delta',
      Gamma: '\\Gamma',
      Theta: '\\Theta',
      Lambda: '\\Lambda',
      Sigma: '\\Sigma',
      Phi: '\\Phi',
      Psi: '\\Psi',
      Omega: '\\Omega',
    };

    for (const [name, sym] of Object.entries(greek)) {
      const regex = new RegExp(`(?<!\\\\)\\b${name}\\b`, 'g');
      s = s.replace(regex, sym);
    }

    // Common functions
    const funcs = [
      'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
      'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
      'exp', 'log', 'ln', 'lim'
    ];
    for (const fn of funcs) {
      const regex = new RegExp(`(?<!\\\\)\\b${fn}\\b`, 'g');
      s = s.replace(regex, `\\${fn}`);
    }

    // Derivatives and Integrals
    s = s.replace(/\bdiff\(([a-zA-Z]),\s*([a-zA-Z])\)/g, '\\frac{d$1}{d$2}');
    s = s.replace(/\bint\(([^,]+),\s*([a-zA-Z])\)/g, '\\int $1 \\, d$2');
    s = s.replace(
      /\bsum\(([^,]+),\s*([a-zA-Z]),\s*([0-9a-zA-Z]+),\s*([0-9a-zA-Z]+)\)/g,
      '\\sum_{$2=$3}^{$4} $1'
    );

    // Common symbols
    s = s.replace(/\b(inf|infinity|Infinity)\b/g, '\\infty');
    s = s.replace(/<=/g, '\\le ')
         .replace(/>=/g, '\\ge ')
         .replace(/!=/g, '\\neq ')
         .replace(/~=/g, '\\approx ');

    convertedLines.push(s);
  }

  return convertedLines.join('\n');
}

export const MATH_COMMANDS_REGEX = /\\(?:frac|sqrt|sum|prod|int|iint|iiint|oint|lim|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|arcsin|arccos|arctan|log|ln|Ln|exp|det|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|infty|partial|nabla|to|rightarrow|leftarrow|Rightarrow|Leftarrow|iff|implies|cdot|times|pm|mp|div|ast|star|circ|bullet|leq|geq|le|ge|neq|approx|equiv|sim|simeq|propto|subset|supset|subseteq|supseteq|in|notin|ni|forall|exists|cup|cap|setminus|emptyset|varnothing|left|right|text|mathrm|mathbf|mathit|mathsf|mathtt|mathcal|hat|bar|vec|tilde|dot|ddot|overline|underline|quad|qquad)\b/;

export function looksLikeMath(candidate: string): boolean {
  const s = candidate.trim();
  if (!s || s.length < 2) return false;
  // No Persian / Arabic characters inside math formulas
  if (/[\u0600-\u06FF]/.test(s)) return false;
  // Ignore citation tags like [SOURCE_IMAGE_1]
  if (/^\[?SOURCE_IMAGE_\d+\]?$/.test(s) || (/^\[?[A-Za-z0-9_]+\]?$/.test(s) && s.includes('_') && !s.includes('\\') && !s.includes('^'))) {
    return false;
  }
  // Ignore plain numbers / simple punctuation
  if (/^[\d\s.,:;()[\]\-]+$/.test(s)) return false;

  // Strong math indicators
  if (MATH_COMMANDS_REGEX.test(s)) return true;
  if (/\\begin\{/.test(s)) return true;
  if (/[A-Za-z0-9)\]}]\s*[\^_]\s*([A-Za-z0-9]|\{[^}]+\})/.test(s)) return true;
  if (/[A-Za-z0-9)\]}]\s*(?:=|\/|\\approx|\\neq|\\le|\\ge|\\to|\\implies|<|>)\s*[A-Za-z0-9(\[{\\]/.test(s)) return true;
  if (/\([^)]+\)\s*'\s*=/.test(s) || /'\s*=/.test(s)) return true;
  // Derivative expressions: f'(a), f'(x), f''(c), g'(t), y', u', etc.
  if (/\b[fghuvwy]\s*'{1,3}(?:\([a-zA-Z0-9, ]+\))?/.test(s)) return true;
  // Coordinates / point evaluation: (a, f(a)), (x_0, y_0)
  if (/\([a-zA-Z0-9_]+,\s*[a-zA-Z0-9_()']+\)/.test(s)) return true;
  if (/\b(?:Ln|ln|log|exp|sin|cos|tan)\b\s*[A-Za-z0-9(]/.test(s)) return true;
  if (/\b[A-Za-z]\s*(?:\+|\-|\*|\/|\\cdot)\s*[A-Za-z0-9]/.test(s) && (s.includes('=') || s.includes('^') || s.includes('\\'))) return true;

  return false;
}

function cleanMath(s: string): string {
  return s.trim().replace(/(?<!\\)\bLn\b/g, '\\ln');
}

function balanceParens(lead: string, core: string, trail: string): [string, string, string] {
  let l = lead;
  let c = core;
  let t = trail;

  const countChar = (str: string, ch: string) => (str.split(ch).length - 1);

  // If core needs an opening paren that was in lead
  while (countChar(c, '(') < countChar(c, ')') && l.endsWith('(')) {
    l = l.slice(0, -1);
    c = '(' + c;
  }

  // If core needs a closing paren that was in trail
  while (countChar(c, ')') < countChar(c, '(') && t.startsWith(')')) {
    t = t.slice(1);
    c = c + ')';
  }

  // Check if outer parens were just wrappers
  if (c.startsWith('(') && c.endsWith(')')) {
    const inner = c.slice(1, -1).trim();
    let depth = 0;
    let balanced = true;
    for (const ch of inner) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth < 0) {
          balanced = false;
          break;
        }
      }
    }
    if (balanced && depth === 0) {
      l = l + '(';
      t = ')' + t;
      c = inner;
    }
  }

  return [l, c, t];
}

export function cleanFormulaDelimiters(s: string): string {
  let cleaned = (s || '').trim();
  let changed = true;

  while (changed && cleaned.length > 0) {
    changed = false;

    // Pairs of delimiters
    const pairs: [RegExp | string, RegExp | string][] = [
      [/^\\ ?\[/, /\\cr\s*\]$/],
      [/^\\\\\[/, /\\\\cr\s*\]$/],
      [/^\\ ?\[/, /\\ ?\]$/],
      [/^\\\\\[/, /\\\\\]$/],
      [/^\\ ?\(/, /\\ ?\)$/],
      [/^\\\\\\?\(/, /\\\\\\?\)$/],
      ['$$', '$$'],
      ['$', '$'],
    ];

    for (const [left, right] of pairs) {
      const matchLeft = typeof left === 'string' ? cleaned.startsWith(left) : left.test(cleaned);
      const matchRight = typeof right === 'string' ? cleaned.endsWith(right) : right.test(cleaned);
      if (matchLeft && matchRight) {
        if (typeof left === 'string') {
          cleaned = cleaned.slice(left.length);
        } else {
          cleaned = cleaned.replace(left, '');
        }
        if (typeof right === 'string') {
          cleaned = cleaned.slice(0, -right.length);
        } else {
          cleaned = cleaned.replace(right, '');
        }
        cleaned = cleaned.trim();
        changed = true;
        break;
      }
    }

    // Strip dangling single artifacts at edges
    const leadingArtifacts = [/^(?:\\ ?\[|\\\\\[)/, /^(?:\\ ?\(|\\\\\\?\()/];
    for (const la of leadingArtifacts) {
      if (la.test(cleaned)) {
        cleaned = cleaned.replace(la, '').trim();
        changed = true;
      }
    }

    const trailingArtifacts = [
      /(?:\\cr\s*\]|\\\\cr\s*\])$/,
      /(?:\\ ?\]|\\\\\])$/,
      /(?:\\ ?\)|\\\\\\?\))$/,
      /\\cr$/,
    ];
    for (const ta of trailingArtifacts) {
      if (ta.test(cleaned)) {
        cleaned = cleaned.replace(ta, '').trim();
        changed = true;
      }
    }

    while (cleaned.startsWith('$')) {
      cleaned = cleaned.slice(1).trim();
      changed = true;
    }
    while (cleaned.endsWith('$')) {
      cleaned = cleaned.slice(0, -1).trim();
      changed = true;
    }
  }

  return cleaned;
}

export function autoDetectAndWrapMath(text: string): { text: string; count: number } {
  // Fix trailing \\) or \\( after Persian text: e.g. "برای توابع \\)" -> "برای توابع:"
  let normalized = text.replace(/([\u0600-\u06FF])\s*\\+[\(\)]/g, '$1:');

  // Match broken cases/parametric systems
  const casesPattern = /^[ \t]*\{[ \t]*\n([\s\S]+?)\n[ \t]*(?::\s*\)+[\\/]*|:\s*\\+|\}|:\s*\)\s*\\*)/gm;
  normalized = normalized.replace(casesPattern, (_m, body) => {
    const cleanLines = (body as string)
      .split('\n')
      .map((l) => l.trim().replace(/\\+$/, '').replace(/^\$+|\$+$/g, '').trim())
      .filter(Boolean);
    return `\n$$\n\\begin{cases}\n${cleanLines.join(' \\\\ \n')}\n\\end{cases}\n$$\n`;
  });

  const lines = normalized.split('\n');
  const outLines: string[] = [];
  let totalCount = 0;

  let inCode = false;
  let inEnv = false;
  let inDisplayMath = false;
  let inBracketMath = false;
  let envBuf: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const stripped = line.trim();

    // Discard stray backslash lines: \ or \\ or \ 
    if (/^\\+\s*$/.test(stripped)) {
      continue;
    }

    if (stripped.startsWith('```')) {
      inCode = !inCode;
      outLines.push(line);
      continue;
    }
    if (inCode) {
      outLines.push(line);
      continue;
    }

    // Multiline display math $$ ... $$
    if (inDisplayMath) {
      outLines.push(line);
      if (stripped.endsWith('$$') || stripped === '$$') {
        inDisplayMath = false;
      }
      continue;
    }
    if (stripped.startsWith('$$')) {
      outLines.push(line);
      if (stripped === '$$' || (stripped.length > 2 && !stripped.slice(2).includes('$$'))) {
        inDisplayMath = true;
      }
      continue;
    }

    // Multiline bracket display math \[ ... \]
    if (inBracketMath) {
      outLines.push(line);
      if (stripped.endsWith('\\]') || stripped === '\\]' || /\\cr\s*\]$/.test(stripped)) {
        inBracketMath = false;
      }
      continue;
    }
    if (stripped.startsWith('\\[') || stripped.startsWith('\\ [')) {
      outLines.push(line);
      if (!stripped.includes('\\]') && !/\\cr\s*\]/.test(stripped)) {
        inBracketMath = true;
      }
      continue;
    }

    // Standalone LaTeX environment like \begin{array} ... \end{array}
    if (/^\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|cases|align\*?|equation\*?)\}/.test(stripped)) {
      inEnv = true;
      envBuf = [line];
      continue;
    }
    if (inEnv) {
      envBuf.push(line);
      if (/\\end\{(array|matrix|pmatrix|bmatrix|vmatrix|cases|align\*?|equation\*?)\}/.test(stripped)) {
        inEnv = false;
        outLines.push('$$');
        outLines.push(...envBuf);
        outLines.push('$$');
        envBuf = [];
        totalCount++;
      }
      continue;
    }

    // Single-line display math starting with \[ or \ [ or \\\[ or $$
    let isSingleDisplay = false;
    for (const op of ['$$', '\\ [', '\\[', '\\\\[']) {
      if (stripped.startsWith(op)) {
        for (const cl of ['$$', '\\cr]', '\\cr ]', '\\\\cr]', '\\]', '\\\\]']) {
          if (stripped.endsWith(cl) && stripped.length >= op.length + cl.length) {
            const cleanCore = cleanFormulaDelimiters(stripped);
            if (cleanCore) {
              outLines.push(`$$\n${cleanCore}\n$$`);
              isSingleDisplay = true;
              totalCount++;
              break;
            }
          }
        }
        if (isSingleDisplay) break;
      }
    }
    if (isSingleDisplay) continue;

    // Line processing
    const delimPattern = /(\$\$[^\$]+\$\$|\$[^\$]+\$|(?:\\ ?\[|\\\\\[)[\s\S]+?(?:\\ ?\]|\\\\\]|\\\\?cr\s*\])|(?:\\ ?\(|\\\\\\?\()[\s\S]+?(?:\\ ?\)|\\\\\\?\)))/;
    const parts = line.split(delimPattern);
    const lineOut: string[] = [];

    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
      const part = parts[pIdx];
      if (!part) continue;

      if (pIdx % 2 === 1) {
        // Matched math delimiter
        const cleanedFormula = cleanFormulaDelimiters(part);
        lineOut.push(`$${cleanedFormula}$`);
        continue;
      }

      // Split non-math text by Persian chars and Persian punctuation
      const segments = part.split(/([\u0600-\u06FF\u060C\u061B]+)/);
      for (let sIdx = 0; sIdx < segments.length; sIdx++) {
        const seg = segments[sIdx];
        if (!seg) continue;

        if (/[\u0600-\u06FF\u060C\u061B]/.test(seg)) {
          lineOut.push(seg);
          continue;
        }

        // Non-Persian segment: extract leading/trailing punctuation
        const mLead = seg.match(/^([\s:.\-*|()]+)/);
        let lead = mLead ? mLead[1] : '';
        const rest = seg.slice(lead.length);

        const mTrail = rest.match(/([\s:.\-*|()]+)$/);
        let trail = mTrail ? mTrail[1] : '';
        let core = trail ? rest.slice(0, -trail.length) : rest;

        [lead, core, trail] = balanceParens(lead, core, trail);

        if (looksLikeMath(core)) {
          lineOut.push(lead);
          lineOut.push(`$${cleanMath(core)}$`);
          lineOut.push(trail);
          totalCount++;
        } else {
          lineOut.push(seg);
        }
      }
    }

    outLines.push(lineOut.join(''));
  }

  return { text: outLines.join('\n'), count: totalCount };
}

export function parseDocumentTokens(text: string): MathFormulaToken[] {
  // Automatically detect and wrap any unwrapped math formulas so preview renders them
  const normalizedText = autoDetectAndWrapMath(text).text;

  const tokens: MathFormulaToken[] = [];
  let i = 0;
  let textBuf = '';

  const flushText = () => {
    if (textBuf) {
      tokens.push({ type: 'text', content: textBuf });
      textBuf = '';
    }
  };

  while (i < normalizedText.length) {
    // Code block ``` ... ```
    if (normalizedText.startsWith('```', i)) {
      const endIdx = normalizedText.indexOf('```', i + 3);
      if (endIdx !== -1) {
        flushText();
        tokens.push({
          type: 'code',
          content: normalizedText.slice(i, endIdx + 3),
        });
        i = endIdx + 3;
        continue;
      }
    }

    // Display math $$ ... $$
    if (normalizedText.startsWith('$$', i)) {
      const endIdx = normalizedText.indexOf('$$', i + 2);
      if (endIdx !== -1) {
        flushText();
        const formula = cleanFormulaDelimiters(normalizedText.slice(i + 2, endIdx));
        tokens.push({
          type: 'display-math',
          content: formula,
        });
        i = endIdx + 2;
        continue;
      }
    }

    // Display math \\[ ... \\], \[ ... \], \ [ ... \cr], etc.
    let matchedOpener: string | null = null;
    let openerLen = 0;
    if (normalizedText.startsWith('\\\\\\\\[', i)) {
      matchedOpener = '\\\\\\\[';
      openerLen = 4;
    } else if (normalizedText.startsWith('\\\\ [', i)) {
      matchedOpener = '\\\\ [';
      openerLen = 4;
    } else if (normalizedText.startsWith('\\[', i)) {
      matchedOpener = '\\[';
      openerLen = 2;
    } else if (normalizedText.startsWith('\\ [', i)) {
      matchedOpener = '\\ [';
      openerLen = 3;
    }

    if (matchedOpener) {
      let bestEnd = -1;
      let closerLen = 0;
      for (const cl of ['\\cr]', '\\cr ]', '\\\\cr]', '\\]', '\\\\]']) {
        const found = normalizedText.indexOf(cl, i + openerLen);
        if (found !== -1 && (bestEnd === -1 || found < bestEnd)) {
          bestEnd = found;
          closerLen = cl.length;
        }
      }
      if (bestEnd !== -1) {
        flushText();
        const formula = cleanFormulaDelimiters(normalizedText.slice(i + openerLen, bestEnd));
        tokens.push({
          type: 'display-math',
          content: formula,
        });
        i = bestEnd + closerLen;
        continue;
      }
    }

    // Inline math $ ... $
    if (normalizedText[i] === '$' && normalizedText[i + 1] !== '$') {
      let endIdx = -1;
      for (let j = i + 1; j < normalizedText.length; j++) {
        if (normalizedText[j] === '$' && normalizedText[j - 1] !== '\\') {
          endIdx = j;
          break;
        }
      }
      if (endIdx !== -1) {
        flushText();
        const formula = cleanFormulaDelimiters(normalizedText.slice(i + 1, endIdx));
        tokens.push({
          type: 'inline-math',
          content: formula,
        });
        i = endIdx + 1;
        continue;
      }
    }

    // Inline math \\( ... \\)
    if (normalizedText.startsWith('\\\\(', i)) {
      const endIdx = normalizedText.indexOf('\\\\)', i + 3);
      if (endIdx !== -1) {
        flushText();
        const formula = cleanFormulaDelimiters(normalizedText.slice(i + 3, endIdx));
        tokens.push({
          type: 'inline-math',
          content: formula,
        });
        i = endIdx + 3;
        continue;
      }
    }

    // Inline math \( ... \)
    if (normalizedText.startsWith('\\(', i)) {
      const endIdx = normalizedText.indexOf('\\)', i + 2);
      if (endIdx !== -1) {
        flushText();
        const formula = cleanFormulaDelimiters(normalizedText.slice(i + 2, endIdx));
        tokens.push({
          type: 'inline-math',
          content: formula,
        });
        i = endIdx + 2;
        continue;
      }
    }

    // LaTeX environments: \begin{env} ... \end{env}
    const envMatch = normalizedText.slice(i).match(/^(?:\\\\|\\)begin\{([A-Za-z*]+)\}/);
    if (envMatch) {
      const envName = envMatch[1];
      const closeTag1 = `\\end{${envName}}`;
      const closeTag2 = `\\\\end{${envName}}`;
      let endIdx = normalizedText.indexOf(closeTag1, i + envMatch[0].length);
      let closeLen = closeTag1.length;
      if (endIdx === -1) {
        endIdx = normalizedText.indexOf(closeTag2, i + envMatch[0].length);
        closeLen = closeTag2.length;
      }
      if (endIdx !== -1) {
        flushText();
        const formula = normalizedText.slice(i, endIdx + closeLen).trim();
        tokens.push({
          type: 'display-math',
          content: formula,
        });
        i = endIdx + closeLen;
        continue;
      }
    }

    textBuf += normalizedText[i];
    i++;
  }

  flushText();
  return tokens;
}

export function renderKatexSafe(
  formula: string,
  displayMode = false
): { html: string; error?: string } {
  const cleaned = cleanFormulaDelimiters(formula);
  if (!cleaned) {
    return { html: '' };
  }

  try {
    const html = katex.renderToString(cleaned, {
      displayMode,
      throwOnError: true,
      strict: 'ignore',
    });
    return { html };
  } catch (err: any) {
    try {
      const fallbackHtml = katex.renderToString(cleaned, {
        displayMode,
        throwOnError: false,
        strict: 'ignore',
      });
      return {
        html: fallbackHtml,
        error: err.message || 'خطای نگارش LaTeX',
      };
    } catch {
      return {
        html: `<span class="text-rose-400 font-mono text-xs">[خطای فرمول: ${cleaned}]</span>`,
        error: err.message || 'فرمول نامعتبر',
      };
    }
  }
}
