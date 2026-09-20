import React, { useState, useMemo } from 'react';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  Copy,
  Check,
  PlusCircle,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code2,
  Eye,
  RefreshCw,
  BookOpen,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { ColumnAlignment, MarkdownTablePreset } from '../types';
import { renderKatexSafe } from '../utils/mathConverter';

interface MarkdownTableHelperProps {
  onInsertToDoc: (markdownTable: string) => void;
}

const TABLE_PRESETS: MarkdownTablePreset[] = [
  {
    id: 'physics_lab',
    titleFa: 'داده‌های آزمایشگاهی',
    descFa: 'جدول عنوان آزمایش، فرمول حاکم، مقدار اندازه‌گیری و واحد فیزیکی',
    headers: ['عنوان آزمایش', 'رابطه حاکم', 'مقدار اندازه‌گیری', 'واحد'],
    alignments: ['right', 'center', 'center', 'center'],
    rows: [
      ['سقوط آزاد و شتاب', '$h = \\frac{1}{2}gt^2$', '19.6', '$\\text{m}$'],
      ['انرژی جنبشی ذرات', '$K = \\frac{1}{2}mv^2$', '250.0', '$\\text{J}$'],
      ['قانون اهم الکتریکی', '$V = I \\cdot R$', '12.0', '$\\text{V}$'],
      ['نیروی گرانش نیوتنی', '$F = G\\frac{m_1 m_2}{r^2}$', '$6.67 \\times 10^{-11}$', '$\\text{N}$'],
    ],
  },
  {
    id: 'physical_constants',
    titleFa: 'ثوابت و متغیرهای فیزیکی',
    descFa: 'پارامترهای استاندارد فیزیکی همراه با نماد و فرمول محاسباتی',
    headers: ['نام کمیت', 'نماد استاندارد', 'رابطه محاسباتی', 'مقدار و واحد'],
    alignments: ['right', 'center', 'center', 'left'],
    rows: [
      ['سرعت نور در خلأ', '$c$', '$c = \\frac{1}{\\sqrt{\\mu_0 \\varepsilon_0}}$', '$2.998 \\times 10^8\\,\\text{m/s}$'],
      ['ثابت پلانک', '$h$', '$E = h\\nu$', '$6.626 \\times 10^{-34}\\,\\text{J}\\cdot\\text{s}$'],
      ['ثابت بولتزمن', '$k_B$', '$k_B = \\frac{R}{N_A}$', '$1.380 \\times 10^{-23}\\,\\text{J/K}$'],
      ['بار بنیادی الکترون', '$e$', '$I = \\frac{\\Delta q}{\\Delta t}$', '$1.602 \\times 10^{-19}\\,\\text{C}$'],
    ],
  },
  {
    id: 'linear_system',
    titleFa: 'دستگاه معادلات و ضرایب',
    descFa: 'ماتریس ضرایب متغیرهای مجهول و مقادیر معلوم معادلات جبری',
    headers: ['معادله', 'ضریب $x$', 'ضریب $y$', 'ضریب $z$', 'مقدار ثابت ($b$)'],
    alignments: ['center', 'center', 'center', 'center', 'center'],
    rows: [
      ['معادله اول', '$3$', '$2$', '$-1$', '$12$'],
      ['معادله دوم', '$1$', '$-4$', '$2$', '$-5$'],
      ['معادله سوم', '$-2$', '$1$', '$5$', '$18$'],
    ],
  },
  {
    id: 'numerical_analysis',
    titleFa: 'محاسبات عددی و تقریب',
    descFa: 'جدول گام‌های تکرار نیوتن-رافسون، مقدار تقریب و خطای محاسباتی',
    headers: ['گام ($n$)', 'مقدار تقریب ($x_n$)', 'فرمول تکرار', 'خطای مطلق ($|e_n|$)'],
    alignments: ['center', 'center', 'center', 'center'],
    rows: [
      ['$0$', '$1.0000$', '$x_0$', '$0.4142$'],
      ['$1$', '$1.5000$', '$\\frac{1}{2}(x_0 + \\frac{2}{x_0})$', '$0.0858$'],
      ['$2$', '$1.4167$', '$\\frac{1}{2}(x_1 + \\frac{2}{x_1})$', '$0.0025$'],
      ['$3$', '$1.4142$', '$\\frac{1}{2}(x_2 + \\frac{2}{x_2})$', '$0.0000$'],
    ],
  },
];

