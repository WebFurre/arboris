// src/modules/inbox/QuickCaptureBar.tsx

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Plus, CornerDownLeft, Sparkles } from 'lucide-react';
import { nodesRepository } from '@/shared/db/nodes.repository';
import type { ActionableTask } from '@/core/contracts/task.types';

interface QuickCaptureBarProps {
  onCreated?: (task: ActionableTask) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const QuickCaptureBar = ({
  onCreated,
  placeholder = 'Запиши мысль без раздумий...',
  autoFocus = true,
}: QuickCaptureBarProps) => {
  const [title, setTitle] = useState('');
  const [isSparkling, setIsSparkling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    // 1. Оптимистично очищаем строку сразу (Zero Input Lag)
    setTitle('');
    
    // Микро-эффект подсветки иконки для дофаминового отклика
    setIsSparkling(true);
    setTimeout(() => setIsSparkling(false), 400);

    try {
      // 2. Фоновая запись в IndexedDB
      const task = await nodesRepository.createInboxTask(cleanTitle);
      onCreated?.(task);
    } catch (error) {
      console.error('Failed to capture thought:', error);
      // При ошибке возвращаем текст назад, чтобы мысль не потерялась
      setTitle(cleanTitle);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setTitle('');
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative flex items-center w-full group">
      {/* Левая иконка-акцент */}
      <div className="absolute left-3.5 flex items-center pointer-events-none text-zinc-500 transition-colors duration-200 group-focus-within:text-emerald-400">
        {isSparkling ? (
          <Sparkles className="w-5 h-5 animate-pulse text-emerald-400" />
        ) : (
          <Plus className="w-5 h-5 transition-transform duration-200 group-focus-within:rotate-90" />
        )}
      </div>

      {/* Поле ввода */}
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-11 pr-24 py-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-100 placeholder:text-zinc-500 text-sm md:text-base outline-none transition-all duration-200 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 focus:bg-zinc-900 shadow-inner"
      />

      {/* Правая подсказка хоткея */}
      <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
        {title.trim().length > 0 ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="pointer-events-auto flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 rounded-md hover:bg-emerald-900/80 transition-colors cursor-pointer"
          >
            <span>В инбокс</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        ) : (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 rounded">
            Enter ↵
          </span>
        )}
      </div>
    </div>
  );
};