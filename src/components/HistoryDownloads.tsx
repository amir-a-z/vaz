import React from 'react';
import { GeneratedDoc } from '../types';
import { FileText, Download, Clock } from 'lucide-react';

interface HistoryDownloadsProps {
  docs: GeneratedDoc[];
}

export const HistoryDownloads: React.FC<HistoryDownloadsProps> = ({ docs }) => {
  if (docs.length === 0) return null;

  const handleDownload = async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }, 100);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>فایل‌های Word تولیدشده در این نشست:</span>
        </span>
        <span className="text-[11px] text-slate-400">
          {docs.length} فایل آماده دریافت
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {docs.map((doc, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg hover:border-slate-700 transition"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-mono text-slate-200 truncate" title={doc.filename}>
                  {doc.filename}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {doc.timestamp}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDownload(doc.url, doc.filename)}
              className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white shrink-0 shadow-sm transition"
              title="دانلود مستقیم فایل Word"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
