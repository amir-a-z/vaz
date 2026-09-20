import React, { useState } from 'react';
import { Sparkles, Hash, Calculator, Pi, Layers, ChevronDown, ChevronUp } from 'lucide-react';

interface SymbolPaletteProps {
  onInsert: (snippet: string) => void;
}

interface PaletteGroup {
  name: string;
  icon: React.ReactNode;
  items: { label: string; snippet: string; tooltip?: string }[];
}

export const SymbolPalette: React.FC<SymbolPaletteProps> = ({ onInsert }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const groups: PaletteGroup[] = [
    {
      name: 'ساختارها',
      icon: <Calculator className="w-3.5 h-3.5" />,
      items: [
        { label: 'a/b', snippet: '\\frac{a}{b}', tooltip: 'کسر ریاضی' },
        { label: '√x', snippet: '\\sqrt{x}', tooltip: 'رادیکال / جذر' },
        { label: 'ⁿ√x', snippet: '\\sqrt[n]{x}', tooltip: 'ریشه n‌ام' },
        { label: 'xⁿ', snippet: 'x^{n}', tooltip: 'توان' },
        { label: 'xᵢ', snippet: 'x_{i}', tooltip: 'زیرنویس / اندیس' },
        { label: 'xᵢⁿ', snippet: 'x_{i}^{n}', tooltip: 'اندیس و توان' },
        { label: '(...)', snippet: '\\left( \\frac{a}{b} \\right)', tooltip: 'پرانتز متناسب' },
        { label: '[...]', snippet: '\\left[ \\frac{a}{b} \\right]', tooltip: 'کروشه متناسب' },
        { label: '{...}', snippet: '\\left\\{ x \\in \\mathbb{R} \\right\\}', tooltip: 'آکولاد' },
        { label: '|x|', snippet: '\\left| x \\right|', tooltip: 'قدر مطلق' },
        { label: 'ماتریس', snippet: '\\begin{pmatrix}\na & b \\\\\nc & d\n\\end{pmatrix}', tooltip: 'ماتریس پرانتزی' },
        { label: 'دستگاه چندضابطه‌ای', snippet: 'f(x) = \\begin{cases}\nx^2 & x \\ge 0 \\\\\n-x & x < 0\n\\end{cases}', tooltip: 'تابع چند ضابطه‌ای' },
      ],
    },
    {
      name: 'حسابان و آنالیز',
      icon: <Layers className="w-3.5 h-3.5" />,
      items: [
        { label: '∫', snippet: '\\int f(x) \\, dx', tooltip: 'انتگرال نامعین' },
        { label: '∫ₐᵇ', snippet: '\\int_{a}^{b} f(x) \\, dx', tooltip: 'انتگرال معین' },
        { label: '∬', snippet: '\\iint_{D} f(x, y) \\, dA', tooltip: 'انتگرال دوگانه' },
        { label: '∑', snippet: '\\sum_{i=1}^{n} a_i', tooltip: 'مجموع (سیگما)' },
        { label: '∏', snippet: '\\prod_{i=1}^{n} x_i', tooltip: 'ضرب پیوسته' },
        { label: 'lim', snippet: '\\lim_{x \\to 0} \\frac{\\sin x}{x}', tooltip: 'حد' },
        { label: '∂/∂x', snippet: '\\frac{\\partial y}{\\partial x}', tooltip: 'مشتق جزئی' },
        { label: 'd/dx', snippet: '\\frac{d y}{d x}', tooltip: 'مشتق معمولی' },
        { label: '∇', snippet: '\\nabla', tooltip: 'نابلا / گرادیان' },
        { label: '∞', snippet: '\\infty', tooltip: 'بی‌نهایت' },
      ],
    },
    {
      name: 'حروف یونانی',
      icon: <Pi className="w-3.5 h-3.5" />,
      items: [
        { label: 'α', snippet: '\\alpha', tooltip: 'آلفا' },
        { label: 'β', snippet: '\\beta', tooltip: 'بتا' },
        { label: 'γ', snippet: '\\gamma', tooltip: 'گاما' },
        { label: 'δ', snippet: '\\delta', tooltip: 'دلتا' },
        { label: 'ε', snippet: '\\varepsilon', tooltip: 'اپسیلون' },
        { label: 'θ', snippet: '\\theta', tooltip: 'تتا' },
        { label: 'λ', snippet: '\\lambda', tooltip: 'لاندا' },
        { label: 'μ', snippet: '\\mu', tooltip: 'میو' },
        { label: 'π', snippet: '\\pi', tooltip: 'پی' },
        { label: 'σ', snippet: '\\sigma', tooltip: 'سیگما' },
        { label: 'φ', snippet: '\\phi', tooltip: 'فی' },
        { label: 'ω', snippet: '\\omega', tooltip: 'امگا' },
        { label: 'Δ', snippet: '\\Delta', tooltip: 'دلتا بزرگ' },
        { label: 'Σ', snippet: '\\Sigma', tooltip: 'سیگما بزرگ' },
        { label: 'Ω', snippet: '\\Omega', tooltip: 'امگا بزرگ' },
      ],
    },
    {
      name: 'عملگرها و روابط',
      icon: <Hash className="w-3.5 h-3.5" />,
      items: [
        { label: '±', snippet: '\\pm', tooltip: 'مثبت یا منفی' },
        { label: '×', snippet: '\\times', tooltip: 'ضرب' },
        { label: '·', snippet: '\\cdot', tooltip: 'نقطه ضرب' },
        { label: '÷', snippet: '\\div', tooltip: 'تقسیم' },
        { label: '≤', snippet: '\\le', tooltip: 'کوچک‌تر یا مساوی' },
        { label: '≥', snippet: '\\ge', tooltip: 'بزرگ‌تر یا مساوی' },
        { label: '≠', snippet: '\\neq', tooltip: 'نامساوی' },
        { label: '≈', snippet: '\\approx', tooltip: 'تقریباً برابر' },
        { label: '≡', snippet: '\\equiv', tooltip: 'هم‌نهشت' },
        { label: '→', snippet: '\\rightarrow', tooltip: 'پیکان راست' },
        { label: '⇒', snippet: '\\Rightarrow', tooltip: 'نتیجه می‌دهد' },
        { label: '⇔', snippet: '\\iff', tooltip: 'اگر و فقط اگر' },
        { label: '∈', snippet: '\\in', tooltip: 'عضو است' },
        { label: '∀', snippet: '\\forall', tooltip: 'به ازای هر' },
        { label: '∃', snippet: '\\exists', tooltip: 'وجود دارد' },
      ],
    },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>پالت درج سریع فرمول و نمادهای ریاضی</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
            {groups.map((g, idx) => (
              <button
                key={g.name}
                type="button"
                onClick={() => {
                  setActiveTab(idx);
                  setIsCollapsed(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition ${
                  activeTab === idx && !isCollapsed
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {g.icon}
                <span>{g.name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            title={isCollapsed ? 'باز کردن پالت' : 'بستن پالت'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-2.5 flex flex-wrap gap-1.5 bg-slate-950/40 max-h-36 overflow-y-auto">
          {groups[activeTab].items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onInsert(item.snippet)}
              title={item.tooltip || item.snippet}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white font-mono text-xs border border-slate-700/60 hover:border-blue-500 transition active:scale-95 flex items-center justify-center min-w-9"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
