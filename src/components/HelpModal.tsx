import React from 'react';
import { X, BookOpen, Check, FileCheck } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">راهنمای نگارش و تبدیل فرمول‌های ریاضی به Word</h2>
              <p className="text-xs text-slate-400">فرمت‌های پشتیبانی‌شده و نحوه تبدیل خودکار به فرمول‌های بومی ورد (OMML)</p>
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Section 1 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>فرمول‌های درون‌خطی و بلوکی لاتکس</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              برای فرمول‌های درون متن از علامت یک دلار <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-xs">$E = mc^2$</code> استفاده کنید.
              برای فرمول‌های شاخص و وسط‌چین بلوکی از دو علامت دلار <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-xs">$$ ... $$</code> استفاده نمایید.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>تبدیل کدهای محاسباتی (پایتون، متلب و سیم‌پای)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              اگر فرمول شما در قالب کد محاسباتی مانند <code className="font-mono text-xs text-blue-300">diff(y, x) = (3*x**2 + sqrt(x))/(2*pi)</code> است،
              می‌توانید از بخش «مبدل کدهای محاسباتی» بالای ویرایشگر استفاده کنید تا بلافاصله به فرمول استاندارد ریاضی تبدیل شود.
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs space-y-1 text-slate-400">
              <div>• توان: <span className="text-blue-300">x**2</span> → <span className="text-emerald-400">x^2</span></div>
              <div>• کسر: <span className="text-blue-300">(a + b)/(c + d)</span> → <span className="text-emerald-400">\frac&#123;a + b&#125;&#123;c + d&#125;</span></div>
              <div>• رادیکال: <span className="text-blue-300">sqrt(x)</span> → <span className="text-emerald-400">\sqrt&#123;x&#125;</span></div>
              <div>• نام حروف یونانی: <span className="text-blue-300">alpha, beta, pi, sigma</span> → <span className="text-emerald-400">\alpha, \beta, \pi, \sigma</span></div>
            </div>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>فرمت واقعی فرمول‌ها در ورد (Word OMML)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              این برنامه از تبدیل عکسی استفاده نمی‌کند! خروجی تولیدشده، آبجکت‌های ریاضیاتی استاندارد نرم‌افزار Word (شامل قلم Cambria Math و نمادهای Office Math Markup Language) هستند که در Microsoft Word به سادگی قابل ویرایش، کلیک و تغییر می‌باشند.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h3 className="font-semibold text-blue-400 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              <span>پشتیبانی از جداول و متون فارسی</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              متون فارسی به‌صورت خودکار با قلم رسمی (B Nazanin) و چینش راست‌چین (RTL) قالب‌بندی شده و جداول مارک‌داون به جداول شبکه‌ای منظم و استاندارد Word تبدیل می‌شوند.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
};
