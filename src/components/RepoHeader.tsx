import React from 'react';
import { GitBranch, FolderGit2, Activity, Terminal, ShieldCheck, RefreshCw } from 'lucide-react';

interface RepoHeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  activeCount: number;
  totalTasks: number;
  completedTasks: number;
}

export const RepoHeader: React.FC<RepoHeaderProps> = ({
  onRefresh,
  isRefreshing,
  activeCount,
  totalTasks,
  completedTasks,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-lg shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">Vaz Workspace</h1>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 font-mono">
                  <FolderGit2 className="w-3.5 h-3.5" /> amir-a-z/vaz
                </span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1 font-mono">
                  <GitBranch className="w-3.5 h-3.5" /> main
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Node.js 22 Runtime</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
              <span className="text-slate-400">Progress:</span>
              <span className="font-semibold text-slate-200">
                {completedTasks}/{totalTasks} tasks
              </span>
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden ml-1">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <button
              id="refresh-workspace-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95 disabled:opacity-50"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
