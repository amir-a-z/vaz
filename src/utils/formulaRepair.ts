import katex from 'katex';
import { cleanFormulaDelimiters } from './mathConverter';

export interface FormulaRepairResult {
  original: string;
  fixed: string;
  changes: string[];
  isValid: boolean;
  katexError?: string;
  isAiRepaired?: boolean;
}

export interface DocumentFormulaIssue {
  id: string;
  startIndex: number;
  endIndex: number;
  rawMatch: string; // The exact text substring in the document, including $ or $$
  formulaOnly: string;
  isDisplay: boolean;
  line: number;
  fixedFormula: string;
  fixedMatch: string; // The replacement text including $ or $$
  changes: string[];
  isValid: boolean;
  originalError?: string;
}

// Common LaTeX Math Typos and their corrections
export const COMMON_TYPOS: Record<string, string> = {
  fac: 'frac',
  farc: 'frac',
  fra: 'frac',
  frca: 'frac',
  sqr: 'sqrt',
  squrt: 'sqrt',
  sqroot: 'sqrt',
  root: 'sqrt',
  lamda: 'lambda',
  lembda: 'lambda',
  aplha: 'alpha',
  alfa: 'alpha',
  beeta: 'beta',
  bate: 'beta',
  inft: 'infty',
  infinty: 'infty',
  inifinty: 'infty',
  sigm: 'sigma',
  theata: 'theta',
  teta: 'theta',
  partiall: 'partial',
  partail: 'partial',
  timse: 'times',
  tims: 'times',
  cdott: 'cdot',
  integ: 'int',
  integr: 'int',
  sume: 'sum',
  limt: 'lim',
  righarrow: 'rightarrow',
  rigtharrow: 'rightarrow',
  arrow: 'rightarrow',
  vareps: 'varepsilon',
  eps: 'epsilon',
  delt: 'delta',
  gama: 'gamma',
  omegaa: 'omega',
  omga: 'omega',
  nabl: 'nabla',
  prodd: 'prod',
  approxeq: 'approx',
  neqq: 'neq',
};

// Comprehensive list of standard valid LaTeX math commands
export const VALID_MATH_COMMANDS = [
  'frac', 'sqrt', 'sum', 'prod', 'coprod', 'int', 'iint', 'iiint', 'oint', 'lim', 'infty',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh',
  'arcsin', 'arccos', 'arctan', 'log', 'ln', 'exp', 'det', 'max', 'min',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
  'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
  'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon', 'phi',
  'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda',
  'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega', 'partial', 'nabla', 'hbar', 'ell',
  'to', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow', 'leftrightarrow', 'Leftrightarrow',
  'mapsto', 'iff', 'implies', 'cdot', 'times', 'pm', 'mp', 'div', 'ast', 'star', 'circ', 'bullet',
  'leq', 'geq', 'le', 'ge', 'neq', 'approx', 'equiv', 'sim', 'simeq', 'propto', 'cong',
  'subset', 'supset', 'subseteq', 'supseteq', 'in', 'notin', 'ni', 'forall',
  'exists', 'cup', 'cap', 'setminus', 'emptyset', 'left', 'right', 'text',
  'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathbb', 'bm', 'boldsymbol', 'hat', 'bar',
  'vec', 'tilde', 'dot', 'ddot', 'overline', 'underline', 'quad', 'qquad',
  'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'array',
  'aligned', 'align', 'gather', 'multline', 'perp', 'parallel', 'prime', 'aleph', 'Re', 'Im',
  'cdots', 'ldots', 'vdots', 'ddots', 'dots', 'langle', 'rangle', 'vert', 'Vert', 'lbrace', 'rbrace',
  'mid', 'pmod', 'bmod', 'operatorname', 'overbrace', 'underbrace', 'cr', 'not'
];

/**
 * Calculates the Levenshtein distance between two strings.
 */
export function levenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Finds the closest valid LaTeX math command for an unknown or misspelled command.
 */
