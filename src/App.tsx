import React, { useState, useEffect } from 'react';
import { RepoHeader } from './components/RepoHeader';
import { StatusSection } from './components/StatusCard';
import { TaskTracker } from './components/TaskTracker';
import { NotesPad } from './components/NotesPad';
import { ActivityFeed } from './components/ActivityFeed';
import { StatusItem, TaskItem, DevNote, ActivityEvent } from './types';
import { Layers, Server, Code, Sparkles } from 'lucide-react';

const INITIAL_STATUS_ITEMS: StatusItem[] = [
  {
    id: '1',
    title: 'Core Architecture',
    description: 'Foundational framework and runtime initialization for Vaz',
    category: 'core',
    status: 'operational',
    priority: 'high',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'API Gateway & Services',
    description: 'Interface contracts, handlers, and endpoints',
    category: 'service',
    status: 'in_progress',
    priority: 'high',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'State & Persistence Store',
    description: 'Client cache, local data models, and synchronization',
    category: 'infrastructure',
    status: 'operational',
    priority: 'medium',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Documentation & Specs',
    description: 'Project README, guides, and architectural diagrams',
    category: 'docs',
    status: 'planned',
    priority: 'low',
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_TASKS: TaskItem[] = [
  { id: 't1', title: 'Initialize Vaz workspace on Node.js 22 runtime', completed: true, tag: 'setup', createdAt: new Date().toISOString() },
  { id: 't2', title: 'Draft project specifications in scratchpad', completed: true, tag: 'docs', createdAt: new Date().toISOString() },
  { id: 't3', title: 'Implement core modules and state machine', completed: false, tag: 'feature', createdAt: new Date().toISOString() },
  { id: 't4', title: 'Setup automated deployment & testing workflow', completed: false, tag: 'setup', createdAt: new Date().toISOString() },
];

const INITIAL_NOTES: DevNote[] = [
  {
    id: 'n1',
    title: 'Project Overview (Vaz)',
    content: `# Vaz Project Architecture\n\n- Imported from: github.com/amir-a-z/vaz\n- Runtime: Node.js 22 + React 18 + Vite\n- Focus: Streamlined status tracking, modular development, and reactive state management.\n\nNext Steps:\n1. Define primary domain data models.\n2. Add custom business logic modules.\n3. Configure cloud integration when needed.`,
    updatedAt: new Date().toISOString(),
  },
];

export function App() {
  const [statusItems, setStatusItems] = useState<StatusItem[]>(() => {
    try {
      const saved = localStorage.getItem('vaz_status_items');
      return saved ? JSON.parse(saved) : INITIAL_STATUS_ITEMS;
    } catch {
      return INITIAL_STATUS_ITEMS;
    }
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('vaz_tasks');
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [notes, setNotes] = useState<DevNote[]>(() => {
    try {
      const saved = localStorage.getItem('vaz_notes');
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });

  const [activity, setActivity] = useState<ActivityEvent[]>(() => {
    try {
      const saved = localStorage.getItem('vaz_activity');
      return saved ? JSON.parse(saved) : [
        {
          id: 'init-1',
          text: 'Vaz workspace successfully initialized and mounted on port 3000.',
          timestamp: new Date().toISOString(),
          type: 'system',
        },
      ];
    } catch {
      return [];
    }
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    localStorage.setItem('vaz_status_items', JSON.stringify(statusItems));
  }, [statusItems]);

  useEffect(() => {
    localStorage.setItem('vaz_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('vaz_notes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('vaz_activity', JSON.stringify(activity));
  }, [activity]);

  const logEvent = (text: string, type: ActivityEvent['type']) => {
    const newEvent: ActivityEvent = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toISOString(),
      type,
    };
    setActivity((prev) => [newEvent, ...prev.slice(0, 49)]);
  };

  const handleUpdateStatus = (id: string, newStatus: StatusItem['status']) => {
    setStatusItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          logEvent(`Updated status of "${item.title}" to ${newStatus}.`, 'status');
          return { ...item, status: newStatus, updatedAt: new Date().toISOString() };
        }
        return item;
      })
    );
  };

  const handleAddStatusItem = (item: Omit<StatusItem, 'id' | 'updatedAt'>) => {
    const newItem: StatusItem = {
      ...item,
      id: Date.now().toString(),
      updatedAt: new Date().toISOString(),
    };
    setStatusItems((prev) => [...prev, newItem]);
    logEvent(`Added new module: "${newItem.title}".`, 'status');
  };

  const handleDeleteStatusItem = (id: string) => {
    const item = statusItems.find((i) => i.id === id);
    if (item) {
      logEvent(`Removed module: "${item.title}".`, 'status');
    }
    setStatusItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextCompleted = !t.completed;
          logEvent(`${nextCompleted ? 'Completed' : 'Reopened'} task: "${t.title}".`, 'task');
          return { ...t, completed: nextCompleted };
        }
        return t;
      })
    );
  };

  const handleAddTask = (title: string, tag: string) => {
    const newTask: TaskItem = {
      id: Date.now().toString(),
      title,
      completed: false,
      tag,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
    logEvent(`Added new task: "${title}".`, 'task');
  };

  const handleDeleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (task) {
      logEvent(`Deleted task: "${task.title}".`, 'task');
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddNote = (title: string, content: string) => {
    const newNote: DevNote = {
      id: Date.now().toString(),
      title,
      content,
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [newNote, ...prev]);
    logEvent(`Created note: "${title}".`, 'note');
  };

  const handleUpdateNote = (id: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n))
    );
  };

  const handleDeleteNote = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (note) {
      logEvent(`Deleted note: "${note.title}".`, 'note');
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    logEvent('Refreshed workspace and synchronized system state.', 'system');
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const operationalCount = statusItems.filter((i) => i.status === 'operational').length;
  const completedTasks = tasks.filter((t) => t.completed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <RepoHeader
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        activeCount={operationalCount}
        totalTasks={tasks.length}
        completedTasks={completedTasks}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Quick-strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Operational</div>
              <div className="text-lg font-bold text-slate-100">{operationalCount}/{statusItems.length}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Open Tasks</div>
              <div className="text-lg font-bold text-slate-100">{tasks.length - completedTasks}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Notes & Specs</div>
              <div className="text-lg font-bold text-slate-100">{notes.length}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Environment</div>
              <div className="text-sm font-semibold text-slate-200 truncate">Vite + React</div>
            </div>
          </div>
        </div>

        {/* Primary Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <StatusSection
              items={statusItems}
              onUpdateStatus={handleUpdateStatus}
              onAddItem={handleAddStatusItem}
              onDeleteItem={handleDeleteStatusItem}
            />

            <NotesPad
              notes={notes}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>

          <div className="lg:col-span-5 space-y-6">
            <TaskTracker
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
            />

            <ActivityFeed
              events={activity}
              onClear={() => setActivity([])}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-600">
        Vaz Workspace • Built for amir-a-z/vaz • AI Studio Node 22 Web Runtime
      </footer>
    </div>
  );
}

export default App;
