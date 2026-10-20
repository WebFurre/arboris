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
  type CategoryNode,
  createTaskId,
  createInboxItem 
} from '@/core/contracts/task.types';

export interface TriageTaskParams {
  id: TaskId;
  title?: string;
  notes?: string;
  parentId: TaskId | null;
  kind: Exclude<NodeKind, 'category'>;
  estimatedMinutes: number;
  deadline?: number;
  rules?: ScheduleRule[];
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

  /**
   * Быстрое создание категории/сферы дерева (US-2.1)
   */
  async createCategory(title: string, parentId: TaskId | null = null): Promise<CategoryNode> {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      throw new Error('Название категории не может быть пустым');
    }

    const now = Date.now();
    const category: CategoryNode = {
      id: createTaskId(crypto.randomUUID()),
      parentId,
      title: cleanTitle,
      kind: 'category',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await db.nodes.add(category);
    return category;
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
      urgentUpdates.deadline = params.deadline ?? (now + 24 * 60 * 60 * 1000);
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

  async searchSimilarTasks(rawQuery: string, limit: number = 3): Promise<ActionableTask[]> {
    const query = rawQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const matches = await db.nodes
      .filter((node) => {
        return (
          node.kind !== 'category' &&
          node.status !== 'archived' &&
          node.title.toLowerCase().includes(query)
        );
      })
      .limit(limit)
      .toArray();

    return matches as ActionableTask[];
  },
};