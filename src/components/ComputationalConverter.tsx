import React, { useState } from 'react';
import {
  Terminal,
  Copy,
  Check,
  PlusCircle,
  Sparkles,
  BookOpen,
  Table as TableIcon,
  Calculator,
  Grid,
} from 'lucide-react';
import { convertComputationalCodeToLatex, renderKatexSafe } from '../utils/mathConverter';
import { MarkdownTableHelper } from './MarkdownTableHelper';
import { LatexArrayWizard } from './LatexArrayWizard';

interface ComputationalConverterProps {
  onInsertToDoc: (snippet: string) => void;
  initialMode?: 'math' | 'wizard' | 'table';
}

const SAMPLE_CODES = [
  {
    title: 'دیفرانسیل و کسر توانی',
    code: 'diff(y, x) = (3*x**2 + sqrt(x)) / (2*pi*sigma)',
  },
  {
    title: 'توزیع نرمال گاوسی',
    code: 'f(x) = (1 / (sigma * sqrt(2*pi))) * exp(-((x - mu)**2) / (2 * sigma**2))',
  },
  {
    title: 'انتگرال و تابع نمایی',
    code: 'I = int(exp(-alpha * x**2), x) = sqrt(pi / alpha) / 2',
  },
  {
    title: 'معادله درجه دو',
    code: 'x = (-b +- sqrt(b**2 - 4*a*c)) / (2*a)',
  },
  {
    title: 'سری و سیگما',
    code: 'S = sum((1 / n**2), n, 1, inf) = pi**2 / 6',
  },
];

export const ComputationalConverter: React.FC<ComputationalConverterProps> = ({
  onInsertToDoc,
  initialMode = 'math',
}) => {
  const [activeTab, setActiveTab] = useState<'math' | 'wizard' | 'table'>(initialMode);
  const [inputCode, setInputCode] = useState<string>(SAMPLE_CODES[0].code);
  const [displayMode, setDisplayMode] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [inserted, setInserted] = useState<boolean>(false);

  const convertedLatex = convertComputationalCodeToLatex(inputCode);
  const wrappedLatex = displayMode ? `$$\n${convertedLatex}\n$$` : `$${convertedLatex}$`;
  const rendered = renderKatexSafe(convertedLatex, displayMode);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(wrappedLatex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsertToDoc(wrappedLatex);
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-4">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            {activeTab === 'math' ? (
              <Calculator className="w-4 h-4" />
            ) : activeTab === 'wizard' ? (
              <Grid className="w-4 h-4 text-cyan-400" />
            ) : (
              <TableIcon className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>مبدل کدهای محاسباتی و سازنده ساختارهای Word</span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/20 font-mono">
                OMML / LaTeX / Array / Tabular
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {activeTab === 'math'
                ? 'تبدیل کدهای خام محاسباتی (پایتون، متلب، سیم‌پای) به فرمول‌های دقیق ریاضیاتی Word'
                : activeTab === 'wizard'
                ? 'ویزارد هوشمند تولید سطر و ستون آرایه، ماتریس و جدول لاتک منطبق بر پردازشگر OMML'
                : 'طراحی تعاملی جدول استاندارد مارک‌داون و تبدیل خودکار به جدول رسمی و ساختاریافته در Word'}
            </p>
          </div>
        </div>

        {/* Tab Selection Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('math')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'math'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>فرمول محاسباتی</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wizard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'wizard'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>ویزارد آرایه و جدول لاتک</span>
            <span className="text-[9px] bg-cyan-500/20 text-cyan-200 px-1.5 py-0.2 rounded-full border border-cyan-500/30 font-mono">
              Array / OMML
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'table'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>سازنده جدول داده Word</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-200 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
              جدول داده
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Computational Math Formula Converter */}
      {activeTab === 'math' && (
        <div className="space-y-4">
          {/* Controls & Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-300">
              <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                <BookOpen className="w-3 h-3 text-blue-400" />
                <span>کدهای نمونه:</span>
              </span>
              {SAMPLE_CODES.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setInputCode(item.code)}
                  className="text-[11px] px-2.5 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
                >
                  {item.title}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
              <input
                type="checkbox"
                checked={displayMode}
                onChange={(e) => setDisplayMode(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 bg-slate-700 border-slate-600"
              />
              <span>فرمول بلوکی ($$...$$)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Computational Code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>کد محاسباتی اولیه (پایتون، متلب، سیم‌پای یا یونیکدمث ورد):</span>
                <span className="text-[11px] text-slate-500">توان با **، رادیکال با sqrt، کسر با /</span>
              </div>
              <textarea
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                rows={4}
                dir="ltr"
                placeholder="مثال: diff(y, x) = (3*x**2 + sqrt(x)) / (2*pi*sigma)"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg p-3 font-mono text-sm text-blue-200 outline-none resize-none transition"
              />
            </div>

            {/* Live Converted LaTeX and Output */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>فرمول لاتکس به دست آمده (LaTeX):</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'کپی شد' : 'کپی لاتکس'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleInsert}
                    className="flex items-center gap-1 text-[11px] text-white bg-blue-600 hover:bg-blue-500 px-2.5 py-0.5 rounded shadow-sm transition"
                  >
                    {inserted ? <Check className="w-3 h-3 text-white" /> : <PlusCircle className="w-3 h-3" />}
                    <span>{inserted ? 'درج شد' : 'درج در متن سند'}</span>
                  </button>
                </div>
              </div>
              <div
                dir="ltr"
                className="w-full h-[104px] bg-slate-950/80 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-auto select-all"
              >
                {wrappedLatex}
              </div>
            </div>
          </div>

          {/* Live Visual Math Formula Rendering */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 flex flex-col items-center justify-center min-h-[70px] relative overflow-hidden">
            <span className="absolute top-2 right-3 text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>پیش‌نمایش زنده نمادهای ریاضی (KaTeX / OMML)</span>
            </span>
            <div
              dir="ltr"
              className="mt-2 text-slate-100 text-base max-w-full overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: rendered.html }}
            />
            {rendered.error && (
              <p className="text-xs text-rose-400 mt-1 font-mono text-center">
                {rendered.error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: LaTeX Array / Tabular Wizard with OMML processor mapping */}
      {activeTab === 'wizard' && (
        <LatexArrayWizard onInsertToDoc={onInsertToDoc} />
      )}

      {/* Tab 3: Helper Tool for Markdown-style Tables with Automatic Word Table Conversion */}
      {activeTab === 'table' && (
        <MarkdownTableHelper onInsertToDoc={onInsertToDoc} />
      )}
    </div>
  );
};
