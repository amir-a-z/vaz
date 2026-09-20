import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Bot,
  Zap,
  ArrowLeftRight,
  X,
  CheckSquare,
  Square,
  Info,
  Check,
} from 'lucide-react';
import {
  repairFormula,
  analyzeDocumentFormulas,
  repairEntireDocument,
  DocumentFormulaIssue,
  FormulaRepairResult,
} from '../utils/formulaRepair';
import { renderKatexSafe } from '../utils/mathConverter';

interface FormulaCorrectorProps {
  documentContent: string;
  onUpdateDocumentContent: (newContent: string) => void;
  onInsertSnippet: (snippet: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SAMPLE_BROKEN_FORMULAS = [
  { label: 'تایپ اشتباه کسر و آکولاد باز', code: '\\fac{1}{2' },
  { label: 'توان برنامه‌نویسی و رادیکال اشتباه', code: '\\sqr{x**2 + y**2}' },
  { label: 'غلط املایی حروف یونانی', code: '\\aplha + \\beeta = \\gamma' },
  { label: 'رادیکال بدون بک‌اسلش و پرانتزی', code: 'sqrt(a^2 + b^2)' },
  { label: 'ماتریس بدون دستور بستن', code: '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4' },
  { label: 'فرمول با اعداد فارسی و عملگر', code: 'f(x) = \\frac{۲x + ۳}{۴}' },
  { label: 'پرانتز و لفت نبسته', code: '\\left( \\frac{a}{b' },
];

export const FormulaCorrector: React.FC<FormulaCorrectorProps> = ({
  documentContent,
  onUpdateDocumentContent,
  onInsertSnippet,
  isOpen,
  onToggle,
}) => {
  const [activeTab, setActiveTab] = useState<'doc' | 'sandbox'>('doc');
  const [sandboxInput, setSandboxInput] = useState<string>('\\fac{1}{2');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<{ fixed: string; explanation: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bulk Fix state
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState<boolean>(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [bulkFixNotification, setBulkFixNotification] = useState<{
    count: number;
    message: string;
    details?: string[];
  } | null>(null);

  // Analyze document issues in real-time
  const documentIssues = useMemo(() => {
    return analyzeDocumentFormulas(documentContent);
  }, [documentContent]);

  // Real-time sandbox repair
  const sandboxRepair: FormulaRepairResult = useMemo(() => {
    return repairFormula(sandboxInput);
  }, [sandboxInput]);

  // Opens the single confirmation step for Bulk Fix
  const handleOpenBulkConfirm = () => {
    setSelectedIssueIds(documentIssues.map((i) => i.id));
    setShowBulkConfirmModal(true);
  };

  // Toggles issue selection inside confirmation modal
  const handleToggleSelectIssue = (id: string) => {
    setSelectedIssueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Selects or deselects all issues
  const handleToggleSelectAll = () => {
    if (selectedIssueIds.length === documentIssues.length) {
      setSelectedIssueIds([]);
    } else {
      setSelectedIssueIds(documentIssues.map((i) => i.id));
    }
  };

  // Single confirmation action: iterates through all detected issues and applies corrections at once
  const handleConfirmBulkFix = () => {
    if (selectedIssueIds.length === 0) return;

    const { repairedText, repairedCount, changesSummary } = repairEntireDocument(
      documentContent,
      selectedIssueIds
    );

    if (repairedCount > 0) {
      onUpdateDocumentContent(repairedText);
      setBulkFixNotification({
        count: repairedCount,
        message: `${repairedCount} فرمول دارای خطا با موفقیت اصلاح و در سند جایگزین شدند.`,
        details: changesSummary,
      });

      // Auto dismiss notification after 6 seconds
      setTimeout(() => {
        setBulkFixNotification(null);
      }, 6000);
    }

    setShowBulkConfirmModal(false);
  };

  const handleFixSingleIssue = (issue: DocumentFormulaIssue) => {
    if (!documentContent.includes(issue.rawMatch)) return;
    const updated = documentContent.replace(issue.rawMatch, issue.fixedMatch);
    onUpdateDocumentContent(updated);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAiRepair = async (formulaToRepair: string) => {
    if (!formulaToRepair.trim()) return;
    setIsAiLoading(true);
    setAiResult(null);

    try {
      const response = await fetch('/api/ai_repair_formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formula: formulaToRepair }),
      });
      const data = await response.json();
      if (data.success && data.fixedFormula) {
        setAiResult({
          fixed: data.fixedFormula,
          explanation: data.explanationFa || 'فرمول با موفقیت توسط هوش مصنوعی بازسازی و اصلاح شد.',
        });
        setSandboxInput(data.fixedFormula);
      } else {
        alert(data.error || 'خطا در اصلاح فرمول با هوش مصنوعی');
      }
    } catch (err: any) {
      alert(`خطای شبکه: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md transition-all duration-200 relative">
      {/* Header Bar */}
      <div
        onClick={onToggle}
        className="px-4 py-3 bg-slate-900/90 hover:bg-slate-800/60 cursor-pointer flex items-center justify-between border-b border-slate-800 select-none transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-slate-100">
                اصلاح‌کننده خودکار و هوشمند فرمول‌های ریاضی
              </span>
              {documentIssues.length > 0 ? (
                <span className="bg-rose-950/80 text-rose-300 border border-rose-800/80 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span>{documentIssues.length} فرمول نیازمند اصلاح</span>
                </span>
              ) : (
                <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>همه فرمول‌های سند معتبر هستند</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              تشخیص خودکار خطاهای گرامری، غلط‌های املایی، نمادهای نبسته و اصلاح سراسری با یک تایید
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {documentIssues.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenBulkConfirm();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm border border-emerald-500/30"
              title="اصلاح سراسری تمام فرمول‌های اشتباه سند با یک تایید"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>اصلاح سراسری ({documentIssues.length})</span>
            </button>
          )}

          <div className="text-slate-400 hover:text-slate-200 p-1">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Success Notification Banner after Bulk Fix */}
      {bulkFixNotification && (
        <div className="bg-emerald-950/70 border-b border-emerald-800/80 px-4 py-2.5 flex items-center justify-between animate-fadeIn text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-semibold text-emerald-300">اصلاح سراسری انجام شد:</span>{' '}
              <span>{bulkFixNotification.message}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBulkFixNotification(null)}
            className="text-emerald-400 hover:text-emerald-200 p-1 rounded transition"
            title="بستن پیام"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 bg-slate-950/60 space-y-4">
          {/* Navigation Sub-Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('doc')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'doc'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>بررسی فرمول‌های سند جاری ({documentIssues.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sandbox')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'sandbox'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>آزمایشگاه و تبدیل سریع فرمول تکی</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 hidden sm:block">
              الگوریتم فاصله لون‌اشتاین (Levenshtein) + تطبیق دستورات استاندارد ریاضی
            </div>
          </div>

          {/* TAB 1: Document Formula Doctor */}
          {activeTab === 'doc' && (
            <div className="space-y-3">
              {documentIssues.length === 0 ? (
                <div className="py-8 px-4 text-center bg-slate-900/40 border border-slate-800 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-200 font-semibold">
                    هیچ فرمول اشتباه یا ناخوانایی در سند شما وجود ندارد!
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                    تمامی فرمول‌های محتوای شما به درستی قالب‌بندی شده‌اند و در سند نهایی Word به صورت
                    معادلات رسمی OMML رندر خواهند شد.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Bulk Fix Action Banner */}
                  <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-blue-950/40 border border-emerald-800/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                          <span>اصلاح خودکار و سراسری (Bulk Fix)</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                            {documentIssues.length} مورد آماده
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          پیمایش خودکار در تمام خطاهای شناسایی‌شده و اعمال تمام اصلاحات با یک مرحله تایید
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenBulkConfirm}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>اجرای اصلاح سراسری ({documentIssues.length})</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300 px-1 pt-1">
                    <span>لیست فرمول‌های دارای خطا یا نگارش غیرمعیار در متن:</span>
                    <span className="text-slate-400 text-[11px]">
                      می‌توانید هر فرمول را تکی اصلاح کرده یا از «اصلاح سراسری» استفاده نمایید
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 max-h-[380px] overflow-y-auto pr-1">
                    {documentIssues.map((issue) => {
                      const { html: fixedHtml } = renderKatexSafe(issue.fixedFormula, issue.isDisplay);

                      return (
                        <div
                          key={issue.id}
                          className="bg-slate-900 border border-slate-800/90 rounded-xl p-3.5 space-y-3 hover:border-slate-700 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                سطر {issue.line}
                              </span>
                              <span className="text-slate-300 font-medium">
                                {issue.isDisplay ? 'فرمول شاخص بلوکی ($$...$$)' : 'فرمول درون‌متنی ($...$)'}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleFixSingleIssue(issue)}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>جایگزینی تکی</span>
                            </button>
                          </div>

                          {/* Before & After Comparison */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Original with error */}
                            <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-rose-300 font-semibold">
                                <span>کد اولیه (دارای خطا):</span>
                                {issue.originalError && (
                                  <span className="text-[10px] text-rose-400 font-mono">
                                    {issue.originalError.slice(0, 30)}...
                                  </span>
                                )}
                              </div>
                              <div
                                dir="ltr"
                                className="font-mono text-xs text-rose-200 bg-slate-950/80 p-2 rounded border border-rose-900/30 overflow-x-auto whitespace-pre-wrap break-all"
                              >
                                {issue.rawMatch}
                              </div>
                            </div>

                            {/* Corrected formula */}
                            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-semibold">
                                <span>نزدیک‌ترین فرمول معتبر اصلاح‌شده:</span>
                                <span className="text-[10px] text-emerald-400 font-mono">
                                  آماده تبدیل به Word
                                </span>
                              </div>
                              <div
                                dir="ltr"
                                className="font-mono text-xs text-emerald-300 bg-slate-950/80 p-2 rounded border border-emerald-900/30 overflow-x-auto whitespace-pre-wrap break-all"
                              >
                                {issue.fixedMatch}
                              </div>
                            </div>
                          </div>

                          {/* Live Render & Changes breakdown */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                            <div className="flex flex-wrap items-center gap-1.5 text-slate-300">
                              <span className="text-slate-400">اصلاحات اعمال‌شده:</span>
                              {issue.changes.map((ch, idx) => (
                                <span
                                  key={idx}
                                  className="bg-slate-800/90 text-amber-300 px-2 py-0.5 rounded text-[10px]"
                                >
                                  • {ch}
                                </span>
                              ))}
                            </div>

                            <div
                              dir="ltr"
                              className="bg-slate-950 px-3 py-1 rounded border border-slate-800 inline-block"
                            >
                              <span dangerouslySetInnerHTML={{ __html: fixedHtml }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Interactive Sandbox */}
          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              {/* Quick Sample Chips */}
              <div className="space-y-1.5">
                <span className="text-xs text-slate-400">
                  نمونه‌های رایج فرمول‌های اشتباه برای تست فوری تبدیل:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_BROKEN_FORMULAS.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSandboxInput(s.code);
                        setAiResult(null);
                      }}
                      className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition flex items-center gap-1.5"
                    >
                      <span className="text-amber-400">⚡</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sandbox Editor & Result Panes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left: Broken Formula Input */}
                <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      کد فرمول اشتباه یا محاسباتی خود را وارد کنید:
                    </span>
                    <button
                      type="button"
                      onClick={() => setSandboxInput('')}
                      className="text-slate-400 hover:text-slate-200 text-[11px]"
                    >
                      پاک‌کردن
                    </button>
                  </div>

                  <textarea
                    value={sandboxInput}
                    onChange={(e) => {
                      setSandboxInput(e.target.value);
                      setAiResult(null);
                    }}
                    dir="ltr"
                    rows={3}
                    placeholder="مثال: \fac{1}{2 یا \sqr{x**2 + y**2} یا \aplha + \beeta"
                    className="w-full bg-slate-950 p-2.5 font-mono text-xs text-slate-200 rounded-lg border border-slate-800 outline-none focus:border-blue-500 transition resize-none"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">
                      تبدیل به نزدیک‌ترین نگارش معتبر به صورت آنی
                    </span>

                    <button
                      type="button"
                      disabled={isAiLoading || !sandboxInput.trim()}
                      onClick={() => handleAiRepair(sandboxInput)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white transition shadow-sm"
                      title="استفاده از هوش مصنوعی برای بازسازی فرمول‌های پیچیده و آسیب‌دیده"
                    >
                      <Bot className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                      <span>{isAiLoading ? 'در حال بازسازی...' : 'اصلاح عمیق با هوش مصنوعی'}</span>
                    </button>
                  </div>
                </div>

                {/* Right: Repaired Formula Result */}
                <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>نزدیک‌ترین فرمول معتبر:</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(sandboxRepair.fixed, 'sandbox')}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedId === 'sandbox' ? 'کپی شد!' : 'کپی'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onInsertSnippet(`$${sandboxRepair.fixed}$`)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition shadow-sm"
                      >
                        <Plus className="w-3 h-3" />
                        <span>درج در متن</span>
                      </button>
                    </div>
                  </div>

                  {/* Fixed Code */}
                  <div
                    dir="ltr"
                    className="font-mono text-xs text-emerald-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800 overflow-x-auto min-h-[50px] flex items-center select-all"
                  >
                    {sandboxRepair.fixed || '<خالی>'}
                  </div>

                  {/* Rendered Math */}
                  <div className="p-2 bg-slate-950/80 rounded-lg border border-slate-800/80 text-center min-h-[44px] flex items-center justify-center">
                    {sandboxRepair.fixed ? (
                      <div
                        dir="ltr"
                        className="text-slate-100 text-base"
                        dangerouslySetInnerHTML={{
                          __html: renderKatexSafe(sandboxRepair.fixed, false).html,
                        }}
                      />
                    ) : (
                      <span className="text-slate-500 text-xs">پیش‌نمایش ریاضی</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Changes Explanation */}
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1 text-xs">
                <span className="text-slate-300 font-medium">جزئیات اصلاحات اعمال‌شده:</span>
                <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[11px]">
                  {sandboxRepair.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                  {aiResult && (
                    <li className="text-purple-300 font-medium">
                      توضیح هوش مصنوعی: {aiResult.explanation}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SINGLE CONFIRMATION STEP MODAL (Bulk Fix Confirmation) */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>تایید اصلاح سراسری فرمول‌ها (Bulk Fix)</span>
                    <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-mono">
                      {selectedIssueIds.length} از {documentIssues.length} انتخاب شده
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    بررسی تغییرات و اعمال خودکار اصلاحات پیشنهادی بر کل سند با یک کلیک
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Issues Review List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Notice Bar */}
              <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-200">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <span>
                    سیستم به صورت خودکار در میان تمام فرمول‌های دارای خطا پیمایش کرده و نگارش‌های اصلاح‌شده را به جای کدهای اشتباه قرار می‌دهد.
                  </span>
                  <div className="text-[11px] text-blue-300/80">
                    برای عدم تغییر یک فرمول خاص، می‌توانید تیک مربوط به آن را در لیست زیر بردارید.
                  </div>
                </div>
              </div>

              {/* Select All Toggle Bar */}
              <div className="flex items-center justify-between text-xs text-slate-300 px-1 border-b border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center gap-2 text-slate-300 hover:text-white transition font-medium"
                >
                  {selectedIssueIds.length === documentIssues.length ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                  <span>
                    {selectedIssueIds.length === documentIssues.length
                      ? 'لغو انتخاب همه'
                      : 'انتخاب همه موارد'}
                  </span>
                </button>

                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedIssueIds.length} مورد برای جایگزینی
                </span>
              </div>

              {/* Issues List with Before/After Diff */}
              <div className="space-y-3">
                {documentIssues.map((issue) => {
                  const isSelected = selectedIssueIds.includes(issue.id);
                  const { html: renderedHtml } = renderKatexSafe(issue.fixedFormula, issue.isDisplay);

                  return (
                    <div
                      key={issue.id}
                      onClick={() => handleToggleSelectIssue(issue.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer select-none space-y-2.5 ${
                        isSelected
                          ? 'bg-slate-950/80 border-emerald-700/60 shadow-sm'
                          : 'bg-slate-900/50 border-slate-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div
                            className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 accent-emerald-500"
                          />
                          <span className="font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                            سطر {issue.line}
                          </span>
                          <span className="text-slate-300 text-[11px] font-medium">
                            {issue.isDisplay ? 'فرمول بلوکی ($$...$$)' : 'فرمول درون‌متنی ($...$)'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          {issue.changes.map((ch, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Before / After Preview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-rose-950/30 border border-rose-900/40 rounded-lg p-2 font-mono text-[11px] text-rose-300 break-all" dir="ltr">
                          <div className="text-[10px] text-rose-400 font-sans mb-1 font-semibold">قبل (دارای خطا):</div>
                          {issue.rawMatch}
                        </div>

                        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-lg p-2 font-mono text-[11px] text-emerald-300 break-all" dir="ltr">
                          <div className="text-[10px] text-emerald-400 font-sans mb-1 font-semibold flex items-center justify-between">
                            <span>بعد (اصلاح‌شده):</span>
                            <span className="text-[9px] text-emerald-400 font-sans">معتبر</span>
                          </div>
                          {issue.fixedMatch}
                        </div>
                      </div>

                      {/* Rendered formula */}
                      <div className="pt-1 text-center bg-slate-900/90 rounded-lg p-1.5 border border-slate-800/80" dir="ltr">
                        <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer / Confirmation Action */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                انصراف و لغو
              </button>

              <button
                type="button"
                disabled={selectedIssueIds.length === 0}
                onClick={handleConfirmBulkFix}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition shadow-lg shadow-emerald-900/20"
              >
                <Sparkles className="w-4 h-4" />
                <span>تایید و اعمال اصلاحات ({selectedIssueIds.length} فرمول)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

