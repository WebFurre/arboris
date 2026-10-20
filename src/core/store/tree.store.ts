// src/core/store/tree.store.ts

import { create } from 'zustand';
import type { TaskId } from '@/core/contracts/task.types';

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface TreeState {
  // --- Состояния ---
  /**
   * Текущий активный корень графа (US-2.1: Context Isolation).
   * null — глобальный корень всего дерева.
   */
  activeRootId: TaskId | null;

  /**
   * Узел, выбранный для детального просмотра в боковой шторке-инспекторе (US-2.4).
   */
  selectedNodeId: TaskId | null;

  /**
   * Узел, над которым в данный момент находится курсор мыши.
   */
  hoveredNodeId: TaskId | null;

  /**
   * Положение и масштаб виртуальной камеры.
   */
  viewportTransform: ViewportTransform;

  // --- Базовые действия (Actions) ---
  setActiveRootId: (id: TaskId | null) => void;
  setSelectedNodeId: (id: TaskId | null) => void;
  setHoveredNodeId: (id: TaskId | null) => void;
  setViewportTransform: (transform: Partial<ViewportTransform>) => void;

  // --- Составные бизнес-сценарии ---
  /**
   * Сброс зума к глобальному корню дерева и закрытие инспектора.
   */
  resetFocus: () => void;

  /**
   * Быстрый переход к узлу из инбокса / саджеста дубликатов (US-2.4):
   * Устанавливает контекст родительской ветки и сразу выделяет целевой узел.
   */
  quickJumpToNode: (targetNodeId: TaskId, parentId: TaskId | null) => void;
}

export const useTreeStore = create<TreeState>((set) => ({
  // Начальное состояние
  activeRootId: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  viewportTransform: {
    x: 0,
    y: 0,
    zoom: 1.0,
  },

  // Базовые сеттеры
  setActiveRootId: (id) => set({ activeRootId: id }),
  
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),

  setViewportTransform: (transform) =>
    set((state) => ({
      viewportTransform: {
        ...state.viewportTransform,
        ...transform,
      },
    })),

  // Бизнес-экшены
  resetFocus: () =>
    set({
      activeRootId: null,
      selectedNodeId: null,
    }),

  quickJumpToNode: (targetNodeId, parentId) =>
    set({
      activeRootId: parentId,
      selectedNodeId: targetNodeId,
    }),
}));