export function buildMarkdownTable(
  headers: string[],
  alignments: ColumnAlignment[],
  rows: string[][]
): string {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));
  const safeHeaders: string[] = [];
  for (let i = 0; i < colCount; i++) {
    safeHeaders.push(headers[i]?.trim() || `ستون ${i + 1}`);
  }

  const sepRow = safeHeaders.map((_, i) => {
    const align = alignments[i] || 'center';
    if (align === 'left') return ':---';
    if (align === 'right') return '---:';
    return ':---:';
  });

  const lines: string[] = [];
  lines.push(`| ${safeHeaders.join(' | ')} |`);
  lines.push(`| ${sepRow.join(' | ')} |`);

  for (const row of rows) {
    const safeCells: string[] = [];
    for (let i = 0; i < colCount; i++) {
      safeCells.push(row[i]?.trim() || '');
    }
    lines.push(`| ${safeCells.join(' | ')} |`);
  }

  return lines.join('\n');
}

export function parseMarkdownTable(text: string): {
  headers: string[];
  alignments: ColumnAlignment[];
  rows: string[][];
} | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 2) return null;

  const parseRow = (line: string) => {
    return line
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim());
  };

  const headerCells = parseRow(lines[0]);
  const sepCells = parseRow(lines[1]);

  const alignments: ColumnAlignment[] = headerCells.map((_, idx) => {
    const sep = sepCells[idx] || '';
    const hasLeftColon = sep.startsWith(':');
    const hasRightColon = sep.endsWith(':');
    if (hasLeftColon && hasRightColon) return 'center';
    if (hasRightColon) return 'right';
    if (hasLeftColon) return 'left';
    return 'center';
  });

  const dataRows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    // skip any repeated separator line
    if (/^\|[\s\-:|]+\|$/.test(lines[i])) continue;
    dataRows.push(parseRow(lines[i]));
  }

  return {
    headers: headerCells,
    alignments,
    rows: dataRows.length > 0 ? dataRows : [['']],
  };
}