export function getClosestCommand(cmd: string): string | null {
  const lower = cmd.toLowerCase();
  if (COMMON_TYPOS[lower]) {
    return COMMON_TYPOS[lower];
  }
  // If KaTeX already natively supports this command, never replace it
  try {
    katex.renderToString(`\\${cmd}`, { throwOnError: true, strict: 'ignore' });
    return cmd;
  } catch {}

  let best = '';
  let bestDist = Infinity;
  for (const valid of VALID_MATH_COMMANDS) {
    const d = levenshtein(lower, valid.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = valid;
    }
  }
  // Allow maximum difference proportional to command length
  const maxD = cmd.length <= 3 ? 1 : cmd.length <= 6 ? 2 : 3;
  if (bestDist <= maxD) {
    return best;
  }
  return null;
}

/**
 * Repairs a single LaTeX formula string by converting it to the closest valid math representation.
 */
export function repairFormula(rawFormula: string): FormulaRepairResult {
  let s = (rawFormula || '').trim();
  const original = s;
  const changes: string[] = [];

  // Strip accidental outer $ or $$ or \( \) or \[ \]
  if (s.startsWith('$$') && s.endsWith('$$') && s.length >= 4) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('$') && s.endsWith('$') && s.length >= 2) {
    s = s.slice(1, -1).trim();
  } else if (s.startsWith('\\[') && s.endsWith('\\]') && s.length >= 4) {
    s = s.slice(2, -2).trim();
  } else if (s.startsWith('\\(') && s.endsWith('\\)') && s.length >= 4) {
    s = s.slice(2, -2).trim();
  }
  while (s.startsWith('$')) s = s.slice(1).trim();
  while (s.endsWith('$')) s = s.slice(0, -1).trim();

  // If already completely valid in KaTeX, never corrupt or mutate it!
  try {
    katex.renderToString(s, { throwOnError: true, strict: 'ignore' });
    return {
      original,
      fixed: s,
      changes: ['فرمول بررسی شد و کاملاً استاندارد و معتبر است'],
      isValid: true,
    };
  } catch {}

  // 1. Convert Persian/Arabic digits to standard ASCII digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let hasPersianDigits = false;
  for (let i = 0; i < 10; i++) {
    if (s.includes(persianDigits[i])) {
      s = s.split(persianDigits[i]).join(String(i));
      hasPersianDigits = true;
    }
  }
  if (hasPersianDigits) {
    changes.push('تبدیل ارقام فارسی به ارقام استاندارد لاتک');
  }

  // Convert Persian decimal and math operators
  if (s.includes('×')) {
    s = s.replace(/×/g, ' \\times ');
    changes.push('تبدیل علامت ضرب × به \\times');
  }
  if (s.includes('÷')) {
    s = s.replace(/÷/g, ' \\div ');
    changes.push('تبدیل علامت تقسیم ÷ به \\div');
  }
  if (s.includes('±')) {
    s = s.replace(/±/g, ' \\pm ');
    changes.push('تبدیل علامت ± به \\pm');
  }
  if (s.includes('٫')) {
    s = s.replace(/٫/g, '.');
    changes.push('تبدیل ممیز فارسی به نقطه اعشار');
  }

  // 2. Power and computational expressions: Python / MATLAB `**` -> `^`
  if (s.includes('**')) {
    s = s.replace(/\*\*([0-9a-zA-Z_]+|\([^)]+\)|\{[^}]+\})/g, '^{$1}');
    changes.push('اصلاح عملگر توان برنامه‌نویسی (**) به توان لاتکس (^)');
  }

  // Multiplications like 4 * x or a * b
  if (s.includes('*') && !s.includes('\\*')) {
    s = s.replace(/([0-9a-zA-Z])\s*\*\s*([0-9a-zA-Z])/g, '$1 \\cdot $2');
    changes.push('تبدیل عملگر ضرب (*) به \\cdot');
  }

  // 3. Multi-digit superscripts/subscripts without braces: x^12 -> x^{12}, a_ij -> a_{ij}
  const supSubRegex = /([a-zA-Z0-9)\]}])([\^_])([a-zA-Z0-9]{2,})\b/g;
  if (supSubRegex.test(s)) {
    s = s.replace(supSubRegex, '$1$2{$3}');
    changes.push('افزودن آکولاد به توان یا اندیس‌های چندحرفی');
  }

  // 4. Missing backslashes before common functions/symbols
  const missingSlashList = [
    'frac', 'sqrt', 'alpha', 'beta', 'gamma', 'delta', 'lambda', 'mu', 'pi', 'theta',
    'sigma', 'omega', 'infty', 'sum', 'prod', 'int', 'sin', 'cos', 'tan', 'log', 'ln', 'lim'
  ];
  for (const cmd of missingSlashList) {
    const reg = new RegExp(`(?<!\\\\)\\b${cmd}\\b(?=[^a-zA-Z]|$)`, 'g');
    if (reg.test(s)) {
      s = s.replace(reg, `\\${cmd}`);
      changes.push(`افزودن بک‌اسلش مفقود به دستور ${cmd}`);
    }
  }

  // 5. Convert sqrt(...) to \sqrt{...}
  if (/\\?sqrt\s*\(/.test(s)) {
    s = s.replace(/\\?sqrt\s*\(([^()]+)\)/g, '\\sqrt{$1}');
    changes.push('تبدیل ساختار پرانتزی sqrt(...) به \\sqrt{...}');
  }

  // 6. Fix typos in LaTeX commands: \command
  s = s.replace(/\\([a-zA-Z]+)/g, (fullMatch, cmd) => {
    if (VALID_MATH_COMMANDS.includes(cmd)) return fullMatch;
    const closest = getClosestCommand(cmd);
    if (closest && closest !== cmd) {
      changes.push(`اصلاح دستور تایپی «\\${cmd}» به «\\${closest}»`);
      return `\\${closest}`;
    }
    return fullMatch;
  });

  // 7. Fix broken spacing like \ frac -> \frac
  s = s.replace(/\\\s+([a-zA-Z]+)/g, (_match, cmd) => {
    changes.push(`حذف فاصله اضافی بین بک‌اسلش و دستور \\${cmd}`);
    return `\\${cmd}`;
  });

  // 8. Balance environments (\begin{...} without \end{...})
  const envs = [
    'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'array', 'aligned', 'align'
  ];
  for (const env of envs) {
    const bMatches = (s.match(new RegExp(`\\\\begin\\{${env}\\*?\\}`, 'g')) || []).length;
    const eMatches = (s.match(new RegExp(`\\\\end\\{${env}\\*?\\}`, 'g')) || []).length;
    if (bMatches > eMatches) {
      for (let i = 0; i < (bMatches - eMatches); i++) {
        s += `\n\\end{${env}}`;
      }
      changes.push(`بستن خودکار محیط ریاضی \\end{${env}}`);
    }
  }

  // 9. Balance braces {}
  let openB = 0;
  for (const ch of s) {
    if (ch === '{') openB++;
    else if (ch === '}') openB = Math.max(0, openB - 1);
  }
  if (openB > 0) {
    s += '}'.repeat(openB);
    changes.push(`افزودن ${openB} آکولاد بسته (}) مفقود`);
  }

  // 10. Balance \left and \right
  const leftCount = (s.match(/\\left\b/g) || []).length;
  const rightCount = (s.match(/\\right\b/g) || []).length;
  if (leftCount > rightCount) {
    for (let i = 0; i < (leftCount - rightCount); i++) {
      if (s.includes('\\left(') && !s.includes('\\right)')) {
        s += ' \\right)';
      } else if (s.includes('\\left[') && !s.includes('\\right]')) {
        s += ' \\right]';
      } else if (s.includes('\\left\\{') && !s.includes('\\right\\}')) {
        s += ' \\right\\}';
      } else {
        s += ' \\right.';
      }
    }
    changes.push('بستن ساختار \\left مفقود با علامت متناظر');
  }

  // 11. Balance parentheses ()
  let openP = 0;
  for (const ch of s) {
    if (ch === '(') openP++;
    else if (ch === ')') openP = Math.max(0, openP - 1);
  }
  if (openP > 0) {
    s += ')'.repeat(openP);
    changes.push(`افزودن ${openP} پرانتز بسته ()) مفقود`);
  }

  // 12. Balance brackets []
  let openBrack = 0;
  for (const ch of s) {
    if (ch === '[') openBrack++;
    else if (ch === ']') openBrack = Math.max(0, openBrack - 1);
  }
  if (openBrack > 0) {
    s += ']'.repeat(openBrack);
    changes.push(`افزودن ${openBrack} کروشه بسته (]) مفقود`);
  }

  // Validate with KaTeX
  let isValid = false;
  let katexError: string | undefined;
  try {
    katex.renderToString(s, { throwOnError: true, strict: 'ignore' });
    isValid = true;
  } catch (err: any) {
    katexError = err.message || 'خطای گرامر LaTeX';
  }

  return {
    original,
    fixed: s,
    changes: changes.length > 0 ? changes : ['فرمول بررسی شد و مشکلی یافت نشد'],
    isValid,
    katexError,
  };
}

