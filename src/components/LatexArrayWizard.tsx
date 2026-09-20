import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid,
  Settings2,
  Copy,
  Check,
  PlusCircle,
  Sparkles,
  RefreshCw,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { LatexArrayEnvironment, ColumnAlignment } from '../types';
import { renderKatexSafe } from '../utils/mathConverter';

interface LatexArrayWizardProps {
  onInsertToDoc: (snippet: string) => void;
}

interface ArrayPreset {
  name: string;
  env: LatexArrayEnvironment;
  rows: number;
  cols: number;
  alignments: ColumnAlignment[];
  hasVBorder: boolean;
  hasHBorder: boolean;
  fillData: (r: number, c: number) => string;
}

const PRESET_PATTERNS: ArrayPreset[] = [
  {
    name: 'ماتریس همانی ۳×۳',
    env: 'pmatrix',
    rows: 3,
    cols: 3,
    alignments: ['center', 'center', 'center'],
    hasVBorder: false,
    hasHBorder: false,
    fillData: (r, c) => (r === c ? '1' : '0'),
  },
  {
    name: 'ماتریس دوران ۲×۲',
    env: 'pmatrix',
    rows: 2,
    cols: 2,
    alignments: ['center', 'center'],
    hasVBorder: false,
    hasHBorder: false,
    fillData: (r, c) => {
      if (r === 0 && c === 0) return '\\cos\\theta';
      if (r === 0 && c === 1) return '-\\sin\\theta';
      if (r === 1 && c === 0) return '\\sin\\theta';
      return '\\cos\\theta';
    },
  },
  {
    name: 'جدول محاسباتی با خطوط',
    env: 'array',
    rows: 3,
    cols: 3,
    alignments: ['center', 'center', 'center'],
    hasVBorder: true,
    hasHBorder: true,
    fillData: (r, c) => {
      if (r === 0) return `\\text{ستون ${c + 1}}`;
      return `x_{${r}${c + 1}}`;
    },
  },
  {
    name: 'ماتریس ضرایب کلی (a_ij)',
    env: 'bmatrix',
    rows: 3,
    cols: 3,
    alignments: ['center', 'center', 'center'],
    hasVBorder: false,
    hasHBorder: false,
    fillData: (r, c) => `a_{${r + 1}${c + 1}}`,
  },
  {
    name: 'ماتریس الحاقی دستگاه خطی',
    env: 'array',
    rows: 3,
    cols: 4,
    alignments: ['center', 'center', 'center', 'center'],
    hasVBorder: true,
    hasHBorder: false,
    fillData: (r, c) => (c === 3 ? `b_{${r + 1}}` : `a_{${r + 1}${c + 1}}`),
  },
  {
    name: 'تابع چندضابطه‌ای (cases)',
    env: 'cases',
    rows: 2,
    cols: 2,
    alignments: ['left', 'left'],
    hasVBorder: false,
    hasHBorder: false,
    fillData: (r, c) => {
      if (r === 0 && c === 0) return '2x + 1';
      if (r === 0 && c === 1) return 'x \\ge 0';
      if (r === 1 && c === 0) return '-x^2';
      return 'x < 0';
    },
  },
];

const ENVIRONMENT_OPTIONS: { id: LatexArrayEnvironment; label: string; desc: string }[] = [
  { id: 'array', label: 'آرایه ریاضی (array)', desc: 'کنترل کامل تراز هر ستون و خطوط جدول' },
  { id: 'pmatrix', label: 'ماتریس پرانتزی (pmatrix)', desc: 'ماتریس ریاضی با پرانتز گرد (...) ' },
  { id: 'bmatrix', label: 'ماتریس کروشه‌ای (bmatrix)', desc: 'ماتریس رسمی استاندارد با [...] ' },
  { id: 'matrix', label: 'ماتریس ساده (matrix)', desc: 'شبکه مقادیر ریاضی بدون کمان خارجی' },
  { id: 'vmatrix', label: 'دترمینان (vmatrix)', desc: 'دترمینان یا قدرمطلق ماتریسی با خطوط عمودی |...|' },
  { id: 'cases', label: 'چندضابطه‌ای (cases)', desc: 'توابع چندضابطه‌ای و شروط معادله با آکولاد بزرگ' },
  { id: 'tabular', label: 'جدول متنی (tabular)', desc: 'محیط رسمی جدول در لاتک استاندارد' },
];

