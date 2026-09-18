import React, { useState } from 'react';
import { DevNote } from '../types';
import { FileText, Plus, Trash2, Save } from 'lucide-react';

interface NotesPadProps {
  notes: DevNote[];
  onAddNote: (title: string, content: string) => void;
  onUpdateNote: (id: string, content: string) => void;
  onDeleteNote: (id: string) => void;
}

export const NotesPad: React.FC<NotesPadProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
}) => {
  const [selectedId, setSelectedId] = useState<string>(notes[0]?.id || '');
  const [newTitle, setNewTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const selectedNote = notes.find((n) => n.id === selectedId) || notes[0];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddNote(newTitle.trim(), '');
    setNewTitle('');
    setShowAdd(false);
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Project Scratchpad & Notes
          </h2>
          <p className="text-xs text-slate-400">Document API design, architecture, and notes for Vaz</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Note</span>
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleCreate} className="flex gap-2 mb-4 p-3 bg-slate-800/60 rounded-lg border border-slate-700">
          <input
            type="text"
            placeholder="Note title (e.g., Environment Setup, Roadmap)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium"
          >
            Create
          </button>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500">
          No notes yet. Click 'New Note' to start documenting Vaz.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 md:border-r md:border-slate-800 md:pr-3 max-h-64 overflow-y-auto">
            {notes.map((note) => (
              <div
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className={`p-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition ${
                  (selectedNote?.id === note.id)
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span className="truncate font-medium">{note.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  className="opacity-40 hover:opacity-100 hover:text-red-400 p-0.5 ml-1 transition"
                  title="Delete note"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="md:col-span-2">
            {selectedNote ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
                  <span className="font-semibold text-slate-200">{selectedNote.title}</span>
                  <span className="text-[10px]">Updated: {new Date(selectedNote.updatedAt).toLocaleTimeString()}</span>
                </div>
                <textarea
                  value={selectedNote.content}
                  onChange={(e) => onUpdateNote(selectedNote.id, e.target.value)}
                  placeholder="Write your notes, specs, or draft documentation here..."
                  rows={8}
                  className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-blue-500/60 resize-none"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