/**
 * Scans an entire document for broken, unreadable, or malformed formulas.
 */
export function analyzeDocumentFormulas(documentText: string): DocumentFormulaIssue[] {
  const issues: DocumentFormulaIssue[] = [];
  if (!documentText || !documentText.trim()) return issues;

  const lines = documentText.split('\n');

  // Match $$...$$ display math
  const displayRegex = /\$\$([\s\S]+?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = displayRegex.exec(documentText)) !== null) {
    const rawMatch = match[0];
    const formulaOnly = match[1].trim();
    const repair = repairFormula(formulaOnly);

    // Calculate line number
    const upToMatch = documentText.slice(0, match.index);
    const line = upToMatch.split('\n').length;

    // Check if original had KaTeX error or if repair changed anything
    let hadOriginalError = false;
    let origErr: string | undefined;
    try {
      katex.renderToString(formulaOnly, { throwOnError: true, displayMode: true, strict: 'ignore' });
    } catch (err: any) {
      hadOriginalError = true;
      origErr = err.message;
    }

    if (hadOriginalError || repair.fixed !== formulaOnly) {
      issues.push({
        id: `disp-${match.index}`,
        startIndex: match.index,
        endIndex: match.index + rawMatch.length,
        rawMatch,
        formulaOnly,
        isDisplay: true,
        line,
        fixedFormula: repair.fixed,
        fixedMatch: `$$\n${repair.fixed}\n$$`,
        changes: repair.changes,
        isValid: repair.isValid,
        originalError: origErr,
      });
    }
  }

  // Match \[ ... \] and \\[ ... \\] display math
  const bracketDisplayRegex = /(?:\\\\|\\)\[([\s\S]+?)(?:\\\\|\\)\]/g;
  while ((match = bracketDisplayRegex.exec(documentText)) !== null) {
    const rawMatch = match[0];
    const formulaOnly = match[1].trim();
    const repair = repairFormula(formulaOnly);

    const upToMatch = documentText.slice(0, match.index);
    const line = upToMatch.split('\n').length;

    let hadOriginalError = false;
    let origErr: string | undefined;
    try {
      katex.renderToString(formulaOnly, { throwOnError: true, displayMode: true, strict: 'ignore' });
    } catch (err: any) {
      hadOriginalError = true;
      origErr = err.message;
    }

    if (hadOriginalError || repair.fixed !== formulaOnly) {
      issues.push({
        id: `bracket-disp-${match.index}`,
        startIndex: match.index,
        endIndex: match.index + rawMatch.length,
        rawMatch,
        formulaOnly,
        isDisplay: true,
        line,
        fixedFormula: repair.fixed,
        fixedMatch: `$$\n${repair.fixed}\n$$`,
        changes: repair.changes,
        isValid: repair.isValid,
        originalError: origErr,
      });
    }
  }

  // Match \( ... \) and \\( ... \\) inline math
  const parenInlineRegex = /(?:\\\\|\\)\(([\s\S]+?)(?:\\\\|\\)\)/g;
  while ((match = parenInlineRegex.exec(documentText)) !== null) {
    const rawMatch = match[0];
    const formulaOnly = match[1].trim();
    const repair = repairFormula(formulaOnly);

    const upToMatch = documentText.slice(0, match.index);
    const line = upToMatch.split('\n').length;

    let hadOriginalError = false;
    let origErr: string | undefined;
    try {
      katex.renderToString(formulaOnly, { throwOnError: true, displayMode: false, strict: 'ignore' });
    } catch (err: any) {
      hadOriginalError = true;
      origErr = err.message;
    }

    if (hadOriginalError || repair.fixed !== formulaOnly) {
      issues.push({
        id: `paren-inline-${match.index}`,
        startIndex: match.index,
        endIndex: match.index + rawMatch.length,
        rawMatch,
        formulaOnly,
        isDisplay: false,
        line,
        fixedFormula: repair.fixed,
        fixedMatch: `$${repair.fixed}$`,
        changes: repair.changes,
        isValid: repair.isValid,
        originalError: origErr,
      });
    }
  }

  // Match $...$ inline math (avoiding $$)
  const inlineRegex = /(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g;
  while ((match = inlineRegex.exec(documentText)) !== null) {
    const rawMatch = match[0];
    const formulaOnly = match[1].trim();
    const repair = repairFormula(formulaOnly);

    const upToMatch = documentText.slice(0, match.index);
    const line = upToMatch.split('\n').length;

    let hadOriginalError = false;
    let origErr: string | undefined;
    try {
      katex.renderToString(formulaOnly, { throwOnError: true, displayMode: false, strict: 'ignore' });
    } catch (err: any) {
      hadOriginalError = true;
      origErr = err.message;
    }

    if (hadOriginalError || repair.fixed !== formulaOnly) {
      issues.push({
        id: `inline-${match.index}`,
        startIndex: match.index,
        endIndex: match.index + rawMatch.length,
        rawMatch,
        formulaOnly,
        isDisplay: false,
        line,
        fixedFormula: repair.fixed,
        fixedMatch: `$${repair.fixed}$`,
        changes: repair.changes,
        isValid: repair.isValid,
        originalError: origErr,
      });
    }
  }

  return issues;
}

