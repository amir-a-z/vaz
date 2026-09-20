import React, { useState, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { SymbolPalette } from './components/SymbolPalette';
import { ComputationalConverter } from './components/ComputationalConverter';
import { FormulaCorrector } from './components/FormulaCorrector';
import { MathPreview } from './components/MathPreview';
import { PresetsDrawer } from './components/PresetsDrawer';
import { HelpModal } from './components/HelpModal';
import { HistoryDownloads } from './components/HistoryDownloads';
import { HighlightedEditor } from './components/HighlightedEditor';
import { PRESETS } from './data/presets';
import { GeneratedDoc, PresetTemplate, GenerateResponse } from './types';
import { autoDetectAndWrapMath } from './utils/mathConverter';
import { preprocessPersianText } from './utils/persianPreProcessor';
import { analyzeDocumentFormulas } from './utils/formulaRepair';
import {
  Columns,
  Eye,
  Edit3,
  Copy,
  Trash2,
  Terminal,
  Download,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Wrench,
} from 'lucide-react';

const INITIAL_CONTENT = PRESETS[0].content;

export default function App() {
  const [content, setContent] = useState<string>(INITIAL_CONTENT);
  const [filename, setFilename] = useState<string>('Physics_Formulas');
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [showConverter, setShowConverter] = useState<boolean>(true);
  const [showCorrector, setShowCorrector] = useState<boolean>(false);
  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string; downloadUrl?: string; filename?: string } | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Real-time detection of broken/unreadable formulas in document
  const formulaIssues = useMemo(() => {
    return analyzeDocumentFormulas(content);
  }, [content]);

  // Insert text snippet at cursor position in textarea
  const handleInsertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + '\n' + snippet);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = before + snippet + after;
    setContent(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 50);
  };

  const handleSelectPreset = (preset: PresetTemplate) => {
    setContent(preset.content);
    setFilename(preset.id);
    setAlert({
      type: 'success',
      message: `قالب «${preset.titleFa}» در ویرایشگر بارگذاری شد.`,
    });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleClear = () => {
    if (window.confirm('آیا از پاک‌کردن متن ویرایشگر مطمئن هستید؟')) {
      setContent('');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setAlert({
      type: 'success',
      message: 'کل محتوای سند در کلیپ‌بورد کپی شد.',
    });
    setTimeout(() => setAlert(null), 2500);
  };

  const downloadFileBlob = async (downloadUrl: string, targetFilename: string) => {
    try {
      const resp = await fetch(downloadUrl);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = targetFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }, 100);
    } catch {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = targetFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
    }
  };

  const handleGenerate = async () => {
    if (!content.trim()) {
      setAlert({
        type: 'error',
        message: 'متن سند خالی است. لطفاً فرمول یا محتوای موردنظر را وارد کنید.',
      });
      return;
    }

    setIsGenerating(true);
    setAlert(null);

    try {
      // Preprocess Persian text: optimize RTL rules, English terms direction & punctuation
      const processedText = preprocessPersianText(content);

      const cleanFilename = filename.trim().replace(/\.docx$/i, '') || 'Document';
      const targetFilename = `${cleanFilename}.docx`;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: processedText,
          filename: targetFilename,
        }),
      });

      const data: GenerateResponse = await response.json();

      if (data.success && data.filename) {
        const downloadUrl = `/api/download/${encodeURIComponent(data.filename)}`;
        
        // Auto trigger safe blob download
        await downloadFileBlob(downloadUrl, data.filename);

        const newDoc: GeneratedDoc = {
          filename: data.filename,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          url: downloadUrl,
        };

        setGeneratedDocs((prev) => [newDoc, ...prev]);
        setAlert({
          type: 'success',
          message: `فایل «${data.filename}» با فرمول‌های واقعی و معتبر Word OMML با موفقیت آماده و دانلود شد.`,
          downloadUrl,
          filename: data.filename,
        });
      } else {
        setAlert({
          type: 'error',
          message: data.error || 'خطا در تبدیل فرمول‌های ریاضی به Word',
        });
      }
    } catch (err: any) {
      setAlert({
        type: 'error',
        message: `خطای ارتباط با سرور: ${err.message || 'عدم دسترسی به سرویس پایتون'}`,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoFormatFormulas = () => {
    const { text: formatted, count } = autoDetectAndWrapMath(content);
    if (count > 0) {
      setContent(formatted);
      setAlert({
        type: 'success',
        message: `${count} فرمول و نماد محاسباتی خام با موفقیت شناسایی و به ساختار استاندارد ریاضی ($...$) تبدیل گردید.`,
      });
    } else {
      setAlert({
        type: 'success',
        message: 'تمامی فرمول‌های متن استاندارد هستند یا رابطه جدیدی برای تبدیل یافت نشد.',
      });
    }
  };

  const isRtl = /[\u0600-\u06FF]/.test(content);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* Top Navigation */}
      <Header
        onOpenPresets={() => setShowPresets(true)}
        onOpenHelp={() => setShowHelp(true)}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        canGenerate={content.trim().length > 0}
        filename={filename}
        setFilename={setFilename}
      />

      {/* Notification Banner */}
      {alert && (
        <div
          className={`px-4 py-3 text-xs flex items-center justify-between border-b animate-in fade-in duration-150 ${
            alert.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span className="font-medium">{alert.message}</span>
            {alert.downloadUrl && (
              <a
                href={alert.downloadUrl}
                download={alert.filename}
                className="mr-auto underline font-semibold flex items-center gap-1 hover:text-white"
              >
                <Download className="w-3 h-3" />
                <span>دانلود مجدد فایل</span>
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAlert(null)}
            className="text-slate-400 hover:text-white text-xs font-mono px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-4">
        {/* Toggle & Utilities Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowConverter(!showConverter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                showConverter
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>مبدل کدهای محاسباتی و جدول Word</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCorrector(!showCorrector)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition shadow-sm ${
                showCorrector
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>اصلاح‌کننده هوشمند فرمول‌ها</span>
              {formulaIssues.length > 0 && (
                <span className="bg-rose-600 text-white font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {formulaIssues.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleAutoFormatFormulas}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30 transition shadow-sm"
              title="تشخیص هوشمند و استانداردسازی تمام فرمول‌های خام به لاتک"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>تبدیل خودکار فرمول‌های خام</span>
            </button>

            <span className="text-slate-700 hidden sm:inline">|</span>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                  viewMode === 'split'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="نمایش دو ستونه (ویرایشگر + پیش‌نمایش)"
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">نمای همزمان</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                  viewMode === 'editor'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="فقط ویرایشگر"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ویرایشگر</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${
                  viewMode === 'preview'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="فقط پیش‌نمایش"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">پیش‌نمایش</span>
              </button>
            </div>
          </div>

          {/* Editor Action Shortcuts */}
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              title="کپی کردن متن"
            >
              <Copy className="w-3 h-3" />
              <span>کپی متن</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/60 transition"
              title="پاکسازی متن"
            >
              <Trash2 className="w-3 h-3" />
              <span>پاک‌کردن</span>
            </button>
          </div>
        </div>

        {/* Computational Converter Section (Collapsible) */}
        {showConverter && (
          <ComputationalConverter onInsertToDoc={handleInsertSnippet} />
        )}

        {/* Quick Math Symbols Palette */}
        <SymbolPalette onInsert={handleInsertSnippet} />

        {/* Smart Formula Corrector Section */}
        <FormulaCorrector
          documentContent={content}
          onUpdateDocumentContent={(newContent) => {
            setContent(newContent);
            setAlert({
              type: 'success',
              message: 'فرمول‌های سند با موفقیت به نزدیک‌ترین نگارش معتبر اصلاح شدند.',
            });
            setTimeout(() => setAlert(null), 3000);
          }}
          onInsertSnippet={handleInsertSnippet}
          isOpen={showCorrector}
          onToggle={() => setShowCorrector(!showCorrector)}
        />

        {/* Workspace Editors/Preview Panes */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[500px]">
          {/* Editor Column */}
          {(viewMode === 'split' || viewMode === 'editor') && (
            <div
              className={`flex flex-col bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm ${
                viewMode === 'editor' ? 'lg:col-span-2' : ''
              }`}
            >
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-slate-200">
                    ویرایشگر متن، فرمول و نشانه‌گذاری
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                  <span>{content.split('\n').length} سطر</span>
                  <span>{content.length} کاراکتر</span>
                </div>
              </div>

              <HighlightedEditor
                value={content}
                onChange={setContent}
                isRtl={isRtl}
                textareaRef={textareaRef}
                placeholder="متن خود را به همراه فرمول‌های ریاضی بنویسید...&#10;مثال فرمول درون متن: $E = mc^2$&#10;مثال فرمول شاخص بلوکی:&#10;$$\int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$&#10;مثال ماتریس یا آرایه لاتک:&#10;$$\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}$$"
              />
            </div>
          )}

          {/* Preview Column */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div
              className={`flex flex-col min-h-[400px] ${
                viewMode === 'preview' ? 'lg:col-span-2' : ''
              }`}
            >
              <MathPreview
                content={content}
                onFixFormula={(origFormula, fixedFormula, isDisplay) => {
                  const cleanOrig = origFormula.replace(/^\$+|\$+$/g, '').trim();
                  const escapedOrig = cleanOrig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                  let updated = content;
                  let replaced = false;

                  if (isDisplay) {
                    // Match $$ ... $$ or \[ ... \] with flexible whitespace and optional inner $
                    const regDisplay = new RegExp(
                      `(?:\\$\\$|\\\\\\[)[\\s\\r\\n]*\\$?[\\s\\r\\n]*${escapedOrig}[\\s\\r\\n]*\\$?[\\s\\r\\n]*(?:\\$\\$|\\\\\\])`
                    );
                    if (regDisplay.test(updated)) {
                      updated = updated.replace(regDisplay, () => `$$\n${fixedFormula}\n$$`);
                      replaced = true;
                    }
                  } else {
                    // Inline $ ... $ or \( ... \)
                    const regInline = new RegExp(
                      `(?:\\$|\\\\\\()[\\s\\r\\n]*${escapedOrig}[\\s\\r\\n]*(?:\\$|\\\\\\))`
                    );
                    if (regInline.test(updated)) {
                      updated = updated.replace(regInline, () => `$${fixedFormula}$`);
                      replaced = true;
                    }
                  }

                  // Fallback: match any surrounding math delimiters
                  if (!replaced) {
                    const regAnyMath = new RegExp(
                      `(\\$\\$|\\$|\\\\\\[|\\\\\\()[\\s\\r\\n]*\\$?[\\s\\r\\n]*${escapedOrig}[\\s\\r\\n]*\\$?[\\s\\r\\n]*(\\$\\$|\\$|\\\\\\]|\\\\\\))`
                    );
                    if (regAnyMath.test(updated)) {
                      updated = updated.replace(regAnyMath, () =>
                        isDisplay ? `$$\n${fixedFormula}\n$$` : `$${fixedFormula}$`
                      );
                      replaced = true;
                    }
                  }

                  if (replaced) {
                    setContent(updated);
                    setAlert({
                      type: 'success',
                      message: 'فرمول با موفقیت به نزدیک‌ترین معادل معتبر اصلاح شد.',
                    });
                    setTimeout(() => setAlert(null), 3000);
                  } else {
                    setAlert({
                      type: 'error',
                      message: 'موقعیت فرمول در متن تغییر کرده یا یافت نشد.',
                    });
                    setTimeout(() => setAlert(null), 3000);
                  }
                }}
                onOpenCorrector={() => setShowCorrector(true)}
              />
            </div>
          )}
        </div>

        {/* Recently Generated Documents History */}
        <HistoryDownloads docs={generatedDocs} />
      </main>

      {/* Modals */}
      <PresetsDrawer
        isOpen={showPresets}
        onClose={() => setShowPresets(false)}
        onSelect={handleSelectPreset}
      />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
