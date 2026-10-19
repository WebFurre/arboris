/**
 * Arboris Core Task Types & Contracts
 * Единый источник правды для модели задач, графа и календаря.
 */

// ==========================================
// 1. Брендированные идентификаторы
// ==========================================
export type TaskId = string & { readonly __brand: unique symbol };
export const createTaskId = (rawId: string): TaskId => rawId as TaskId;

// ==========================================
// 2. Базовые перечисления и типы времени
// ==========================================
export type NodeKind = 'category' | 'urgent' | 'routine' | 'one_off' | 'leisure';

export type TaskStatus = 
  | 'inbox'       // В быстрой корзине
  | 'active'      // Активна в графе
  | 'completed'   // Выполнена
  | 'archived';   // Убрана без чувства вины

export type CategoryStatus = 'active' | 'archived';

export type DaySlot = 'morning' | 'afternoon' | 'evening' | 'night' | 'any';
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Пн, 7 = Вс
export type RecurrenceUnit = 'days' | 'weeks' | 'months' | 'years';

export interface WeekdayRange {
  fromDay: Weekday;
  toDay: Weekday;
}

export type EstimatedPresetMinutes = 5 | 15 | 30 | 60 | 120 | number;

// ==========================================
// 3. Правило расписания рутины
// ==========================================
export interface ScheduleRule {
  id: string;
  anchorDate: number;                // Timestamp базы отсчета (ms)
  interval: number;                  // Каждые N дней/недель/месяцев
  unit: RecurrenceUnit;              // 'days' | 'weeks' | 'months' | 'years'
  weekdayRanges?: WeekdayRange[];    // Гибкие диапазоны дней (Пн-Вт, Ср-Чт)
  slot: DaySlot;                     // Слот суток
  exactTime?: `${number}:${number}`; // Опционально: "19:00"
}

// ==========================================
// 4. Механика бутонов и кулдауна рутины
// ==========================================
export interface BudCluster {
  total: number;        // Емкость кластера (25-30 бутонов)
  bloomed: number;      // Раскрытые бутоны
  missedStreak: number; // 0 = норма, 1 = подушка спасла, 2 = опадает 1 бутон
}

export interface RoutineCooldown {
  mode: 'auto' | 'custom';
  customCooldownHours?: number;
  cooldownUntil: number | null;      // Timestamp блокировки для Диспетчера фокуса
  lastCompletedWindowKey?: string;   // Ключ закрытого слота (напр. "2026-W42-R0")
}

// ==========================================
// 5. Базовый узел графа
// ==========================================
export interface BaseNode {
  id: TaskId;
  parentId: TaskId | null;
  title: string;
  notes?: string;
  kind: NodeKind;
  createdAt: number;                 // Timestamp ms
  updatedAt: number;                 // Timestamp ms
}

// ==========================================
// 6. Узел Категории (контейнер в дереве)
// ==========================================
export interface CategoryNode extends BaseNode {
  kind: 'category';
  status: CategoryStatus;            // Статус жизненного цикла ветки
  color?: string;
}

// ==========================================
// 7. Специфичные контракты 4 типов задач
// ==========================================
export interface UrgentTask extends BaseNode {
  kind: 'urgent';
  status: TaskStatus;
  deadline: number;                  // Timestamp дедлайна
  estimatedMinutes?: EstimatedPresetMinutes;
  completedAt?: number;
  skipCooldownSteps: number;         // Карантин в очереди фокуса (N шагов)
  totalSkips: number;                // Индекс прокрастинации (клики "Не сейчас")
}

export interface RoutineTask extends BaseNode {
  kind: 'routine';
  status: TaskStatus;
  estimatedMinutes?: EstimatedPresetMinutes;
  rules: ScheduleRule[];
  budCluster: BudCluster;
  cooldown: RoutineCooldown;
  completedAt?: number;
  skipCooldownSteps: number;
  totalSkips: number;
}

export interface OneOffTask extends BaseNode {
  kind: 'one_off';
  status: TaskStatus;
  estimatedMinutes?: EstimatedPresetMinutes;
  completedAt?: number;
  skipCooldownSteps: number;
  totalSkips: number;
}

export interface LeisureTask extends BaseNode {
  kind: 'leisure';
  status: TaskStatus;
  estimatedMinutes?: EstimatedPresetMinutes;
  category?: 'movie' | 'book' | 'game' | 'walk' | 'other';
  completedAt?: number;
  skipCooldownSteps: number;
  totalSkips: number;
}

// ==========================================
// 8. Объединенные типы (Discriminated Unions)
// ==========================================
export type ActionableTask = UrgentTask | RoutineTask | OneOffTask | LeisureTask;
export type ArborisNode = CategoryNode | ActionableTask;


// ==========================================
// 9. Хелперы детерминированных ключей окон и ISO-календаря
// ==========================================

/**
 * Вычисляет ISO-год и порядковый номер недели (1–53) по стандарту ISO-8601.
 * Гарантирует одинаковый номер недели независимо от локали браузера.
 */
export const getIsoWeek = (date: Date = new Date()): { year: number; week: number } => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Понедельник = 0, Воскресенье = 6
  target.setDate(target.getDate() - dayNr + 3); // Ближайший четверг
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: target.getFullYear(), week: weekNumber };
};

export const buildWindowKey = {
  weeklyRange: (year: number, weekNumber: number, rangeIndex: number): string => 
    `${year}-W${String(weekNumber).padStart(2, '0')}-R${rangeIndex}`,
  
  dailySlot: (isoDate: string, slot: DaySlot): string => 
    `${isoDate}-${slot}`,
};

// ==========================================
// 10. Фабрика быстрой мысли для Inbox (US-1.1)
// ==========================================

/**
 * Создает сырую мысль в корзине со статусом 'inbox' и дефолтным типом 'one_off'.
 * Позволяет захватывать мысль за 3 секунды без заполнения лишних полей.
 */
export const createInboxItem = (title: string): OneOffTask => ({
  id: createTaskId(crypto.randomUUID()),
  parentId: null,
  title: title.trim(),
  kind: 'one_off',
  status: 'inbox',
  estimatedMinutes: 15,
  skipCooldownSteps: 0,
  totalSkips: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});