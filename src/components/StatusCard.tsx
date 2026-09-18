import React, { useState } from 'react';
import { StatusItem } from '../types';
import { CheckCircle2, Clock, PauseCircle, PlayCircle, Plus, Trash2, Tag } from 'lucide-react';

interface StatusSectionProps {
  items: StatusItem[];
  onUpdateStatus: (id: string, newStatus: StatusItem['status']) => void;
  onAddItem: (item: Omit<StatusItem, 'id' | 'updatedAt'>) => void;
  onDeleteItem: (id: string) => void;
}

export const StatusSection: React.FC<StatusSectionProps> = ({
  items,
  onUpdateStatus,
  onAddItem,
  onDeleteItem,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<StatusItem['category']>('core');
  const [priority, setPriority] = useState<StatusItem['priority']>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddItem({
      title: title.trim(),
      description: description.trim() || 'No description provided.',
      category,
      status: 'planned',
      priority,
    });
    setTitle('');
    setDescription('');
    setShowAddForm(false);
  };

  const getStatusBadge = (status: StatusItem['status']) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Operational
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 animate-spin" /> In Progress
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
            <PauseCircle className="w-3 h-3" /> Paused
          </span>
        );
      case 'planned':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <PlayCircle className="w-3 h-3" /> Planned
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            Status Board (وضع پروژه)
          </h2>
          <p className="text-xs text-slate-400">Track and manage the real-time operational condition of Vaz modules</p>
        </div>
        <button
          id="toggle-add-status-btn"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Module</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-5 p-4 rounded-lg bg-slate-800/70 border border-slate-700/60 space-y-3">
          <div className="text-xs font-semibold text-slate-300">Add New System Module</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              id="status-module-title"
              type="text"
              placeholder="Module Name (e.g. Authentication API)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              required
            />
            <input
              id="status-module-desc"
              type="text"
              placeholder="Short Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Tag className="w-3 h-3" /> Category:
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StatusItem['category'])}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="core">Core</option>
                <option value="service">Service</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="docs">Docs</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              Priority:
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as StatusItem['priority'])}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-200">{item.title}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {item.category}
                  </span>
                </div>
                {getStatusBadge(item.status)}
              </div>
              <p className="text-xs text-slate-400 mb-3">{item.description}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Update status:</span>
                <select
                  value={item.status}
                  onChange={(e) => onUpdateStatus(item.id, e.target.value as StatusItem['status'])}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                >
                  <option value="operational">Operational</option>
                  <option value="in_progress">In Progress</option>
                  <option value="planned">Planned</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <button
                onClick={() => onDeleteItem(item.id)}
                className="text-slate-500 hover:text-red-400 transition p-1"
                title="Remove module"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