export const LatexArrayWizard: React.FC<LatexArrayWizardProps> = ({ onInsertToDoc }) => {
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);
  const [environment, setEnvironment] = useState<LatexArrayEnvironment>('pmatrix');
  const [alignments, setAlignments] = useState<ColumnAlignment[]>(['center', 'center', 'center']);
  const [hasVBorder, setHasVBorder] = useState<boolean>(false);
  const [hasHBorder, setHasHBorder] = useState<boolean>(false);
  const [displayMode, setDisplayMode] = useState<boolean>(true);
  const [data, setData] = useState<string[][]>(() => {
    return Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => (r === c ? '1' : '0'))
    );
  });
  const [activeCell, setActiveCell] = useState<{ r: number; c: number } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [inserted, setInserted] = useState<boolean>(false);

  // Synchronize 2D data matrix when rows or cols change
  const handleDimensionChange = (newRows: number, newCols: number) => {
    const clampedRows = Math.max(1, Math.min(10, newRows));
    const clampedCols = Math.max(1, Math.min(10, newCols));

    setRows(clampedRows);
    setCols(clampedCols);

    setAlignments((prev) => {
      const next = [...prev];
      while (next.length < clampedCols) {
        next.push('center');
      }
      return next.slice(0, clampedCols);
    });

    setData((prev) => {
      const nextData: string[][] = [];
      for (let r = 0; r < clampedRows; r++) {
        const row: string[] = [];
        for (let c = 0; c < clampedCols; c++) {
          if (prev[r] && prev[r][c] !== undefined) {
            row.push(prev[r][c]);
          } else {
            // Smart default fill
            row.push(r === c && clampedRows === clampedCols ? '1' : '0');
          }
        }
        nextData.push(row);
      }
      return nextData;
    });
  };

  const handleCellChange = (r: number, c: number, value: string) => {
    setData((prev) => {
      const next = prev.map((rowArr, rowIdx) => {
        if (rowIdx !== r) return rowArr;
        const newRow = [...rowArr];
        newRow[c] = value;
        return newRow;
      });
      return next;
    });
  };

  const handleColumnAlignmentToggle = (colIndex: number) => {
    setAlignments((prev) => {
      const current = prev[colIndex] || 'center';
      const order: ColumnAlignment[] = ['center', 'left', 'right'];
      const nextIdx = (order.indexOf(current) + 1) % order.length;
      const next = [...prev];
      next[colIndex] = order[nextIdx];
      return next;
    });
  };

  const applyPreset = (preset: ArrayPreset) => {
    setEnvironment(preset.env);
    setRows(preset.rows);
    setCols(preset.cols);
    setAlignments([...preset.alignments]);
    setHasVBorder(preset.hasVBorder);
    setHasHBorder(preset.hasHBorder);

    const generated: string[][] = [];
    for (let r = 0; r < preset.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < preset.cols; c++) {
        row.push(preset.fillData(r, c));
      }
      generated.push(row);
    }
    setData(generated);
  };

  const handleQuickInsertSymbol = (symbol: string) => {
    if (!activeCell) {
      // Append to first cell
      handleCellChange(0, 0, (data[0]?.[0] || '') + symbol);
      return;
    }
    const currentVal = data[activeCell.r]?.[activeCell.c] || '';
    handleCellChange(activeCell.r, activeCell.c, currentVal + symbol);
  };

  // Generate valid LaTeX syntax with proper column specs and OMML compatibility
  const generatedLatex = useMemo(() => {
    const alignChars = alignments.map((a) => (a === 'left' ? 'l' : a === 'right' ? 'r' : 'c'));
    const colSpec = hasVBorder
      ? '|' + alignChars.join('|') + '|'
      : alignChars.join('');

    let code = '';
    const isArrayLike = environment === 'array' || environment === 'tabular';

    if (isArrayLike) {
      code += `\\begin{${environment}}{${colSpec}}\n`;
    } else {
      code += `\\begin{${environment}}\n`;
    }

    if (isArrayLike && hasHBorder) {
      code += '  \\hline\n';
    }

    const rowStrings = data.map((row) => {
      const formattedCells = row.map((cell) => cell.trim() || '0');
      return '  ' + formattedCells.join(' & ');
    });

    for (let i = 0; i < rowStrings.length; i++) {
      const isLastRow = i === rowStrings.length - 1;
      code += rowStrings[i];
      if (!isLastRow) {
        code += ' \\\\';
        if (isArrayLike && hasHBorder) {
          code += ' \\hline';
        }
        code += '\n';
      } else {
        if (isArrayLike && hasHBorder) {
          code += ' \\\\\n  \\hline\n';
        } else {
          code += '\n';
        }
      }
    }

    code += `\\end{${environment}}`;
    return code;
  }, [environment, alignments, hasVBorder, hasHBorder, data]);

  const wrappedSnippet = useMemo(() => {
    if (environment === 'tabular') {
      return generatedLatex;
    }
    return displayMode ? `$$\n${generatedLatex}\n$$` : `$${generatedLatex}$`;
  }, [environment, displayMode, generatedLatex]);

  const renderedKatex = useMemo(() => {
    // KaTeX renders array, pmatrix, bmatrix, vmatrix, cases natively
    // If tabular, KaTeX requires array so we preview as array
    const previewLatex = environment === 'tabular'
      ? generatedLatex.replace(/\\begin\{tabular\}/g, '\\begin{array}').replace(/\\end\{tabular\}/g, '\\end{array}')
      : generatedLatex;
    return renderKatexSafe(previewLatex, displayMode);
  }, [generatedLatex, environment, displayMode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wrappedSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsertToDoc(wrappedSnippet);
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  return (
    <div className="space-y-4 pt-1" dir="rtl">
      {/* Quick Pattern Presets */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className="text-slate-400 flex items-center gap-1 text-[11px] font-medium">
          <BookOpen className="w-3 h-3 text-cyan-400" />
          <span>الگوهای آماده:</span>
        </span>
        {PRESET_PATTERNS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => applyPreset(p)}
            className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Control Panel: Dimensions, Environment, and Borders */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Dimension Controls */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Grid className="w-3 h-3 text-cyan-400" />
              <span>ابعاد سطر و ستون (Rows × Cols):</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleDimensionChange(rows - 1, cols)}
                  className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono"
                  title="کاهش سطر"
                >
                  -
                </button>
                <span className="px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 min-w-[2.5rem] text-center">
                  {rows} سطر
                </span>
                <button
                  type="button"
                  onClick={() => handleDimensionChange(rows + 1, cols)}
                  className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono"
                  title="افزایش سطر"
                >
                  +
                </button>
              </div>

              <span className="text-slate-600 font-mono">×</span>

              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleDimensionChange(rows, cols - 1)}
                  className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono"
                  title="کاهش ستون"
                >
                  -
                </button>
                <span className="px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 min-w-[2.5rem] text-center">
                  {cols} ستون
                </span>
                <button
                  type="button"
                  onClick={() => handleDimensionChange(rows, cols + 1)}
                  className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono"
                  title="افزایش ستون"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Environment Selector */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Settings2 className="w-3 h-3 text-cyan-400" />
              <span>نوع ساختار لاتک / OMML:</span>
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as LatexArrayEnvironment)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-500 font-sans"
            >
              {ENVIRONMENT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Borders & Styling Toggles */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span>تنظیمات خطوط جدول (Borders):</span>
            </label>
            <div className="flex items-center gap-3 pt-0.5">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasVBorder}
                  onChange={(e) => setHasVBorder(e.target.checked)}
                  disabled={environment !== 'array' && environment !== 'tabular'}
                  className="rounded text-cyan-600 focus:ring-cyan-500 bg-slate-900 border-slate-700 disabled:opacity-40"
                />
                <span className={environment !== 'array' && environment !== 'tabular' ? 'text-slate-600' : ''}>
                  خطوط عمودی (|)
                </span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasHBorder}
                  onChange={(e) => setHasHBorder(e.target.checked)}
                  disabled={environment !== 'array' && environment !== 'tabular'}
                  className="rounded text-cyan-600 focus:ring-cyan-500 bg-slate-900 border-slate-700 disabled:opacity-40"
                />
                <span className={environment !== 'array' && environment !== 'tabular' ? 'text-slate-600' : ''}>
                  خطوط افقی (\hline)
                </span>
              </label>
            </div>
          </div>

          {/* Math Wrapper Mode */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>قالب بسته‌بندی ریاضی:</span>
            </label>
            <div className="flex items-center gap-2 pt-0.5">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="latexArrayMode"
                  checked={displayMode}
                  onChange={() => setDisplayMode(true)}
                  className="text-cyan-600 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                />
                <span>بلوکی ($$...$$)</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="latexArrayMode"
                  checked={!displayMode}
                  onChange={() => setDisplayMode(false)}
                  className="text-cyan-600 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                />
                <span>درون‌خطی ($...$)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Column Alignment Indicators (for array & tabular) */}
        {(environment === 'array' || environment === 'tabular') && (
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-[11px] text-slate-400">تراز ستون‌ها (روی هر ستون کلیک کنید):</span>
            {alignments.map((align, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleColumnAlignmentToggle(idx)}
                className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-[11px] font-mono transition"
                title="کلیک برای تغییر: وسط، چپ، راست"
              >
                <span>ستون {idx + 1}:</span>
                {align === 'center' && <AlignCenter className="w-3 h-3 text-cyan-400" />}
                {align === 'left' && <AlignLeft className="w-3 h-3 text-blue-400" />}
                {align === 'right' && <AlignRight className="w-3 h-3 text-amber-400" />}
                <span className="text-[10px] text-slate-400">
                  ({align === 'center' ? 'وسط c' : align === 'left' ? 'چپ l' : 'راست r'})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Matrix / Grid Cell Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-medium">
            <Grid className="w-3.5 h-3.5 text-cyan-400" />
            <span>ویرایشگر تعاملی سلول‌ها ({rows} سطر در {cols} ستون):</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500">درج سریع در سلول فعال:</span>
            {['\\theta', '\\alpha', '\\lambda', '\\frac{1}{2}', '\\sqrt{2}', '0', '1', '-1'].map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => handleQuickInsertSymbol(sym)}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-mono border border-slate-700/80 transition"
              >
                {sym}
              </button>
            ))}
          </div>
        </div>

        {/* The Grid Table */}
        <div className="overflow-x-auto bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div
            className="grid gap-2 min-w-max"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(85px, 1fr))`,
            }}
          >
            {data.map((rowArr, rIdx) =>
              rowArr.map((cellVal, cIdx) => {
                const isActive = activeCell?.r === rIdx && activeCell?.c === cIdx;
                return (
                  <div key={`${rIdx}-${cIdx}`} className="relative">
                    <input
                      type="text"
                      dir="ltr"
                      value={cellVal}
                      onFocus={() => setActiveCell({ r: rIdx, c: cIdx })}
                      onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                      placeholder={`a_{${rIdx + 1}${cIdx + 1}}`}
                      className={`w-full bg-slate-900 text-slate-100 text-xs font-mono text-center px-2 py-1.5 rounded-lg border outline-none transition shadow-inner ${
                        isActive
                          ? 'border-cyan-500 ring-1 ring-cyan-500 bg-slate-850 text-white'
                          : 'border-slate-800 hover:border-slate-700 focus:border-cyan-600'
                      }`}
                    />
                    <span className="absolute -bottom-3 left-1 text-[9px] text-slate-600 font-mono pointer-events-none select-none">
                      {rIdx + 1},{cIdx + 1}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Dual Panel: Generated LaTeX Code & Live KaTeX / OMML Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
        {/* Generated LaTeX Code Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>کد تولید شده لاتک (LaTeX Array/Tabular Syntax):</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'کپی شد' : 'کپی لاتک'}</span>
              </button>
              <button
                type="button"
                onClick={handleInsert}
                className="flex items-center gap-1 text-[11px] text-white bg-cyan-600 hover:bg-cyan-500 px-2.5 py-0.5 rounded shadow-sm transition"
              >
                {inserted ? <Check className="w-3 h-3 text-white" /> : <PlusCircle className="w-3 h-3" />}
                <span>{inserted ? 'درج شد' : 'درج در متن سند'}</span>
              </button>
            </div>
          </div>

          <div
            dir="ltr"
            className="w-full h-[110px] bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-cyan-300 overflow-auto select-all whitespace-pre leading-relaxed"
          >
            {wrappedSnippet}
          </div>
        </div>

        {/* Live Visual Math / Matrix Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>پیش‌نمایش زنده در ساختار ماتریسی Word (OMML/KaTeX):</span>
            </span>
            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.2 rounded border border-cyan-500/20 font-mono">
              {environment}
            </span>
          </div>

          <div className="w-full h-[110px] bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-center overflow-auto">
            <div
              dir="ltr"
              className="text-slate-100 text-sm max-w-full overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: renderedKatex.html }}
            />
            {renderedKatex.error && (
              <span className="text-xs text-rose-400 font-mono">{renderedKatex.error}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
