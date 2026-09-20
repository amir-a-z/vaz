import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Sparkles, Eye, Code2 } from 'lucide-react';

interface HighlightedEditorProps {
  value: string;
  onChange: (val: string) => void;
  isRtl: boolean;
  placeholder?: string;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}

// Math command classifications for distinctive styling
const GREEK_COMMANDS = new Set([
  '\\alpha', '\\beta', '\\gamma', '\\delta', '\\epsilon', '\\varepsilon',
  '\\zeta', '\\eta', '\\theta', '\\vartheta', '\\iota', '\\kappa',
  '\\lambda', '\\mu', '\\nu', '\\xi', '\\pi', '\\varpi', '\\rho',
  '\\sigma', '\\tau', '\\upsilon', '\\phi', '\\varphi', '\\chi',
  '\\psi', '\\omega', '\\Gamma', '\\Delta', '\\Theta', '\\Lambda',
  '\\Xi', '\\Pi', '\\Sigma', '\\Phi', '\\Psi', '\\Omega',
]);

const FUNCTION_AND_OPERATOR_COMMANDS = new Set([
  '\\frac', '\\cfrac', '\\sqrt', '\\sum', '\\int', '\\iint', '\\iiint',
  '\\oint', '\\prod', '\\coprod', '\\lim', '\\partial', '\\nabla',
  '\\sin', '\\cos', '\\tan', '\\cot', '\\sec', '\\csc',
  '\\ln', '\\log', '\\exp', '\\to', '\\rightarrow', '\\leftarrow',
  '\\times', '\\cdot', '\\pm', '\\mp', '\\le', '\\ge', '\\neq',
  '\\approx', '\\equiv', '\\infty', '\\vec', '\\hat', '\\bar',
  '\\dot', '\\ddot', '\\in', '\\subset', '\\forall', '\\exists',
  '\\text', '\\mathbf', '\\mathrm',
]);

const STRUCTURE_COMMANDS = new Set([
  '\\begin', '\\end', '\\hline',
]);

