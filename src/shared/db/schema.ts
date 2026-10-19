import Dexie, { type Table } from 'dexie';
import type { ArborisNode, TaskId } from '@/core/contracts/task.types';

export class ArborisDatabase extends Dexie {
  nodes!: Table<ArborisNode, TaskId>;

  constructor() {
    super('ArborisDB');

    this.version(1).stores({
      /**
       * id            - Первичный ключ
       * parentId      - Изоляция контекста и семантический зум дерева
       * kind          - Быстрая фильтрация типов
       * status        - Состояния жизненного цикла
       * [status+kind] - Составной B-Tree индекс для мгновенной выборки задач в Фокус
       * deadline      - Диапазонные выборки дедлайнов (для UrgentTask)
       * createdAt     - Хронологическая сортировка
       */
      nodes: 'id, parentId, kind, status, [status+kind], deadline, createdAt',
    });
  }
}

export const db = new ArborisDatabase();