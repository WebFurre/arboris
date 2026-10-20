// src/modules/graph/components/NodeInspector.tsx

import { useState, useEffect } from 'react';
import { X, Clock, Flame, Calendar, Trash2, Focus, FileText, Check } from 'lucide-react';
import { db } from '@/shared/db/schema';
import type { ArborisNode, TaskId } from '@/core/contracts/task.types';

interface NodeInspectorProps {
  nodeId: TaskId | null;
  activeRootId: TaskId | null;
  allNodes: ArborisNode[];
  onClose: () => void;
  onFocusBranch: (id: TaskId) => void;
}

export const NodeInspector = ({
  nodeId,
  activeRootId,
  allNodes,
  onClose,
  onFocusBranch,
}: NodeInspectorProps) => {
  const node = allNodes.find((n) => n.id === nodeId);
  const [notesText, setNotesText] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (node) {
      setNotesText(node.notes ?? '');
      setIsSaved(false);
    }
  }, [node]);

  if (!node) return null;

  const handleNotesBlur = async () => {
    if (node.notes !== notesText) {
      await db.nodes.update(node.id, {
        notes: notesText.trim() ? notesText.trim() : undefined,
        updatedAt: Date.now(),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Удалить «${node.title}»?`)) {
      await db.nodes.delete(node.id);
      onClose();
    }
  };

  const isCurrentFocus = node.id === activeRootId;

  return (
    <aside 
      className="absolute top-0 right-0 h-full w-80 md:w-96 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-200"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">
            {node.kind}
          </span>
          {isSaved && (
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Сохранено
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 leading-snug">{node.title}</h2>
        </div>

        {node.kind === 'urgent' && (
          <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-rose-400 text-xs font-medium">
              <Flame className="w-3.5 h-3.5" />
              <span>Срочная задача • Дедлайн</span>
            </div>
            <p className="text-xs text-rose-200/90 font-mono">
              {node.deadline ? new Date(node.deadline).toLocaleString('ru-RU') : 'Без даты'}
            </p>
          </div>
        )}

        {node.kind === 'routine' && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>Кластер бутонов рутины</span>
            </div>
            <p className="text-xs text-emerald-200 font-mono">
              Распустилось: {node.budCluster?.bloomed ?? 0} из {node.budCluster?.total ?? 25} бутонов 🌸
            </p>
          </div>
        )}

        {node.kind !== 'category' && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Оценка: ~{node.estimatedMinutes ?? 15} минут</span>
          </div>
        )}

        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Заметка и контекст</span>
          </label>
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Добавь детали, мысли, списки или полезные ссылки..."
            rows={6}
            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-200 text-xs outline-none transition-colors resize-none placeholder:text-zinc-600 shadow-inner"
          />
        </div>
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleDelete}
          className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
          title="Удалить узел"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {!isCurrentFocus && (
          <button
            type="button"
            onClick={() => onFocusBranch(node.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
          >
            <Focus className="w-3.5 h-3.5" />
            <span>Сфокусироваться на этой ветке</span>
          </button>
        )}
      </div>
    </aside>
  );
};