export const HighlightedEditor: React.FC<HighlightedEditorProps> = ({
  value,
  onChange,
  isRtl,
  placeholder,
  textareaRef: externalRef,
}) => {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const [isHighlightEnabled, setIsHighlightEnabled] = useState<boolean>(true);

  const activeTextareaRef = externalRef || internalRef;

  // Sync scroll positions between transparent textarea and highlighting backdrop
  const handleScroll = () => {
    if (!activeTextareaRef.current || !backdropRef.current) return;
    backdropRef.current.scrollTop = activeTextareaRef.current.scrollTop;
    backdropRef.current.scrollLeft = activeTextareaRef.current.scrollLeft;
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  // Syntax highlighting tokenizer preserving 100% exact text and whitespace
  const highlightedTokens = useMemo(() => {
    if (!isHighlightEnabled) return null;

    // Tokenize text into Math blocks ($$...$$ and $...$) and Plain text
    // Regex matches: $$...$$ OR $...$ OR any other text
    const mathBlockRegex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const renderMathContent = (mathText: string, isBlock: boolean, keyPrefix: string) => {
      // Delimiters
      const delimiter = isBlock ? '$$' : '$';
      const innerContent = mathText.slice(delimiter.length, mathText.length - delimiter.length);

      const mathChildren: React.ReactNode[] = [];

      // Tokenize inner math: commands (\abc), braces {}, numbers, matrix symbols (&, \\)
      const tokenRegex = /(\\[a-zA-Z]+|\\[^a-zA-Z]|[\{\}\[\]\(\)]|\&|\\\\|\d+(?:\.\d+)?|[\+\-\*\/\=\^\_]|[\s]+|[^\s\\\{\}\[\]\(\)\&]+)/g;
      let tokenMatch: RegExpExecArray | null;
      let tokenIdx = 0;

      while ((tokenMatch = tokenRegex.exec(innerContent)) !== null) {
        const token = tokenMatch[0];
        const tokenKey = `${keyPrefix}-tok-${tokenIdx++}`;

        if (token.startsWith('\\')) {
          if (STRUCTURE_COMMANDS.has(token)) {
            mathChildren.push(
              <span key={tokenKey} className="text-cyan-300 font-bold bg-cyan-950/30 rounded px-0.5">
                {token}
              </span>
            );
          } else if (GREEK_COMMANDS.has(token)) {
            mathChildren.push(
              <span key={tokenKey} className="text-rose-400 font-medium">
                {token}
              </span>
            );
          } else if (FUNCTION_AND_OPERATOR_COMMANDS.has(token)) {
            mathChildren.push(
              <span key={tokenKey} className="text-sky-400 font-semibold">
                {token}
              </span>
            );
          } else {
            mathChildren.push(
              <span key={tokenKey} className="text-blue-300">
                {token}
              </span>
            );
          }
        } else if (token === '{' || token === '}') {
          mathChildren.push(
            <span key={tokenKey} className="text-amber-300/90 font-bold">
              {token}
            </span>
          );
        } else if (token === '[' || token === ']' || token === '(' || token === ')') {
          mathChildren.push(
            <span key={tokenKey} className="text-indigo-300 font-semibold">
              {token}
            </span>
          );
        } else if (token === '&' || token === '\\\\') {
          mathChildren.push(
            <span key={tokenKey} className="text-teal-400 font-bold bg-teal-950/40 px-0.5 rounded">
              {token}
            </span>
          );
        } else if (/^\d+(?:\.\d+)?$/.test(token)) {
          mathChildren.push(
            <span key={tokenKey} className="text-emerald-300">
              {token}
            </span>
          );
        } else if (/^[\+\-\*\/\=\^\_]$/.test(token)) {
          mathChildren.push(
            <span key={tokenKey} className="text-amber-400 font-bold">
              {token}
            </span>
          );
        } else {
          // Regular variable, letters or spaces in math
          mathChildren.push(
            <span key={tokenKey} className="text-slate-100">
              {token}
            </span>
          );
        }
      }

      return (
        <span
          key={keyPrefix}
          dir="ltr"
          className={
            isBlock
              ? 'inline-block my-0.5 px-1 py-0.5 rounded bg-blue-950/40 border border-blue-800/40 text-blue-100'
              : 'inline px-1 py-0.2 rounded bg-emerald-950/30 border border-emerald-800/30 text-emerald-100'
          }
        >
          {/* Opening Delimiter */}
          <span
            className={
              isBlock
                ? 'text-amber-400 font-bold bg-amber-500/20 px-1 py-0.2 rounded mr-0.5'
                : 'text-emerald-400 font-semibold bg-emerald-500/15 px-0.5 rounded mr-0.5'
            }
          >
            {delimiter}
          </span>

          {/* Rendered Math Content */}
          {mathChildren}

          {/* Closing Delimiter */}
          <span
            className={
              isBlock
                ? 'text-amber-400 font-bold bg-amber-500/20 px-1 py-0.2 rounded ml-0.5'
                : 'text-emerald-400 font-semibold bg-emerald-500/15 px-0.5 rounded ml-0.5'
            }
          >
            {delimiter}
          </span>
        </span>
      );
    };

    const renderPlainTextWithMarkdown = (text: string, prefix: string) => {
      // Split by lines to style markdown headers (#, ##), tables (|), quotes (>), and lists (-)
      const lines = text.split('\n');
      return lines.map((line, lineIdx) => {
        const isLastLine = lineIdx === lines.length - 1;
        const lineKey = `${prefix}-line-${lineIdx}`;

        let styledLine: React.ReactNode;

        if (/^#{1,6}\s/.test(line)) {
          styledLine = (
            <span className="text-indigo-300 font-semibold">
              <span className="text-indigo-400 font-bold">
                {line.match(/^#{1,6}\s/)?.[0]}
              </span>
              {line.replace(/^#{1,6}\s/, '')}
            </span>
          );
        } else if (/^\|.*\|$/.test(line.trim())) {
          // Markdown Table row
          styledLine = (
            <span className="text-teal-200">
              {line.split('|').map((segment, sIdx, arr) => (
                <React.Fragment key={sIdx}>
                  {segment}
                  {sIdx < arr.length - 1 && (
                    <span className="text-teal-500 font-bold">|</span>
                  )}
                </React.Fragment>
              ))}
            </span>
          );
        } else if (/^[\s]*[-*+]\s/.test(line)) {
          styledLine = (
            <span className="text-slate-200">
              <span className="text-cyan-400 font-bold">
                {line.match(/^[\s]*[-*+]\s/)?.[0]}
              </span>
              {line.replace(/^[\s]*[-*+]\s/, '')}
            </span>
          );
        } else {
          styledLine = <span className="text-slate-300">{line}</span>;
        }

        return (
          <React.Fragment key={lineKey}>
            {styledLine}
            {!isLastLine && '\n'}
          </React.Fragment>
        );
      });
    };

    while ((match = mathBlockRegex.exec(value)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        const textSlice = value.substring(lastIndex, matchIndex);
        parts.push(renderPlainTextWithMarkdown(textSlice, `txt-${lastIndex}`));
      }

      const rawMath = match[0];
      const isBlock = rawMath.startsWith('$$');
      parts.push(renderMathContent(rawMath, isBlock, `math-${matchIndex}`));

      lastIndex = matchIndex + rawMath.length;
    }

    if (lastIndex < value.length) {
      const remaining = value.substring(lastIndex);
      parts.push(renderPlainTextWithMarkdown(remaining, `txt-${lastIndex}`));
    }

    // Trailing newline dummy spacer so cursor on final line aligns with backdrop
    if (value.endsWith('\n')) {
      parts.push('\n ');
    }

    return parts;
  }, [value, isHighlightEnabled]);

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden">
      {/* Highlighting Toolbar Sub-Bar */}
      <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 flex items-center gap-1">
            <Code2 className="w-3 h-3 text-cyan-400" />
            <span>هایلایتر سینتکس لاتک:</span>
          </span>
          <button
            type="button"
            onClick={() => setIsHighlightEnabled(!isHighlightEnabled)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium transition ${
              isHighlightEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>{isHighlightEnabled ? 'فعال (رنگ‌آمیزی $ و دستورات)' : 'غیرفعال (متن ساده)'}</span>
          </button>
        </div>

        {/* Legend pills */}
        <div className="hidden sm:flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>دلیمتر $$ و $</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>دستورات و کسر \frac</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            <span>حروف یونانی \alpha</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>آرایه‌ها \begin</span>
          </span>
        </div>
      </div>

      {/* Editor Container with Synchronized Layers */}
      <div className="relative flex-1 w-full bg-slate-950 min-h-[380px]">
        {/* Layer 1: Highlighting Backdrop (Shown when isHighlightEnabled is true) */}
        {isHighlightEnabled && (
          <div
            ref={backdropRef}
            aria-hidden="true"
            dir={isRtl ? 'rtl' : 'ltr'}
            className="absolute inset-0 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-auto pointer-events-none select-none"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              tabSize: 2,
            }}
          >
            {highlightedTokens}
          </div>
        )}

        {/* Layer 2: Interactive Textarea */}
        <textarea
          ref={(node) => {
            internalRef.current = node;
            if (externalRef) externalRef.current = node;
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          dir={isRtl ? 'rtl' : 'ltr'}
          placeholder={placeholder}
          spellCheck={false}
          className={`absolute inset-0 w-full h-full p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words overflow-auto outline-none resize-none transition ${
            isHighlightEnabled
              ? 'bg-transparent text-transparent caret-cyan-400 selection:bg-blue-600/40 selection:text-white'
              : 'bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white'
          }`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
};
