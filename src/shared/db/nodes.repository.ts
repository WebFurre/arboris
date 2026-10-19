// src/shared/db/nodes.repository.ts

import { db } from './schema';
import { 
  type TaskId, 
  type ArborisNode, 
  type ActionableTask, 
  type NodeKind,
  type ScheduleRule,
  type RoutineTask,
  type UrgentTask,
  createInboxItem 
} from '@/core/contracts/task.types';

export interface TriageTaskParams {
  id: TaskId;
  title?: string;
  notes?: string;                 // По контракту BaseNode
  parentId: TaskId | null;
  kind: Exclude<NodeKind, 'category'>; // 'urgent' | 'routine' | 'one_off' | 'leisure'
  estimatedMinutes: number;
  deadline?: number;              // Timestamp в миллисекундах (для Urgent)
  rules?: ScheduleRule[];         // Массив правил (для Routine)
}

export const nodesRepository = {
  async getInboxNodes(): Promise<ActionableTask[]> {
    const nodes = await db.nodes
      .where('status')
      .equals('inbox')
      .sortBy('createdAt');

    return nodes as ActionableTask[];
  },

  async getActiveTreeNodes(): Promise<ArborisNode[]> {
    return db.nodes
      .where('status')
      .equals('active')
      .toArray();
  },

  async getChildrenOf(parentId: TaskId | null): Promise<ArborisNode[]> {
    const allActive = await this.getActiveTreeNodes();
    return allActive.filter(node => node.parentId === parentId);
  },

  async createInboxTask(rawTitle: string): Promise<ActionableTask> {
    const title = rawTitle.trim();
    if (!title) {
      throw new Error('Task title cannot be empty');
    }

    const newTask = createInboxItem(title);
    await db.nodes.add(newTask);
    return newTask;
  },

  async triageTask(params: TriageTaskParams): Promise<void> {
    const existing = await db.nodes.get(params.id);
    if (!existing) {
      throw new Error(`Node with id ${params.id} not found`);
    }

    const now = Date.now();
    const baseUpdates: Partial<ActionableTask> = {
      status: 'active',
      parentId: params.parentId,
      kind: params.kind,
      estimatedMinutes: params.estimatedMinutes,
      updatedAt: now,
    };

    if (params.title?.trim()) {
      baseUpdates.title = params.title.trim();
    }

    if (params.notes?.trim()) {
      baseUpdates.notes = params.notes.trim();
    }

    if (params.kind === 'urgent') {
      const urgentUpdates = baseUpdates as Partial<UrgentTask>;
      urgentUpdates.deadline = params.deadline ?? (now + 24 * 60 * 60 * 1000); // Дефолт: сутки
    }

    if (params.kind === 'routine') {
      const routineUpdates = baseUpdates as Partial<RoutineTask>;
      routineUpdates.rules = params.rules && params.rules.length > 0 ? params.rules : [];
      routineUpdates.budCluster = {
        total: 25,
        bloomed: 0,
        missedStreak: 0,
      };
      routineUpdates.cooldown = {
        mode: 'auto',
        cooldownUntil: null,
      };
    }

    await db.nodes.update(params.id, baseUpdates);
  },

  async updateTaskTitle(id: TaskId, rawTitle: string): Promise<void> {
    const title = rawTitle.trim();
    if (!title) return;

    await db.nodes.update(id, {
      title,
      updatedAt: Date.now(),
    });
  },

  async deleteNode(id: TaskId): Promise<void> {
    await db.nodes.delete(id);
  },

  async getInboxCount(): Promise<number> {
    return db.nodes.where('status').equals('inbox').count();
  },
    // src/shared/db/nodes.repository.ts

    /**
 * Быстрый поиск похожих заметок с лимитом и ранней остановкой курсора (Early Exit).
 * Не забивает память V8, отсекает архивные узлы прямо в IndexedDB.
 */
    async searchSimilarTasks(rawQuery: string, limit: number = 3): Promise<ActionableTask[]> {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  // Используем потоковый фильтр Dexie с жестким limit.
  // Движок IndexedDB прекратит перебор сразу, как наберет 3 совпадения.
  const matches = await db.nodes
    .filter((node) => {
      // Ищем только среди незаархивированных задач
      return node.status !== 'archived' && node.title.toLowerCase().includes(query);
    })
    .limit(limit)
    .toArray();

  return matches as ActionableTask[];
    },
};