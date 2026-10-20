// src/modules/graph/components/CreateSphereModal.tsx

import { useState } from 'react';
import { X, Sparkles, FolderPlus } from 'lucide-react';
import { nodesRepository } from '@/shared/db/nodes.repository';
import type { TaskId } from '@/core/contracts/task.types';

interface CreateSphereModalProps {
  isOpen: boolean;
  parentId: TaskId | null;
  parentTitle?: string;
  onClose: () => void;
  onCreated?: () => void;
}

export const CreateSphereModal = ({
  isOpen,
  parentId,
  parentTitle,
  onClose,
  onCreated,
}: CreateSphereModalProps) => {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await nodesRepository.createCategory(clean, parentId);
      setTitle('');
      onCreated?.();
      onClose();
    } catch (err) {
      console.error('Ошибка создания категории:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
            <FolderPlus className="w-4 h-4" />
            <span>{parentId ? `Подсфера для «${parentTitle}»` : 'Новая сфера жизни'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Спорт, Проект, Здоровье..."
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-zinc-100 text-sm outline-none transition-colors shadow-inner"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
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