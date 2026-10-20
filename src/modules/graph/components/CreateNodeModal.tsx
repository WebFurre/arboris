// src/modules/graph/components/CreateNodeModal.tsx

import { useState } from 'react';
import { X, Sparkles, FolderPlus, CheckSquare } from 'lucide-react';
import { db } from '@/shared/db/schema';
import { createTaskId, type TaskId, type NodeKind, type ActionableTask, type CategoryNode } from '@/core/contracts/task.types';

interface CreateNodeModalProps {
  isOpen: boolean;
  parentId: TaskId | null;
  parentTitle?: string;
  onClose: () => void;
}

export const CreateNodeModal = ({
  isOpen,
  parentId,
  parentTitle,
  onClose,
}: CreateNodeModalProps) => {
  const [mode, setMode] = useState<'task' | 'category'>('task');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<Exclude<NodeKind, 'category'>>('one_off');
  const [minutes, setMinutes] = useState(15);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const now = Date.now();
      const id = createTaskId(crypto.randomUUID());

      if (mode === 'category') {
        const newCat: CategoryNode = {
          id,
          parentId,
          title: clean,
          notes: notes.trim() ? notes.trim() : undefined,
          kind: 'category',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await db.nodes.add(newCat);
      } else {
        const newTask: ActionableTask = {
          id,
          parentId,
          title: clean,
          notes: notes.trim() ? notes.trim() : undefined,
          kind,
          status: 'active',
          estimatedMinutes: minutes,
          skipCooldownSteps: 0,
          totalSkips: 0,
          createdAt: now,
          updatedAt: now,
        };

        if (kind === 'urgent') {
          newTask.deadline = now + 4 * 3600000; // Дефолтный дедлайн через 4 часа
        } else if (kind === 'routine') {
          newTask.budCluster = { total: 25, bloomed: 0, missedStreak: 0 };
          newTask.rules = [];
          newTask.cooldown = { mode: 'auto', cooldownUntil: null };
        }

        await db.nodes.add(newTask);
      }

      setTitle('');
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Ошибка создания узла:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
            {mode === 'category' ? <FolderPlus className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            <span>{parentId ? `В ветку «${parentTitle}»` : 'В корень графа'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Переключатель: Задача или Сфера */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setMode('task')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === 'task' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Дело / Задача
          </button>
          <button
            type="button"
            onClick={() => setMode('category')}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
              mode === 'category' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Сфера / Папка
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'category' ? 'Название сферы (Спорт, Учеба...)' : 'Что нужно сделать?'}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-100 text-sm outline-none transition-colors shadow-inner"
            />
          </div>

          {mode === 'task' && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1">
                {(['one_off', 'routine', 'urgent', 'leisure'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setKind(t)}
                    className={`py-1 rounded-lg text-[10px] font-mono capitalize border transition-all cursor-pointer ${
                      kind === t
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 justify-between">
                {[5, 15, 30, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinutes(m)}
                    className={`flex-1 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                      minutes === m
                        ? 'border-amber-500 bg-amber-950/40 text-amber-300'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    }`}
                  >
                    {m}м
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Заметка или описание (опционально)..."
              rows={3}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-300 text-xs outline-none transition-colors resize-none placeholder:text-zinc-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium cursor-pointer transition-all shadow-lg shadow-emerald-950/40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Создать</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};