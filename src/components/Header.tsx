import React, { useState, useEffect } from 'react';
import { FileDown, Sparkles, HelpCircle, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onOpenPresets: () => void;
  onOpenHelp: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  filename: string;
  setFilename: (name: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPresets,
  onOpenHelp,
  onGenerate,
  isGenerating,
  canGenerate,
  filename,
  setFilename,
}) => {
  const [engineStatus, setEngineStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          if (isMounted) setEngineStatus('online');
        } else {
          if (isMounted) setEngineStatus('offline');
        }
      } catch {
        if (isMounted) setEngineStatus('offline');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 lg:px-6 py-3 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Title and Badge */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-base">
              ∑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-100 tracking-tight">
                  Vaz
                </h1>
                <span className="text-xs text-slate-400 font-normal">|</span>
                <span className="text-xs font-medium text-slate-300">
                  تبدیل کدهای محاسباتی و لاتکس به فرمول‌های ورد (OMML)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                پشتیبانی از متون فارسی، فرمول‌های چندخطی، نمادهای پیشرفته و جداول
              </p>
            </div>
          </div>

          {/* Engine Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              engineStatus === 'online'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : engineStatus === 'offline'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {engineStatus === 'online' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>موتور پایتون فعال</span>
              </>
            ) : engineStatus === 'offline' ? (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>در حال آماده‌سازی موتور...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>بررسی اتصال...</span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={onOpenPresets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>نمونه‌های آماده</span>
          </button>

          <button
            type="button"
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
            title="راهنمای نگارش فرمول‌ها"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>راهنما</span>
          </button>

          {/* Filename input */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg overflow-hidden text-xs">
            <input
              type="text"
              dir="ltr"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="نام فایل خروجی"
              className="px-2.5 py-1.5 bg-transparent text-slate-200 font-mono text-xs outline-none w-32 md:w-36 text-left"
            />
            <span className="bg-slate-800/80 px-2 py-1.5 text-slate-400 font-mono text-[11px] border-r border-slate-800">
              .docx
            </span>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition ${
              !canGenerate || isGenerating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 active:scale-95'
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>در حال ساخت فایل ورد...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>تولید و دانلود Word (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
