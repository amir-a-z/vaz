/**
 * Persian Text Pre-processor for Word Document Generation.
 *
 * Upgraded Pre-processing & Separation Engine:
 * 1. Math Environment Separation & OMML Conversion:
 *    - Detects \begin{array}, \begin{matrix}, \begin{pmatrix}, \begin{bmatrix},
 *      \begin{cases}, \begin{aligned}, etc., even when embedded inline or improperly delimited.
 *    - Isolates them with clean block spacing (\n\n) so they never leak as plain text.
 *    - Formats array environments into display math ($$...$$) or standard LaTeX arrays
 *      so the Word engine converts them into native Word OMML math formulas or native Word tables.
 *    - Fixes unclosed \begin{array} environments and cleans up orphaned or malformed array tags.
 * 2. BiDi & Line-by-Line Directionality Ordering (RTL/LTR):
 *    - Start of line: Prepends RLM (\u200F) when a Persian line starts with an English term,
 *      acronym, or number (including headings and list items), ensuring the line renders Right-to-Left.
 *    - Middle of line: Enforces clean spacing and BiDi boundaries around English words,
 *      acronyms like (ODE), (API), and mathematical terms, preventing parenthesis inversion.
 *    - End of line: Fixes the BiDi punctuation jump when a line ends with an English word,
 *      number, or acronym followed by punctuation (. ! ؟ :), pinning it to the correct end.
 * 3. Persian Typography Normalization:
 *    - Standardizes Arabic Yeh ('ي') and Kaf ('ك') to Persian 'ی' and 'ک'.
 *    - Standardizes Persian commas ('،') and question marks ('؟').
 */

export const RLM = '\u200F'; // Right-to-Left Mark (U+200F)
export const LRM = '\u200E'; // Left-to-Right Mark (U+200E)

/**
 * Checks if a line contains Persian / Arabic script.
 */
export function isRtlLine(line: string): boolean {
  return /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(line);
}

/**
 * Determines whether a LaTeX \begin{array} construct represents a data/text Table
 * or a pure mathematical construct (matrix/system of equations).
 */
