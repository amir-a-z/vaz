import React, { useState } from 'react';
import { TaskItem } from '../types';
import { CheckSquare, Square, Plus, Trash2, CheckCircle } from 'lucide-react';

interface TaskTrackerProps {
  tasks: TaskItem[];
  onToggleTask: (id: string) => void;
  onAddTask: (title: string, tag: string) => void;
  onDeleteTask: (id: string) => void;
}

export const TaskTracker: React.FC<TaskTrackerProps> = ({
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
}) => {
  const [newTitle, setNewTitle] = useState('');
  const [newTag, setNewTag] = useState('feature');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), newTag);
    setNewTitle('');
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            Tasks & Action Items
          </h2>
          <p className="text-xs text-slate-400">Manage development checklist and deliverables</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 rounded transition ${filter === 'all' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-2 py-1 rounded transition ${filter === 'pending' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-2 py-1 rounded transition ${filter === 'completed' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Done
          </button>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          id="new-task-input"
          type="text"
          placeholder="Add a new task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          className="bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
          <option value="docs">Docs</option>
          <option value="setup">Setup</option>
        </select>
        <button
          type="submit"
          id="add-task-btn"
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </form>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No tasks found in this view.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition ${
                task.completed
                  ? 'bg-slate-900/30 border-slate-800/60 text-slate-500'
                  : 'bg-slate-800/40 border-slate-800 text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <button
                  onClick={() => onToggleTask(task.id)}
                  className="text-slate-400 hover:text-blue-400 focus:outline-none shrink-0"
                >
                  {task.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <span
                  className={`text-xs truncate ${
                    task.completed ? 'line-through text-slate-500' : ''
                  }`}
                >
                  {task.title}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 uppercase font-semibold">
                  {task.tag}
                </span>
              </div>
              <button
                onClick={() => onDeleteTask(task.id)}
                className="text-slate-500 hover:text-red-400 p-1 ml-2 shrink-0 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