/**
 * Automatically repairs all or selected broken formulas across the entire document text in one click.
 * Iterates through detected issues in reverse index order to avoid position shifts.
 */
export function repairEntireDocument(
  documentText: string,
  targetIssueIds?: string[]
): {
  repairedText: string;
  repairedCount: number;
  changesSummary: string[];
} {
  const issues = analyzeDocumentFormulas(documentText);
  const issuesToFix = targetIssueIds
    ? issues.filter((i) => targetIssueIds.includes(i.id))
    : issues;

  if (issuesToFix.length === 0) {
    return {
      repairedText: documentText,
      repairedCount: 0,
      changesSummary: [],
    };
  }

  // Sort by starting index descending so that string replacements at later positions
  // do not alter indices of earlier matches
  const sortedIssues = [...issuesToFix].sort((a, b) => b.startIndex - a.startIndex);

  let text = documentText;
  let repairedCount = 0;
  const changesSummary: string[] = [];

  for (const issue of sortedIssues) {
    // Check if substring at exact startIndex still matches rawMatch
    if (text.slice(issue.startIndex, issue.endIndex) === issue.rawMatch) {
      text = text.slice(0, issue.startIndex) + issue.fixedMatch + text.slice(issue.endIndex);
      repairedCount++;
      changesSummary.push(`سطر ${issue.line}: ${issue.changes.join('، ')}`);
    } else if (text.includes(issue.rawMatch)) {
      text = text.replace(issue.rawMatch, () => issue.fixedMatch);
      repairedCount++;
      changesSummary.push(`سطر ${issue.line}: ${issue.changes.join('، ')}`);
    }
  }

  return {
    repairedText: text,
    repairedCount,
    changesSummary,
  };
}
