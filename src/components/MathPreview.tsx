import React from 'react';
import { renderKatexSafe, autoDetectAndWrapMath } from '../utils/mathConverter';
import { repairFormula } from '../utils/formulaRepair';
import { AlertCircle, FileText, CheckCircle2, Wrench, Sparkles } from 'lucide-react';

interface MathPreviewProps {
  content: string;
  onFixFormula?: (origFormula: string, fixedFormula: string, isDisplay: boolean) => void;
  onOpenCorrector?: () => void;
}

export const MathPreview: React.FC<MathPreviewProps> = ({
  content,
  onFixFormula,
  onOpenCorrector,
}) => {
  // Normalize text to detect and wrap any unwrapped math formulas
  const { text: normalized, count: autoDetectedCount } = autoDetectAndWrapMath(content);

  // Calculate math formula count and KaTeX validation
  let mathCount = 0;
  let errorCount = 0;

  const inlineMatches = normalized.match(/\$[^\$]+\$/g) || [];
  const displayMatches = normalized.match(/\$\$[\s\S]+?\$\$/g) || [];
  mathCount = inlineMatches.length + displayMatches.length;

  [...inlineMatches, ...displayMatches].forEach((m) => {
    const isDisplay = m.startsWith('$$');
    const formula = isDisplay ? m.slice(2, -2).trim() : m.slice(1, -1).trim();
    const res = renderKatexSafe(formula, isDisplay);
    if (res.error) errorCount++;
  });

  const isPersian = /[\u0600-\u06FF]/.test(content);

  const renderInlineWithMath = (text: string, keyPrefix: string) => {
    const parts = text.split(/(\$[^\$]+\$|\\\([\s\S]+?\\\))/g);
    return parts.map((part, idx) => {
      if (!part) return null;
      if (part.startsWith('$') && part.endsWith('$')) {
        const formula = part.slice(1, -1).trim();
        const { html, error } = renderKatexSafe(formula, false);
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            dir="ltr"
            className="inline-flex items-center px-1 mx-0.5 align-middle text-slate-100 font-sans"
            title={error ? `خطا: ${error}` : formula}
          >
            <span dangerouslySetInnerHTML={{ __html: html }} />
            {error && onFixFormula && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rep = repairFormula(formula);
                  onFixFormula(formula, rep.fixed, false);
                }}
                className="mr-1 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded flex items-center gap-0.5 transition"
                title="کلیک برای اصلاح خودکار به نزدیک‌ترین فرمول معتبر"
              >
                <Wrench className="w-2.5 h-2.5" />
                <span>اصلاح</span>
              </button>
            )}
          </span>
        );
      }
      if (part.startsWith('\\(') && part.endsWith('\\)')) {
        const formula = part.slice(2, -2).trim();
        const { html, error } = renderKatexSafe(formula, false);
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            dir="ltr"
            className="inline-flex items-center px-1 mx-0.5 align-middle text-slate-100 font-sans"
            title={error ? `خطا: ${error}` : formula}
          >
            <span dangerouslySetInnerHTML={{ __html: html }} />
            {error && onFixFormula && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const rep = repairFormula(formula);
                  onFixFormula(formula, rep.fixed, false);
                }}
                className="mr-1 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-1 py-0.5 rounded flex items-center gap-0.5 transition"
                title="کلیک برای اصلاح خودکار به نزدیک‌ترین فرمول معتبر"
              >
                <Wrench className="w-2.5 h-2.5" />
                <span>اصلاح</span>
              </button>
            )}
          </span>
        );
      }
      return <span key={`${keyPrefix}-${idx}`}>{part}</span>;
    });
  };

  const renderBlocks = () => {
    const lines = normalized.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. Code fence block ```
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        elements.push(
          <pre
            key={`code-${i}`}
            dir="ltr"
            className="my-3 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto shadow-inner"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        continue;
      }

      // 2. Display math $$ ... $$
      if (trimmed.startsWith('$$')) {
        const mathLines: string[] = [];
        if (trimmed.length > 2 && trimmed.endsWith('$$') && trimmed !== '$$') {
          mathLines.push(trimmed.slice(2, -2).trim());
          i++;
        } else {
          i++;
          while (i < lines.length && !lines[i].trim().endsWith('$$')) {
            mathLines.push(lines[i]);
            i++;
          }
          if (i < lines.length && lines[i].trim() !== '$$') {
            mathLines.push(lines[i].trim().replace(/\$\$$/, ''));
          }
          i++;
        }

        const formula = mathLines.join('\n').trim();
        const { html, error } = renderKatexSafe(formula, true);
        elements.push(
          <div
            key={`display-${i}`}
            className="my-4 py-3 px-4 bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto text-center shadow-sm"
            dir="ltr"
          >
            <div
              className="text-slate-100 text-base md:text-lg leading-relaxed inline-block"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {error && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                <div className="text-xs text-rose-400 font-mono flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 inline" />
                  <span>خطای فرمول: {error}</span>
                </div>
                {onFixFormula && (
                  <button
                    type="button"
                    onClick={() => {
                      const rep = repairFormula(formula);
                      onFixFormula(formula, rep.fixed, true);
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1 transition shadow-sm font-medium"
                    title="اصلاح خودکار خطاهای این فرمول به نزدیک‌ترین معادل معتبر"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>اصلاح خودکار به نزدیک‌ترین فرمول معتبر</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
        continue;
      }

      // 3. Tab-separated table detection
      if (line.includes('\t') && line.split('\t').filter(Boolean).length >= 2) {
        const tableRows: string[][] = [];
        while (i < lines.length && lines[i].includes('\t') && lines[i].split('\t').filter(Boolean).length >= 2) {
          tableRows.push(lines[i].split('\t').map((c) => c.trim()));
          i++;
        }

        if (tableRows.length > 0) {
          const headers = tableRows[0];
          const bodyRows = tableRows.slice(1);

          elements.push(
            <div
              key={`tab-table-${i}`}
              className="my-3 overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/40 shadow-sm"
            >
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-200 font-semibold">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-2.5 border-l border-slate-700/60 last:border-l-0">
                        {renderInlineWithMath(h, `th-${i}-${hIdx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="p-2.5 text-slate-300 border-l border-slate-800/40 last:border-l-0"
                        >
                          {renderInlineWithMath(cell, `td-${i}-${rIdx}-${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 4. Markdown pipe table detection
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        // Filter out separator lines like |--|--|
        const validRows = tableLines
          .filter((l) => !/^\|[\s\-:|]+\|$/.test(l))
          .map((l) =>
            l
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim())
          );

        if (validRows.length > 0) {
          const headers = validRows[0];
          const bodyRows = validRows.slice(1);

          elements.push(
            <div
              key={`md-table-${i}`}
              className="my-3 overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/40 shadow-sm"
            >
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-800/80 border-b border-slate-700 text-slate-200 font-semibold">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-2.5 border-l border-slate-700/60 last:border-l-0">
                        {renderInlineWithMath(h, `mdth-${i}-${hIdx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="p-2.5 text-slate-300 border-l border-slate-800/40 last:border-l-0"
                        >
                          {renderInlineWithMath(cell, `mdtd-${i}-${rIdx}-${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 5. Headings (#, ##, ###)
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1
            key={`h1-${i}`}
            className="text-lg md:text-xl font-bold text-slate-100 mt-5 mb-2 pb-2 border-b border-slate-800"
          >
            {renderInlineWithMath(trimmed.replace(/^#\s+/, ''), `h1-content-${i}`)}
          </h1>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2
            key={`h2-${i}`}
            className="text-base md:text-lg font-bold text-blue-300 mt-4 mb-2"
          >
            {renderInlineWithMath(trimmed.replace(/^##\s+/, ''), `h2-content-${i}`)}
          </h2>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3
            key={`h3-${i}`}
            className="text-sm md:text-base font-semibold text-slate-200 mt-3 mb-1"
          >
            {renderInlineWithMath(trimmed.replace(/^###\s+/, ''), `h3-content-${i}`)}
          </h3>
        );
        i++;
        continue;
      }

      // 6. Bullet lists (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.replace(/^[-*]\s+/, '');
        elements.push(
          <div key={`li-${i}`} className="flex items-start gap-2 my-1 mr-2 md:mr-3">
            <span className="text-blue-400 text-sm leading-6 shrink-0">•</span>
            <span className="text-sm text-slate-300 leading-relaxed">
              {renderInlineWithMath(itemText, `li-content-${i}`)}
            </span>
          </div>
        );
        i++;
        continue;
      }

      // 7. Empty line
      if (!trimmed) {
        elements.push(<div key={`empty-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // 8. Normal paragraph line
      elements.push(
        <p key={`p-${i}`} className="text-sm text-slate-200 leading-relaxed my-1">
          {renderInlineWithMath(line, `p-content-${i}`)}
        </p>
      );
      i++;
    }

    return elements;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Header toolbar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-semibold text-slate-200">پیش‌نمایش زنده سند Word</span>
          <span className="text-[11px] bg-blue-950/70 text-blue-300 px-2 py-0.5 rounded-full border border-blue-800/60 font-mono">
            {mathCount} فرمول ریاضی
          </span>
          {autoDetectedCount > 0 && (
            <span className="text-[11px] bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/60 font-mono">
              {autoDetectedCount} فرمول خودکار
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {errorCount === 0 ? (
            <span className="text-emerald-400 flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تمام فرمول‌ها معتبر و آماده Word هستند</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-rose-400 flex items-center gap-1 text-xs font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errorCount} خطای فرمول لاتکس</span>
              </span>
              {onOpenCorrector && (
                <button
                  type="button"
                  onClick={onOpenCorrector}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition shadow-sm"
                  title="باز کردن پنل اصلاح‌کننده هوشمند فرمول‌ها"
                >
                  <Wrench className="w-3 h-3 text-amber-400" />
                  <span>اصلاح هوشمند خطاهای سند</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content scroll area */}
      <div
        dir={isPersian ? 'rtl' : 'ltr'}
        className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-950/50 space-y-1 select-text"
      >
        {content.trim() ? (
          renderBlocks()
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm py-12">
            <FileText className="w-10 h-10 text-slate-600 mb-2 stroke-[1.5]" />
            <p>متن، فرمول‌های ریاضی ($...$) یا کدهای خام را در ویرایشگر وارد کنید.</p>
            <p className="text-xs text-slate-600 mt-1">فرمول‌ها و جداول به صورت خودکار شناسایی و رندر می‌شوند.</p>
          </div>
        )}
      </div>
    </div>
  );
};