export function isTableArray(colSpec: string, body: string): boolean {
  if (!body) return false;

  // 1. Explicit table border / divider commands
  if (/\\(?:hline|cline|toprule|midrule|bottomrule)/.test(body)) return true;

  // 2. Explicit column divider lines in colSpec: e.g. {|c|c|}, {l|r}, {c|c|c}
  if (/\|/.test(colSpec)) return true;

  // 3. Multi-column merges
  if (/\\multicolumn/.test(body)) return true;

  // 4. Persian / Arabic text inside array cells
  if (/[\u0600-\u06FF]/.test(body)) return true;

  // 5. Text styling commands commonly used for table headers or labels
  if (/\\(?:text|mathrm|textbf|textit|mbox)\{/.test(body)) return true;

  // 6. Inspect individual rows: if multiple rows contain descriptive text words or headers
  const cleanBody = body.replace(/\\cr\b/g, '\\\\');
  const rows = cleanBody.split(/\\\\(?:\s*\[[^\]]*\])?/).map((r) => r.trim()).filter(Boolean);
  if (rows.length >= 2) {
    const firstRowCells = rows[0].split(/(?<!\\)&/).map((c) => c.trim());
    if (
      firstRowCells.length >= 2 &&
      firstRowCells.some((c) =>
        /^[A-Za-z\u0600-\u06FF\s]{2,}$/.test(
          c.replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([^}]*)\}/g, '$1')
        )
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Converts a LaTeX \begin{array} structure into a clean, Word-compatible Markdown table.
 * This ensures that Word's generator creates native table grids with proper borders,
 * RTL alignment, Persian typography, and OMML formulas inside each cell.
 */
export function convertLatexArrayToWordTable(colSpec: string, body: string): string {
  // 1. Expand repetition syntax e.g. *{3}{c} -> ccc
  let cleanColSpec = (colSpec || '')
    .replace(/\*\{(\d+)\}\{([lcrp|]+)\}/gi, (_, count, align) => align.repeat(Number(count)))
    .replace(/@\{[^}]*\}/g, '')
    .replace(/[^lcr|]/gi, '');

  const alignLetters = cleanColSpec.replace(/\|/g, '').split('');

  // 2. Remove horizontal rules and normalize line breaks
  let cleanBody = body
    .replace(/\\(?:hline|cline\{[^}]*\}|toprule|midrule|bottomrule)/g, '')
    .replace(/\\cr\b/g, '\\\\');

  // 3. Split rows by unescaped \\
  const rawRows = cleanBody.split(/\\\\(?:\s*\[[^\]]*\])?/);
  const rows: string[][] = [];

  for (const rawRow of rawRows) {
    const trimmed = rawRow.trim();
    if (!trimmed) continue;
    // Split columns by unescaped &
    const cells = trimmed.split(/(?<!\\)&/).map((c) => c.trim());
    rows.push(cells);
  }

  if (rows.length === 0) return '';

  // Determine maximum column count
  const maxCols = Math.max(...rows.map((r) => r.length), alignLetters.length || 1);

  // 4. Format each cell: unwrap \text{...}, protect OMML math expressions, escape raw pipes
  const formattedRows = rows.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push('');
    return padded.map((cell) => {
      let c = cell.trim();
      // Unwrap \multicolumn{n}{align}{content} -> content
      c = c.replace(/\\multicolumn\{\d+\}\{[^}]*\}\{([\s\S]*?)\}/g, '$1');

      // Unwrap \text{...}, \mathrm{...}, \textbf{...}, \textit{...}, \mbox{...} if it encloses text
      c = c.replace(/\\(?:text|mathrm|textbf|textit|mbox)\{([\s\S]*?)\}/g, '$1');

      // If the cell contains LaTeX math commands/operators and is not already wrapped in $,
      // wrap it in $...$ so the engine's OMML converter processes it as native Word math.
      // But if it is pure text or numbers, leave as clean text.
      const hasMathMarkup = /\\[A-Za-z]+|[\^_=+\-*/<>]/.test(c);
      const isPureText = /^[\u0600-\u06FF\s\d.,:؛!؟()\-+]+$/.test(c);

      if (hasMathMarkup && !isPureText && !c.startsWith('$') && !c.endsWith('$')) {
        c = `$${c}$`;
      }

      // Escape raw Markdown table pipes
      c = c.replace(/(?<!\\)\|/g, '\\|');
      return c || ' ';
    });
  });

  // 5. Construct alignment row
  const alignRow: string[] = [];
  for (let col = 0; col < maxCols; col++) {
    const a = alignLetters[col] || 'c';
    if (a === 'l') alignRow.push(':---');
    else if (a === 'r') alignRow.push('---:');
    else alignRow.push(':---:');
  }

  const header = formattedRows[0];
  const dataRows = formattedRows.slice(1);

  let md = `\n\n| ${header.join(' | ')} |\n`;
  md += `| ${alignRow.join(' | ')} |\n`;
  for (const dr of dataRows) {
    md += `| ${dr.join(' | ')} |\n`;
  }
  md += `\n\n`;

  return md;
}

/**
 * Identifies, isolates, and normalizes LaTeX math environments
 * such as \begin{array}, \begin{matrix}, \begin{pmatrix}, etc.,
 * ensuring they are never rendered as raw text in Word.
 *
 * Converts complex LaTeX structures (\begin{array}) into:
 * 1. Native Word-compatible Markdown table structures when they represent data/bordered tables.
 * 2. Standard OMML-compatible math equivalents (\begin{cases}, \begin{pmatrix}, \begin{bmatrix},
 *    \begin{vmatrix}, \begin{matrix}) when they represent mathematical matrices or equation systems.
 * Isolates them from adjacent text and prevents document corruption.
 */
