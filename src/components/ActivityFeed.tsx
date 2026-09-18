import React from 'react';
import { ActivityEvent } from '../types';
import { Terminal, Clock } from 'lucide-react';

interface ActivityFeedProps {
  events: ActivityEvent[];
  onClear: () => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events, onClear }) => {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Event & Audit Log
        </h2>
        {events.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            Clear log
          </button>
        )}
      </div>

      <div className="font-mono text-xs space-y-2 max-h-48 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="text-slate-500 py-3 text-center">No recent events logged.</div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-2 text-slate-400 border-b border-slate-800/40 pb-1.5"
            >
              <span className="text-slate-500 text-[10px] shrink-0 pt-0.5">
                [{new Date(ev.timestamp).toLocaleTimeString()}]
              </span>
              <span
                className={`text-[10px] uppercase px-1 rounded font-bold shrink-0 ${
                  ev.type === 'status'
                    ? 'bg-amber-500/10 text-amber-400'
                    : ev.type === 'task'
                    ? 'bg-blue-500/10 text-blue-400'
                    : ev.type === 'note'
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'bg-emerald-500/10 text-emerald-400'
                }`}
              >
                {ev.type}
              </span>
              <span className="text-slate-300 break-all">{ev.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
