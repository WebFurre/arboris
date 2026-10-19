// src/modules/inbox/InboxView.tsx

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sparkles, ArrowRight } from 'lucide-react';
import { QuickCaptureBar } from './QuickCaptureBar';
import { TriageHeader } from './TriageHeader';
import { TriageModal } from './TriageModal';
import { nodesRepository } from '@/shared/db/nodes.repository';
import type { ActionableTask } from '@/core/contracts/task.types';

export const InboxView = () => {
  const [activeTask, setActiveTask] = useState<ActionableTask | null>(null);

  // Реактивный список карточек корзины (FIFO: старые сверху)
  const inboxNodes = useLiveQuery(() => nodesRepository.getInboxNodes(), []);

  // Старт спринта: берем первую карточку из головы очереди
  const handleStartTriage = () => {
    if (inboxNodes && inboxNodes.length > 0) {
      setActiveTask(inboxNodes[0]);
    }
  };

  // Переход к следующей карточке после сохранения предыдущей
  const handleNextTriaged = () => {
    if (inboxNodes && inboxNodes.length > 1) {
      // Пока база коммитит транзакцию, берем следующий элемент массива
      setActiveTask(inboxNodes[1]);
    } else {
      // Корзина полностью разобрана
      setActiveTask(null);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Шапка модуля с контекстом */}
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-400 uppercase flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Быстрая корзина (Inbox)</span>
        </h2>
        <span className="text-xs text-zinc-600 font-mono">Epic 1 / Complete</span>
      </div>

      {/* Плашка Anti-Guilt авто-каппинга */}
      <TriageHeader onStartTriage={handleStartTriage} />

      {/* Поле ввода мыслей с нулевой задержкой ввода */}
      <QuickCaptureBar />

      {/* Очередь неразобранных мыслей (FIFO) */}
      {inboxNodes && inboxNodes.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 font-medium px-1">
            <span>Очередь разбора</span>
            <span>Нажми для точечного разбора</span>
          </div>

          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {inboxNodes.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveTask(item)}
                className="group flex items-center justify-between p-3.5 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700/80 transition-all cursor-pointer shadow-sm"
              >
                <span className="text-sm text-zinc-200 group-hover:text-zinc-100 font-medium truncate pr-3">
                  {item.title}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-500 group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                  <span>Разобрать</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Диалог маршрутизации карточки в дерево */}
      <TriageModal
        task={activeTask}
        isOpen={Boolean(activeTask)}
        onClose={() => setActiveTask(null)}
        onTriaged={handleNextTriaged}
      />
    </div>
  );
};