export function normalizeMathEnvironments(input: string): string {
  if (!input) return input;
  let text = input;

  // 1. Remove empty or orphaned array blocks like \begin{array}{}\end{array}
  text = text.replace(/\\begin\{array\}\s*\{?\}?\s*\\end\{array\}/g, '');

  // 2. Pre-clean \begin{array} syntax anomalies
  // a) Repetition format: *{3}{c} -> ccc
  text = text.replace(
    /\\begin\{array\}\s*\{([^}]*)\}/g,
    (_m, colSpec: string) => {
      const expanded = colSpec.replace(/\*\{(\d+)\}\{([lcrp|]+)\}/gi, (_, count, align) =>
        align.repeat(Number(count))
      );
      return `\\begin{array}{${expanded}}`;
    }
  );

  // b) Remove array optional position specifiers e.g. \begin{array}[t]{cc} -> \begin{array}{cc}
  text = text.replace(/\\begin\{array\}\s*\[[tbc]\]\s*(\{?[^}]*\}?)/g, '\\begin{array}$1');

  // c) Fix \begin{array} without column specification only if it is an actual environment with rows
  text = text.replace(/\\begin\{array\}(?!\s*[\{\[])/g, (match, offset, str) => {
    const rest = str.slice(offset);
    const nextBreak = rest.search(/\n\s*(\n|#{1,6}\s+)/);
    const block = nextBreak !== -1 ? rest.slice(0, nextBreak) : rest;
    if (block.includes('&') || block.includes('\\\\')) {
      return '\\begin{array}{c}';
    }
    return match;
  });

  // d) Normalize TeX \cr to \\
  text = text.replace(/\\cr\b/g, '\\\\');

  // 3. Convert delimited arrays (cases, matrices, determinants, norms) into valid OMML structures
  // a) Systems of equations / piecewise functions: \left\{ \begin{array}{...} ... \end{array} \right. -> \begin{cases} ... \end{cases}
  text = text.replace(
    /\\left\\\{\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*(?:\\right\.)?/g,
    (_, body) => `\\begin{cases}${body.replace(/&=&/g, '&=')}\\end{cases}`
  );

  // b) Inverted right-brace systems: \left. \begin{array}{...} ... \end{array} \right\} -> \begin{cases} ... \end{cases}
  text = text.replace(
    /\\left\.\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*\\right\\\}/g,
    (_, body) => `\\begin{cases}${body.replace(/&=&/g, '&=')}\\end{cases}`
  );

  // c) Parentheses matrix: \left( \begin{array} ... \end{array} \right) -> \begin{pmatrix} ... \end{pmatrix}
  text = text.replace(
    /\\left\(\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*\\right\)/g,
    '\\begin{pmatrix}$1\\end{pmatrix}'
  );

  // d) Square bracket matrix: \left[ \begin{array} ... \end{array} \right] -> \begin{bmatrix} ... \end{bmatrix}
  text = text.replace(
    /\\left\[\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*\\right\]/g,
    '\\begin{bmatrix}$1\\end{bmatrix}'
  );

  // e) Determinant: \left| \begin{array} ... \end{array} \right| -> \begin{vmatrix} ... \end{vmatrix}
  text = text.replace(
    /\\left\|\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*\\right\|/g,
    '\\begin{vmatrix}$1\\end{vmatrix}'
  );

  // f) Norm: \left\| \begin{array} ... \end{array} \right\| -> \begin{Vmatrix} ... \end{Vmatrix}
  text = text.replace(
    /\\left\\\|\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*\\right\\\|/g,
    '\\begin{Vmatrix}$1\\end{Vmatrix}'
  );

  // g) Curly braces matrix: \left\{ \begin{array} ... \end{array} \right\} -> \begin{Bmatrix} ... \end{Bmatrix}
  text = text.replace(
    /\\left\\\{\s*\\begin\{(?:array|matrix\*?)\}\s*(?:\{[^}]*\})?([\s\S]*?)\\end\{(?:array|matrix\*?)\}\s*\\right\\\}/g,
    '\\begin{Bmatrix}$1\\end{Bmatrix}'
  );

  // h) Replace environments not natively supported in OMMLConverter (\begin{aligned}, \begin{alignat}, \begin{eqnarray})
  // with \begin{matrix}, which translates directly to native OMML <m:m>
  text = text.replace(/\\begin\{aligned\*?\}/g, '\\begin{matrix}');
  text = text.replace(/\\end\{aligned\*?\}/g, '\\end{matrix}');

  text = text.replace(/\\begin\{alignat\*?\}\s*(?:\{[^}]*\})?/g, '\\begin{matrix}');
  text = text.replace(/\\end\{alignat\*?\}/g, '\\end{matrix}');

  text = text.replace(/\\begin\{eqnarray\*?\}/g, '\\begin{matrix}');
  text = text.replace(/\\end\{eqnarray\*?\}/g, '\\end{matrix}');

  // 4. Detect unclosed \begin{array} and close them before next heading or end of text
  const arrayMatches = [...text.matchAll(/\\begin\{array\}/g)];
  for (let i = arrayMatches.length - 1; i >= 0; i--) {
    const startIdx = arrayMatches[i].index ?? -1;
    if (startIdx >= 0) {
      const sub = text.slice(startIdx);
      const nextBreak = sub.search(/\n\s*(\n|#{1,6}\s+)/);
      const block = nextBreak !== -1 ? sub.slice(0, nextBreak) : sub;
      const hasColSpec = /^\\begin\{array\}\s*(?:\[[tbc]\])?\s*\{[^}]*\}/.test(block);
      const hasRows = block.includes('&') || block.includes('\\\\');
      if (hasColSpec || hasRows) {
        if (!sub.includes('\\end{array}')) {
          if (nextBreak !== -1) {
            text =
              text.slice(0, startIdx + nextBreak) +
              '\n\\end{array}' +
              text.slice(startIdx + nextBreak);
          } else {
            text = text + '\n\\end{array}';
          }
        }
      }
    }
  }

  // 5. Remove orphaned \end{array} without matching \begin{array}
  let openCount = (text.match(/\\begin\{array\}/g) || []).length;
  let closeCount = (text.match(/\\end\{array\}/g) || []).length;
  while (closeCount > openCount) {
    text = text.replace(/\\end\{array\}/, '');
    closeCount--;
  }

  // 6. Handle display math blocks wrapping an array table:
  // e.g. $$ \begin{array}{|c|c|} ... \end{array} $$ -> unwrap display math
  // so the resulting Markdown table is a top-level block, not an equation object.
  text = text.replace(
    /(?:\$\$|\\\[)\s*(\\begin\{array\}\s*(?:\[[tbc]\])?\s*\{[^}]*\}(?:(?!\\begin\{array\})[\s\S])*?\\end\{array\})\s*(?:\$\$|\\\])/g,
    (wholeMatch, arrayBlock) => {
      const colMatch = arrayBlock.match(/\\begin\{array\}\s*(?:\[[tbc]\])?\s*\{([^}]*)\}/);
      const colSpec = colMatch ? colMatch[1] : '';
      const bodyMatch = arrayBlock.match(
        /\\begin\{array\}\s*(?:\[[tbc]\])?\s*\{[^}]*\}((?:(?!\\begin\{array\})[\s\S])*?)\\end\{array\}/
      );
      const body = bodyMatch ? bodyMatch[1] : '';
      if (isTableArray(colSpec, body)) {
        return convertLatexArrayToWordTable(colSpec, body);
      }
      return wholeMatch;
    }
  );

  // 7. Process all remaining genuine \begin{array} occurrences
  text = text.replace(
    /\\begin\{array\}\s*(?:\[[tbc]\])?\s*\{([^}]*)\}((?:(?!\\begin\{array\})[\s\S])*?)\\end\{array\}/g,
    (_whole, colSpec, body) => {
      const cSpec = colSpec || '';
      const b = body || '';

      // If it is a tabular structure, convert to Word-compatible Markdown table
      if (isTableArray(cSpec, b)) {
        return convertLatexArrayToWordTable(cSpec, b);
      }

      // If it is a mathematical array/matrix, convert to \begin{matrix}
      // Clean up body lines and replace &=& with &=
      const cleanBody = b
        .replace(/&=&/g, '&=')
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .join('\n');

      return `\\begin{matrix}\n${cleanBody}\n\\end{matrix}`;
    }
  );

  // Safely wrap any remaining standalone/textual mentions of \begin{array} or \end{array} in backticks
  text = text.replace(/(?<!`)\\begin\{array\}(?!\{)/g, '`\\begin{array}`');
  text = text.replace(/(?<!`)\\end\{array\}/g, '`\\end{array}`');

  // 8. Isolate embedded LaTeX math environments from adjacent inline text
  // (Note: array has already been transformed to table or matrix above)
  const mathEnvs =
    'matrix\\*?|pmatrix\\*?|bmatrix\\*?|vmatrix\\*?|Vmatrix\\*?|Bmatrix\\*?|cases|align\\*?|equation\\*?|gather\\*?|multline\\*?';

  // Separate preceding inline text (ignoring backtick)
  text = text.replace(
    new RegExp(`([^\\n\\s\`])\\s*(\\\\begin\\{(?:${mathEnvs})\\})`, 'g'),
    '$1\n\n$2'
  );

  // Separate succeeding inline text (ignoring backtick)
  text = text.replace(
    new RegExp(`(\\\\end\\{(?:${mathEnvs})\\})\\s*([^\\n\\s\`])`, 'g'),
    '$1\n\n$2'
  );

  // 9. Clean and format LaTeX environments, ensuring non-table math environments
  // are wrapped in display math $$...$$ if not already wrapped
  const envBlockRegex = new RegExp(
    `(?<!\\$|\\\\\\[)\\s*\\\\begin\\{(${mathEnvs})\\}(?:\\{([^}]*)\\})?([\\s\\S]*?)\\\\end\\{\\1\\}\\s*(?!\\$|\\\\\\])`,
    'g'
  );

  text = text.replace(envBlockRegex, (_match, env, colSpec, body) => {
    const cleanLines = (body as string)
      .replace(/\\cr\b/g, '\\\\')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const cleanBody = cleanLines.join('\n');
    const cols = colSpec ? `{${colSpec}}` : '';
    const cleanEnv = `\\begin{${env}}${cols}\n${cleanBody}\n\\end{${env}}`;

    return `\n\n$$\n${cleanEnv}\n$$\n\n`;
  });

  // 10. Normalize excessive line breaks (> 2 newlines -> 2 newlines)
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}