export const MarkdownTableHelper: React.FC<MarkdownTableHelperProps> = ({ onInsertToDoc }) => {
  const [headers, setHeaders] = useState<string[]>(TABLE_PRESETS[0].headers);
  const [alignments, setAlignments] = useState<ColumnAlignment[]>(TABLE_PRESETS[0].alignments);
  const [rows, setRows] = useState<string[][]>(TABLE_PRESETS[0].rows);
  const [editMode, setEditMode] = useState<'visual' | 'raw'>('visual');
  const [rawText, setRawText] = useState<string>(() =>
    buildMarkdownTable(TABLE_PRESETS[0].headers, TABLE_PRESETS[0].alignments, TABLE_PRESETS[0].rows)
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [inserted, setInserted] = useState<boolean>(false);
  const [activeCellCoord, setActiveCellCoord] = useState<{ r: number; c: number } | null>(null);

  // Sync Markdown string whenever visual elements change
  const currentMarkdown = useMemo(() => {
    if (editMode === 'visual') {
      return buildMarkdownTable(headers, alignments, rows);
    }
    return rawText;
  }, [headers, alignments, rows, editMode, rawText]);

  // Load a preset template
  const handleLoadPreset = (preset: MarkdownTablePreset) => {
    setHeaders([...preset.headers]);
    setAlignments([...preset.alignments]);
    setRows(preset.rows.map((r) => [...r]));
    const md = buildMarkdownTable(preset.headers, preset.alignments, preset.rows);
    setRawText(md);
  };

  // Add column
  const handleAddColumn = () => {
    const newColIndex = headers.length + 1;
    setHeaders((prev) => [...prev, `ستون ${newColIndex}`]);
    setAlignments((prev) => [...prev, 'center']);
    setRows((prev) => prev.map((row) => [...row, '']));
    if (editMode === 'raw') {
      const updatedHeaders = [...headers, `ستون ${newColIndex}`];
      const updatedAlignments: ColumnAlignment[] = [...alignments, 'center'];
      const updatedRows = rows.map((r) => [...r, '']);
      setRawText(buildMarkdownTable(updatedHeaders, updatedAlignments, updatedRows));
    }
  };

  // Remove column
  const handleRemoveColumn = (colIndex?: number) => {
    if (headers.length <= 1) return;
    const target = colIndex !== undefined ? colIndex : headers.length - 1;
    const nextHeaders = headers.filter((_, i) => i !== target);
    const nextAlignments = alignments.filter((_, i) => i !== target);
    const nextRows = rows.map((row) => row.filter((_, i) => i !== target));
    setHeaders(nextHeaders);
    setAlignments(nextAlignments);
    setRows(nextRows);
    setRawText(buildMarkdownTable(nextHeaders, nextAlignments, nextRows));
  };

  // Add row
  const handleAddRow = () => {
    const emptyRow = new Array(headers.length).fill('');
    setRows((prev) => [...prev, emptyRow]);
    if (editMode === 'raw') {
      const updatedRows = [...rows, emptyRow];
      setRawText(buildMarkdownTable(headers, alignments, updatedRows));
    }
  };

  // Remove row
  const handleRemoveRow = (rowIndex?: number) => {
    if (rows.length <= 1) return;
    const target = rowIndex !== undefined ? rowIndex : rows.length - 1;
    const nextRows = rows.filter((_, i) => i !== target);
    setRows(nextRows);
    setRawText(buildMarkdownTable(headers, alignments, nextRows));
  };

  // Cell edit
  const handleCellChange = (rIdx: number, cIdx: number, val: string) => {
    const nextRows = rows.map((row, r) => {
      if (r !== rIdx) return row;
      const nextRow = [...row];
      nextRow[cIdx] = val;
      return nextRow;
    });
    setRows(nextRows);
    setRawText(buildMarkdownTable(headers, alignments, nextRows));
  };

  // Header edit
  const handleHeaderChange = (cIdx: number, val: string) => {
    const nextHeaders = [...headers];
    nextHeaders[cIdx] = val;
    setHeaders(nextHeaders);
    setRawText(buildMarkdownTable(nextHeaders, alignments, rows));
  };

  // Toggle alignment
  const handleToggleAlignment = (cIdx: number) => {
    const current = alignments[cIdx] || 'center';
    let next: ColumnAlignment = 'center';
    if (current === 'center') next = 'right';
    else if (current === 'right') next = 'left';
    else next = 'center';

    const nextAlignments = [...alignments];
    nextAlignments[cIdx] = next;
    setAlignments(nextAlignments);
    setRawText(buildMarkdownTable(headers, nextAlignments, rows));
  };

  // Quick wrap cell with formula ($...$)
  const handleWrapWithMath = (rIdx: number, cIdx: number) => {
    const current = rows[rIdx]?.[cIdx] || '';
    if (current.startsWith('$') && current.endsWith('$')) {
      // unwrap
      handleCellChange(rIdx, cIdx, current.slice(1, -1));
    } else {
      // wrap
      handleCellChange(rIdx, cIdx, `$${current || 'x^2'}$`);
    }
  };

  // Reset to clean 3x3 table
  const handleReset = () => {
    const initHeaders = ['ستون اول', 'ستون دوم', 'ستون سوم'];
    const initAlignments: ColumnAlignment[] = ['center', 'center', 'center'];
    const initRows = [
      ['مقدار ۱', '$y = ax + b$', '10.5'],
      ['مقدار ۲', '$y = x^2$', '25.0'],
    ];
    setHeaders(initHeaders);
    setAlignments(initAlignments);
    setRows(initRows);
    setRawText(buildMarkdownTable(initHeaders, initAlignments, initRows));
  };

  // Raw Markdown textarea handler
  const handleRawChange = (val: string) => {
    setRawText(val);
    const parsed = parseMarkdownTable(val);
    if (parsed) {
      setHeaders(parsed.headers);
      setAlignments(parsed.alignments);
      setRows(parsed.rows);
    }
  };

  // Copy Markdown
  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Insert into Document
  const handleInsert = () => {
    onInsertToDoc(`\n\n${currentMarkdown}\n\n`);
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  // Helper for KaTeX rendering inside visual cells
  const renderCellWithMath = (text: string) => {
    if (!text) return <span className="text-slate-600 text-[11px]">—</span>;

    // Check if cell is completely inline math or contains inline math
    const parts = text.split(/(\$[^\$]+\$)/g);
    return parts.map((part, pIdx) => {
      if (!part) return null;
      if (part.startsWith('$') && part.endsWith('$')) {
        const formula = part.slice(1, -1);
        const { html, error } = renderKatexSafe(formula, false);
        return (
          <span
            key={pIdx}
            dir="ltr"
            className="inline-block px-1 align-middle"
            title={error || formula}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      return <span key={pIdx}>{part}</span>;
    });
  };

  return (
    <div className="space-y-4">
      {/* Sub-header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-300">
          <span className="text-slate-400 flex items-center gap-1 text-[11px]">
            <BookOpen className="w-3 h-3 text-cyan-400" />
            <span>جداول آماده علمی:</span>
          </span>
          {TABLE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleLoadPreset(item)}
              className="text-[11px] px-2.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white transition flex items-center gap-1"
            >
              <span>{item.titleFa}</span>
            </button>
          ))}
        </div>

        {/* Mode Switcher (Visual vs Raw Markdown) */}
        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setEditMode('visual')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition text-xs ${
              editMode === 'visual'
                ? 'bg-cyan-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>ویرایشگر شبکه جدول</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRawText(buildMarkdownTable(headers, alignments, rows));
              setEditMode('raw');
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition text-xs ${
              editMode === 'raw'
                ? 'bg-cyan-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>کد خام مارک‌داون</span>
          </button>
        </div>
      </div>

      {/* Main Table Editor Section */}
      {editMode === 'visual' ? (
        <div className="space-y-3">
          {/* Table Dimension and Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-[11px]">
                ابعاد جدول: {rows.length} سطر × {headers.length} ستون
              </span>
              <span className="text-slate-700">|</span>
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-[11px]"
              >
                <Plus className="w-3 h-3 text-cyan-400" />
                <span>سطر جدید</span>
              </button>
              <button
                type="button"
                onClick={() => handleRemoveRow()}
                disabled={rows.length <= 1}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition text-[11px]"
              >
                <Trash2 className="w-3 h-3" />
                <span>حذف سطر آخر</span>
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition text-[11px]"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>ستون جدید</span>
              </button>
              <button
                type="button"
                onClick={() => handleRemoveColumn()}
                disabled={headers.length <= 1}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition text-[11px]"
              >
                <Trash2 className="w-3 h-3" />
                <span>حذف ستون آخر</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition px-1.5 py-0.5"
                title="بازنشانی جدول به حالت پیش‌فرض اولیه"
              >
                <RefreshCw className="w-3 h-3" />
                <span>بازنشانی</span>
              </button>
            </div>
          </div>

          {/* Interactive Cell Grid */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/90 shadow-sm">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-200 font-semibold">
                  <th className="p-2 w-10 text-center text-slate-500 font-mono text-[10px] border-l border-slate-800">
                    #
                  </th>
                  {headers.map((h, cIdx) => (
                    <th key={cIdx} className="p-2 border-l border-slate-800 last:border-l-0 min-w-[150px]">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                          placeholder={`عنوان ستون ${cIdx + 1}`}
                          className="flex-1 bg-slate-800/80 border border-slate-700/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded px-2 py-1 text-slate-100 text-xs font-semibold outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => handleToggleAlignment(cIdx)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          title={`تغییر تراز: ${alignments[cIdx] === 'center' ? 'وسط‌چین' : alignments[cIdx] === 'right' ? 'راست‌چین' : 'چپ‌چین'}`}
                        >
                          {alignments[cIdx] === 'center' && <AlignCenter className="w-3 h-3 text-cyan-400" />}
                          {alignments[cIdx] === 'right' && <AlignRight className="w-3 h-3 text-amber-400" />}
                          {alignments[cIdx] === 'left' && <AlignLeft className="w-3 h-3 text-emerald-400" />}
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="p-2 w-10 text-center border-l border-slate-800 last:border-l-0"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors"
                  >
                    <td className="p-2 text-center text-slate-500 font-mono text-[11px] border-l border-slate-800">
                      {rIdx + 1}
                    </td>
                    {headers.map((_, cIdx) => {
                      const cellVal = row[cIdx] || '';
                      const isFormula = cellVal.startsWith('$') && cellVal.endsWith('$');
                      return (
                        <td
                          key={cIdx}
                          className="p-1.5 border-l border-slate-800/60 last:border-l-0 relative"
                        >
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={cellVal}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              onFocus={() => setActiveCellCoord({ r: rIdx, c: cIdx })}
                              dir={cellVal.includes('$') || /^[0-9a-zA-Z\s.,\-+/*=^]+$/.test(cellVal) ? 'ltr' : 'rtl'}
                              placeholder="متن یا فرمول $...$"
                              className={`w-full bg-slate-900/80 border ${
                                isFormula
                                  ? 'border-cyan-500/50 text-cyan-200'
                                  : 'border-slate-800 text-slate-200'
                              } focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded px-2.5 py-1.5 text-xs outline-none transition font-sans`}
                            />
                            <button
                              type="button"
                              onClick={() => handleWrapWithMath(rIdx, cIdx)}
                              className={`absolute left-1.5 text-[10px] px-1 py-0.2 rounded font-mono transition ${
                                isFormula
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                              }`}
                              title="تبدیل یا محصور کردن در نماد فرمول ($...$)"
                            >
                              $
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-1.5 text-center border-l border-slate-800/60 last:border-l-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(rIdx)}
                        disabled={rows.length <= 1}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 disabled:opacity-20 transition"
                        title="حذف این سطر"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Raw Markdown Direct Input */
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>متن جدول مارک‌داون (GitHub Flavored / CommonMark Markdown Table):</span>
            <span className="text-[11px] text-slate-500">پایپ‌ها (|) و جداکننده‌ها (:---:)</span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => handleRawChange(e.target.value)}
            rows={7}
            dir="ltr"
            placeholder="| عنوان ۱ | عنوان ۲ |\n| :---: | :---: |\n| مقدار ۱ | $x^2$ |"
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-lg p-3 font-mono text-xs text-cyan-200 outline-none resize-none transition"
          />
        </div>
      )}

      {/* Visual Live Preview & Word OMML Readiness Notice */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">
              پیش‌نمایش زنده جدول با فرمول‌های رندر شده ریاضی (KaTeX):
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <FileSpreadsheet className="w-3 h-3" />
            <span>آماده تبدیل به جدول ساختاریافته Word (.docx)</span>
          </div>
        </div>

        {/* Live Rendered HTML Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/50">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-slate-800/90 border-b border-slate-700 text-slate-100 font-bold">
                {headers.map((h, i) => {
                  const align = alignments[i] || 'center';
                  return (
                    <th
                      key={i}
                      className={`p-2.5 border-l border-slate-700/60 last:border-l-0 ${
                        align === 'center'
                          ? 'text-center'
                          : align === 'right'
                          ? 'text-right'
                          : 'text-left'
                      }`}
                    >
                      {renderCellWithMath(h)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={`border-b border-slate-800/50 ${
                    rIdx % 2 === 1 ? 'bg-slate-900/40' : 'bg-transparent'
                  }`}
                >
                  {headers.map((_, cIdx) => {
                    const align = alignments[cIdx] || 'center';
                    const cellVal = row[cIdx] || '';
                    return (
                      <td
                        key={cIdx}
                        className={`p-2.5 text-slate-300 border-l border-slate-800/40 last:border-l-0 ${
                          align === 'center'
                            ? 'text-center'
                            : align === 'right'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        {renderCellWithMath(cellVal)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Technical Guarantee & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              این جدول پس از درج در سند، در زمان کلیک بر روی <strong>«تولید سند Word»</strong> به‌صورت کاملاً ساختاریافته (جدول استاندارد Word، خطوط شبکه، سلول‌های راست‌چین و فرمول‌های فعال OMML) ایجاد خواهد شد.
            </span>
          </p>

          <div className="flex items-center gap-2 shrink-0 mr-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition shadow-sm font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'کپی شد' : 'کپی کد جدول'}</span>
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="flex items-center gap-1 text-xs text-white bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 rounded-lg shadow-sm transition font-medium"
            >
              {inserted ? <Check className="w-3.5 h-3.5 text-white" /> : <PlusCircle className="w-3.5 h-3.5" />}
              <span>{inserted ? 'درج شد' : 'درج جدول در متن سند'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
