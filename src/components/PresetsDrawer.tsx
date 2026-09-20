import React from 'react';
import { PRESETS } from '../data/presets';
import { PresetTemplate } from '../types';
import { BookOpen, Sparkles, X } from 'lucide-react';

interface PresetsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preset: PresetTemplate) => void;
}

export const PresetsDrawer: React.FC<PresetsDrawerProps> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">نمونه‌های آماده اسناد علمی و محاسباتی</h2>
              <p className="text-xs text-slate-400">یک قالب آماده را برای تست مستقیم تبدیل به Word انتخاب کنید</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Presets */}
        <div className="p-5 overflow-y-auto space-y-3">
          {PRESETS.map((preset) => (
            <div
              key={preset.id}
              onClick={() => {
                onSelect(preset);
                onClose();
              }}
              className="group p-4 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-blue-500/50 rounded-xl cursor-pointer transition flex items-start justify-between gap-4"
            >
              <div className="space-y-1 text-right">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition text-sm">
                    {preset.titleFa}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {preset.titleEn}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {preset.desc}
                </p>
              </div>

              <button
                type="button"
                className="mt-1 shrink-0 px-3 py-1.5 rounded-lg bg-slate-800 group-hover:bg-blue-600 text-slate-300 group-hover:text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>بارگذاری در ویرایشگر</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