/**
 * Adjusts line-by-line directionality (RTL / LTR) based on line content:
 * - Start of line: Places RLM (\u200F) before English words/acronyms in Persian lines.
 * - Middle of line: Enforces proper spacing and prevents BiDi parenthesis inversion.
 * - End of line: Anchors trailing punctuation (. ! ؟ :) to the end of the Persian line
 *   when preceded by an English word or number.
 */
export function fixLineDirectionality(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  // Skip code fences or display math lines
  if (
    trimmed.startsWith('```') ||
    trimmed.startsWith('$$') ||
    trimmed.startsWith('\\[') ||
    trimmed.startsWith('\\\\\[') ||
    trimmed.startsWith('\\begin{') ||
    trimmed.startsWith('\\\\begin{') ||
    trimmed.startsWith('___MATH_TOKEN_')
  ) {
    return line;
  }

  // Pure LTR line (no Persian characters)
  if (!isRtlLine(line)) {
    return line;
  }

  let result = line;

  // 1. START OF LINE:
  // If the line starts with an English word or acronym after markdown prefix (# , 1. , - , > )
  // e.g. "ODE یکی از شاخه‌های مهم است." or "# ODE در مهندسی" or "1. Python زبانی ساده است."
  const prefixMatch = result.match(
    /^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)\-]\s+|>\s*)?)([A-Za-z0-9][A-Za-z0-9._\-\(\)]*)/
  );

  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const firstWord = prefixMatch[2];
    const rest = result.slice(prefixMatch[0].length);

    // Never alter placeholder tokens
    if (firstWord.startsWith('___MATH_TOKEN_') || firstWord.includes('MATH_TOKEN')) {
      return line;
    }

    // If the rest of the line has Persian text and prefix doesn't already have RLM
    if (/[\u0600-\u06FF]/.test(rest) && !prefix.includes(RLM)) {
      result = prefix + RLM + firstWord + rest;
    }
  }

  // 2. END OF LINE:
  // When a Persian sentence ends with an English word, acronym, number, or parenthesized English term
  // followed by punctuation (e.g. "الگوریتم Euler." or "نسخه 3.14!" or "پروتکل HTTP:"),
  // insert RLM immediately after the punctuation so BiDi doesn't jump it to the start of the line.
  const endMatch = result.match(/([A-Za-z0-9\)]+\s*)([.:!؟؛,،]+)(\s*)$/);
  if (endMatch) {
    const mainPunct = endMatch[2];
    const trailingSpaces = endMatch[3];
    const beforePunct = result.slice(0, result.length - mainPunct.length - trailingSpaces.length);

    if (!trailingSpaces.includes(RLM) && !result.endsWith(RLM)) {
      result = beforePunct + mainPunct + RLM + trailingSpaces;
    }
  }

  // 3. MIDDLE OF LINE:
  // Parenthesized terms (ODE) inside Persian sentences:
  // Ensure exactly one space before ( and after ), and remove inner spaces
  result = result.replace(
    /([\u0600-\u06FF])\s*\(([A-Za-z0-9\s._\-+^/*=]+)\)\s*([\u0600-\u06FF])/g,
    (_m, p1, en, p2) => `${p1} (${(en as string).trim()}) ${p2}`
  );

  return result;
}

/**
 * Normalizes Persian typography, characters, and punctuation.
 */
export function normalizePersianTypography(text: string): string {
  let s = text;

  // 1. Normalize Arabic characters in Persian context to standard Persian
  s = s.replace(/\u064A/g, 'ی'); // Arabic Yeh -> Persian Yeh
  s = s.replace(/\u0643/g, 'ک'); // Arabic Kaf -> Persian Keheh

  // 2. Ensure word separation between Persian characters and English words/acronyms
  // e.g. "معادلاتODE" -> "معادلات ODE" or "روشEuler" -> "روش Euler"
  s = s.replace(/([\u0600-\u06FF])([A-Za-z])/g, '$1 $2');
  s = s.replace(/([A-Za-z])([\u0600-\u06FF])/g, '$1 $2');

  // 3. Standardize commas and question marks in Persian context
  s = s.replace(/([\u0600-\u06FF]),/g, '$1،');
  s = s.replace(/([\u0600-\u06FF])\?/g, '$1؟');

  // 4. Remove horizontal whitespace before punctuation: "سلام ." -> "سلام." (without eating newlines or tabs)
  s = s.replace(/ +([،:؛!؟\.\?\,])/g, '$1');

  // 5. Ensure single space after punctuation when followed by Persian/English letters on the same line
  s = s.replace(/([،؛!؟\.]) *([^\s\d،؛!؟\.\)\]\n\r"'])/g, '$1 $2');

  // 6. Fix colon on the same line: ensure colon is attached to word, with single space after
  s = s.replace(/([^\s\n\r]): *([^\s\n\r])/g, '$1: $2');

  // 7. Fix spacing around parentheses on the same line (preserving tab characters)
  s = s.replace(/([\u0600-\u06FFA-Za-z0-9]) *\(/g, '$1 (');
  s = s.replace(/\) *([\u0600-\u06FFA-Za-z0-9])/g, ') $1');
  s = s.replace(/\( +/g, '(');
  s = s.replace(/ +\)/g, ')');

  return s;
}

/**
 * Main entry point for pre-processing Persian text before Word generation.
 */
export function preprocessPersianText(input: string): string {
  if (!input || typeof input !== 'string') return input;

  // 1. Isolate and normalize all LaTeX math environments (\begin{array}, \begin{matrix}, etc.)
  let text = normalizeMathEnvironments(input);

  const mathTokens: string[] = [];

  // Helper to safely store math blocks during text transformations
  const storeMath = (formula: string): string => {
    let cleanFormula = formula;
    // Clean up empty lines inside LaTeX array or matrix environments
    if (/\\begin\{(array|matrix|pmatrix|bmatrix|vmatrix|cases|aligned|equation\*?)\}/s.test(cleanFormula)) {
      cleanFormula = cleanFormula
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n');
    }
    const idx = mathTokens.length;
    mathTokens.push(cleanFormula);
    return `___MATH_TOKEN_${idx}___`;
  };

  // 2. Extract Markdown tables so typography and directionality rules don't mutate column separators or pipes
  const tablePattern = /(?:^[ \t]*\|[^\n]+\|[ \t]*(?:\r?\n|$))+/gm;
  text = text.replace(tablePattern, (match) => `\n\n${storeMath(match.trim())}\n\n`);

  // 2b. Extract tab-delimited (TSV) tables
  const tsvPattern = /(?:^[^\n\r\t]+\t[^\n\r]*(?:\r?\n|$)){2,}/gm;
  text = text.replace(tsvPattern, (match) => `\n\n${storeMath(match.trim())}\n\n`);

  // 3. Extract fenced code blocks ```...```
  text = text.replace(/```[\s\S]*?```/g, (match) => storeMath(match));

  // 4. Extract display math: $$ ... $$, \[ ... \], and \\[ ... \\]
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => `\n\n${storeMath(match.trim())}\n\n`);
  text = text.replace(/\\\[[\s\S]*?\\\]/g, (match) => `\n\n${storeMath(match.trim())}\n\n`);
  text = text.replace(/\\\\\[[\s\S]*?\\\\\]/g, (match) => `\n\n${storeMath(match.trim())}\n\n`);

  // 5. Extract LaTeX environments: \begin{env} ... \end{env}
  const envPattern = /(?:\\\\|\\)begin\{([A-Za-z*]+)\}[\s\S]*?(?:\\\\|\\)end\{\1\}/g;
  text = text.replace(envPattern, (match) => `\n\n${storeMath(match.trim())}\n\n`);

  // 6. Extract inline math: $ ... $, \( ... \), and \\( ... \\)
  text = text.replace(/\\\([\s\S]*?\\\)/g, (match) => storeMath(match));
  text = text.replace(/\\\\\([\s\S]*?\\\\\\\)/g, (match) => storeMath(match));
  text = text.replace(/(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g, (match) => storeMath(match));

  // 7. Normalize Persian typography, Arabic character variants, and punctuation
  text = normalizePersianTypography(text);

  // 8. Adjust line-by-line directionality (RTL / LTR)
  const lines = text.split('\n');
  const processedLines = lines.map((line) => fixLineDirectionality(line));
  text = processedLines.join('\n');

  // 9. Restore all protected math, code, and table tokens iteratively so that nested tokens resolve completely
  let hasPlaceholders = true;
  let iterations = 0;
  while (hasPlaceholders && iterations < 15) {
    hasPlaceholders = false;
    iterations++;
    for (let i = 0; i < mathTokens.length; i++) {
      const placeholder = `___MATH_TOKEN_${i}___`;
      if (text.includes(placeholder)) {
        text = text.split(placeholder).join(mathTokens[i]);
        hasPlaceholders = true;
      }
    }
  }

  // 10. Clean up extra blank lines created around math blocks
  text = text.replace(/\n{3,}/g, '\n\n');

  return text;
}

