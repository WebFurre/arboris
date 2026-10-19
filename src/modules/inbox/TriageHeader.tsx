// src/modules/inbox/TriageHeader.tsx

import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Sparkles, Play, CheckCircle2 } from 'lucide-react';
import { nodesRepository } from '@/shared/db/nodes.repository';

export const calculateTriageMinutes = (count: number): number => {
  if (count <= 0) return 0;
  return Math.min(count, 15);
};

interface TriageHeaderProps {
  onStartTriage?: () => void;
}

export const TriageHeader = ({ onStartTriage }: TriageHeaderProps) => {
  const count = useLiveQuery(() => nodesRepository.getInboxCount(), []);

  if (count === undefined) {
    return (
      <div className="h-16 w-full bg-zinc-900/40 border border-zinc-800/60 rounded-2xl animate-pulse" />
    );
  }

  // Состояние: чистота
  if (count === 0) {
    return (
      <div className="flex items-center justify-between px-5 py-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-zinc-400">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Корзина пуста</h2>
            <p className="text-xs text-zinc-500">В голове чистота, можно переходить к делам</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400/80 bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-800/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>0 мин</span>
        </div>
      </div>
    );
  }

  const triageMinutes = calculateTriageMinutes(count);

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-emerald-400">
          <Clock className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100">
              Спринт разбора: ~{triageMinutes} мин
            </h2>
            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded-full">
              Anti-Guilt
            </span>
          </div>
          {/* Никаких пугающих цифр N заметок — только спокойный майндсет */}
          <p className="text-xs text-zinc-400 mt-0.5">
            Разбери сколько успеется без спешки, остальное подождет
          </p>
        </div>
      </div>

      {onStartTriage && (
        <button
          type="button"
          onClick={onStartTriage}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-zinc-100 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded-xl shadow-lg shadow-emerald-950/40 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Начать разбор</span>
        </button>
      )}
    </header>
  );
};