// src/modules/inbox/TriageModal.tsx

import { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Flame, 
  Repeat, 
  CheckCircle2, 
  Coffee, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  ChevronRight, 
  Sparkles, 
  Trash2, 
  AlignLeft, 
  Calendar,
  Layers,
  Search
} from 'lucide-react';
import { nodesRepository, type TriageTaskParams } from '@/shared/db/nodes.repository';
import type { 
  ActionableTask, 
  ArborisNode, 
  NodeKind, 
  TaskId, 
  ScheduleRule 
} from '@/core/contracts/task.types';

interface TriageModalProps {
  task: ActionableTask | null;
  isOpen: boolean;
  onClose: () => void;
  onTriaged?: () => void;
}

const TIME_PRESETS = [5, 15, 30, 60, 120];

const KIND_OPTIONS: { kind: Exclude<NodeKind, 'category'>; label: string; icon: typeof Flame; desc: string; color: string }[] = [
  { kind: 'one_off', label: 'Разовое дело', icon: CheckCircle2, desc: 'Простое действие: сделал и забыл', color: 'text-blue-400 border-blue-500/30 bg-blue-950/20' },
  { kind: 'routine', label: 'Привычка / Рутина', icon: Repeat, desc: 'Регулярная ветка с кластером бутонов', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20' },
  { kind: 'urgent', label: 'Срочное', icon: Flame, desc: 'Задача с горящим сроком выполнения', color: 'text-amber-400 border-amber-500/30 bg-amber-950/20' },
  { kind: 'leisure', label: 'Отдых', icon: Coffee, desc: 'Ресурсный банк восстанавливающих дел', color: 'text-purple-400 border-purple-500/30 bg-purple-950/20' },
];

export const TriageModal = ({ task, isOpen, onClose, onTriaged }: TriageModalProps) => {
  // 4 логичных шага: 1: Суть -> 2: Тип -> 3: Время -> 4: Место в дереве
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Шаг 1: Суть мысли и заметка
  const [editedTitle, setEditedTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [similarNodes, setSimilarNodes] = useState<ActionableTask[]>([]);

  // Шаг 2: Тип задачи
  const [selectedKind, setSelectedKind] = useState<Exclude<NodeKind, 'category'>>('one_off');
  const [deadlinePreset, setDeadlinePreset] = useState<'tonight' | 'tomorrow' | '3days' | 'weekend'>('tomorrow');
  
  // Шаг 3: Длительность (раздельные стейты без бага авто-стирания)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(15);
  const [customMinutes, setCustomMinutes] = useState<string>('');

  // Шаг 4: Место в дереве
  const [selectedParentId, setSelectedParentId] = useState<TaskId | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: TaskId | null; title: string }[]>([
    { id: null, title: 'Корень дерева' }
  ]);
  const [currentChildren, setCurrentChildren] = useState<ArborisNode[]>([]);

  // Инициализация при открытии модалки
  useEffect(() => {
    if (isOpen && task) {
      setStep(1);
      setEditedTitle(task.title);
      setNotes(task.notes || '');
      setSelectedKind('one_off');
      setDeadlinePreset('tomorrow');
      
      // Инициализируем время
      if (TIME_PRESETS.includes(task.estimatedMinutes as number)) {
        setSelectedPreset(task.estimatedMinutes as number);
        setCustomMinutes('');
      } else if (task.estimatedMinutes) {
        setSelectedPreset(null);
        setCustomMinutes(String(task.estimatedMinutes));
      } else {
        setSelectedPreset(15);
        setCustomMinutes('');
      }

      setSelectedParentId(null);
      setBreadcrumbs([{ id: null, title: 'Корень дерева' }]);
      setSimilarNodes([]);
      loadChildren(null);
    }
  }, [isOpen, task]);

  // Быстрый дебаунс-поиск похожих заметок через Dexie cursor limit (без утечек памяти)
  useEffect(() => {
    const query = editedTitle.trim();
    if (query.length < 2) {
      setSimilarNodes([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const matches = await nodesRepository.searchSimilarTasks(query, 3);
        // Исключаем текущую карточку из саджестов
        setSimilarNodes(matches.filter(m => m.id !== task?.id));
      } catch (err) {
        console.error('Failed to search similar tasks:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [editedTitle, task?.id]);

  const loadChildren = async (parentId: TaskId | null) => {
    const children = await nodesRepository.getChildrenOf(parentId);
    setCurrentChildren(children);
  };

  if (!isOpen || !task) return null;

  // Навигация по веткам дерева
  const handleDrillDown = async (node: ArborisNode) => {
    setSelectedParentId(node.id);
    setBreadcrumbs(prev => [...prev, { id: node.id, title: node.title }]);
    await loadChildren(node.id);
  };

  const handleBreadcrumbClick = async (index: number) => {
    const target = breadcrumbs[index];
    setSelectedParentId(target.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    await loadChildren(target.id);
  };

  // Обработчики выбора времени без взаимной блокировки
  const handleSelectPreset = (mins: number) => {
    setSelectedPreset(mins);
    setCustomMinutes(''); // Очищаем ручной ввод при клике на пресет
  };

  const handleCustomMinutesChange = (value: string) => {
    // Оставляем только цифры
    const numeric = value.replace(/\D/g, '');
    setCustomMinutes(numeric);
    setSelectedPreset(null); // Сбрасываем пресет: теперь главный ручной ввод!
  };

  // Вычисление итоговых минут
  const getEffectiveMinutes = (): number => {
    if (selectedPreset !== null) return selectedPreset;
    const parsed = Number(customMinutes);
    return parsed > 0 ? parsed : 15;
  };

  // Расчет дедлайна (MVP-пресет)
  const computeDeadlineTimestamp = (): number => {
    const d = new Date();
    if (deadlinePreset === 'tonight') {
      d.setHours(21, 0, 0, 0);
    } else if (deadlinePreset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
    } else if (deadlinePreset === '3days') {
      d.setDate(d.getDate() + 3);
      d.setHours(18, 0, 0, 0);
    } else {
      d.setDate(d.getDate() + (7 - d.getDay()));
      d.setHours(23, 59, 0, 0);
    }
    return d.getTime();
  };

  // Дефолтное валидное правило для рутины (заглушка до календаря)
  const createDefaultRoutineRules = (): ScheduleRule[] => [
    {
      id: crypto.randomUUID(),
      anchorDate: Date.now(),
      interval: 1,
      unit: 'weeks',
      weekdayRanges: [{ fromDay: 1, toDay: 7 }],
      slot: 'any',
    }
  ];

  // Финальное сохранение
  const handleComplete = async () => {
    const params: TriageTaskParams = {
      id: task.id,
      title: editedTitle,
      notes,
      parentId: selectedParentId,
      kind: selectedKind,
      estimatedMinutes: getEffectiveMinutes(),
      deadline: selectedKind === 'urgent' ? computeDeadlineTimestamp() : undefined,
      rules: selectedKind === 'routine' ? createDefaultRoutineRules() : undefined,
    };

    await nodesRepository.triageTask(params);
    onTriaged?.();
  };

  const handleDelete = async () => {
    await nodesRepository.deleteNode(task.id);
    onTriaged?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Шапка модалки */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Шаг {step} из 4
            </span>
            <div className="text-sm text-zinc-300 font-medium">
              {step === 1 && 'Суть мысли и контекст'}
              {step === 2 && 'Характер задачи'}
              {step === 3 && 'Сколько займет времени?'}
              {step === 4 && 'Куда посадить в дерево?'}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              title="Удалить карточку"
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Тело шагов */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col justify-between">
          
          {/* ШАГ 1: НАЗВАНИЕ + NOTES + САДЖЕСТ ДУБЛИКАТОВ */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Название действия:</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Что конкретно нужно сделать?"
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-base font-medium outline-none focus:border-emerald-500 shadow-inner"
                  autoFocus
                />
              </div>

              {/* Саджест похожих заметок с ранней остановкой курсора */}
              {similarNodes.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300 space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Search className="w-3.5 h-3.5" /> Внимание, похожая мысль уже есть в дереве:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {similarNodes.map(node => (
                      <span key={node.id} className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/60 text-[11px] text-amber-200">
                        «{node.title}»
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                  <AlignLeft className="w-3.5 h-3.5" /> Заметка / контекст (необязательно):
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Любые мысли, шаги, ссылки или важные детали..."
                  className="w-full p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-xs leading-relaxed outline-none focus:border-emerald-500 resize-none shadow-inner"
                />
              </div>
            </div>
          )}

          {/* ШАГ 2: ВЫБОР ТИПА ЗАДАЧИ */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {KIND_OPTIONS.map(({ kind, label, icon: Icon, desc, color }) => {
                  const isSelected = selectedKind === kind;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setSelectedKind(kind)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected 
                          ? `${color} ring-2 ring-current` 
                          : 'bg-zinc-800/40 border-zinc-800 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium text-sm">
                        <Icon className="w-4 h-4" />
                        {label}
                      </div>
                      <span className="text-[11px] opacity-75 leading-relaxed">{desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Заглушка для Urgent */}
              {selectedKind === 'urgent' && (
                <div className="p-4 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Быстрый дедлайн:
                    </span>
                    <span className="text-[10px] text-amber-400/70 font-mono">MVP Preset</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { key: 'tonight', label: 'Сегодня (21:00)' },
                      { key: 'tomorrow', label: 'Завтра (12:00)' },
                      { key: '3days', label: 'Через 3 дня' },
                      { key: 'weekend', label: 'Конец недели' },
                    ].map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setDeadlinePreset(p.key as any)}
                        className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer text-center font-medium ${
                          deadlinePreset === p.key
                            ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500 italic">
                    💡 Точный выбор часов откроется в модуле Календаря.
                  </p>
                </div>
              )}

              {/* Заглушка для Routine */}
              {selectedKind === 'routine' && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Цикл привычки:
                    </span>
                    <span className="text-[10px] text-emerald-400/70 font-mono">Fuzzy Ready</span>
                  </div>
                  <p className="text-xs text-zinc-300">
                    Активирован стандартный цикл: <strong>Каждую неделю</strong> в любое удобное время с кластером из 25 бутонов и защитой от вины.
                  </p>
                  <p className="text-[11px] text-zinc-500 italic pt-1">
                    💡 Календарная сетка «Камни и Вода» откроется на этапе Timeline.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ШАГ 3: ДЛИТЕЛЬНОСТЬ (ИСПРАВЛЕННЫЙ ВВОД 5, 50, 300) */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                Сколько минут займет выполнение за один подход?
              </p>
              
              <div className="grid grid-cols-6 gap-2">
                {TIME_PRESETS.map((mins) => {
                  const isSelected = selectedPreset === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleSelectPreset(mins)}
                      className={`py-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950'
                          : 'bg-zinc-800/50 border-zinc-700/60 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="text-sm">{mins}</div>
                      <div className="text-[10px] opacity-75">мин</div>
                    </button>
                  );
                })}

                {/* Чистый инпут: печатай хоть 5, хоть 50, хоть 300 без сбросов! */}
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Своё..."
                    value={customMinutes}
                    onChange={(e) => handleCustomMinutesChange(e.target.value)}
                    className={`w-full h-full py-2 bg-zinc-800/50 border rounded-xl text-center text-xs text-zinc-100 outline-none transition-colors ${
                      customMinutes.length > 0 
                        ? 'border-emerald-500 ring-1 ring-emerald-500/30' 
                        : 'border-zinc-700/60 focus:border-emerald-500'
                    }`}
                  />
                  <span className="absolute bottom-1 left-0 right-0 text-[9px] text-zinc-500 pointer-events-none">мин</span>
                </div>
              </div>

              <div className="text-center pt-2">
                <span className="text-xs text-zinc-400">
                  Будет сохранено: <strong className="text-emerald-400 font-mono text-sm">{getEffectiveMinutes()} мин</strong>
                </span>
              </div>
            </div>
          )}

          {/* ШАГ 4 (ФИНАЛ): ВЫБОР МЕСТА В ДЕРЕВЕ */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-1 text-xs text-zinc-400 flex-wrap bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800">
                {breadcrumbs.map((crumb, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleBreadcrumbClick(idx)}
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    <span>{crumb.title}</span>
                    {idx < breadcrumbs.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-600" />}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {currentChildren.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                    <p className="text-xs text-zinc-400">
                      В этой ветке пока нет дочерних узлов. Мысль вырастет прямо здесь!
                    </p>
                  </div>
                ) : (
                  currentChildren.map(child => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => handleDrillDown(child)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-800 border border-zinc-700/40 text-left text-sm text-zinc-200 transition-colors cursor-pointer group"
                    >
                      <span className="flex items-center gap-2.5">
                        <FolderTree className="w-4 h-4 text-emerald-400" />
                        {child.title}
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Навигация «Назад / Вперед» */}
          <div className="flex items-center justify-between pt-5 border-t border-zinc-800 mt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => (s - 1) as any)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Назад
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                disabled={step === 1 && !editedTitle.trim()}
                onClick={() => setStep(s => (s + 1) as any)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl transition-all cursor-pointer disabled:opacity-40"
              >
                Далее <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              >
                Посадить в дерево <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};