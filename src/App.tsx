// src/App.tsx

import { useState } from 'react';
import { InboxView } from '@/modules/inbox/InboxView';
import { TreeCanvas } from '@/modules/graph/canvas/TreeCanvas';
import { Inbox, Network, Sparkles } from 'lucide-react';
import { db } from '@/shared/db/schema';
import { createTaskId } from '@/core/contracts/task.types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'graph'>('graph');

  // Утилита мгновенной генерации образцового дерева задач
  const handleSeedDemoTree = async () => {
    const rootCatId = createTaskId(crypto.randomUUID());
    const now = Date.now();

    await db.nodes.bulkPut([
      // Главная категория
      {
        id: rootCatId,
        parentId: null,
        title: 'Развитие и Здоровье',
        kind: 'category',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      // 1. Срочная задача (будет пульсировать красным!)
      {
        id: createTaskId(crypto.randomUUID()),
        parentId: rootCatId,
        title: 'Сдать отчет по AI',
        kind: 'urgent',
        status: 'active',
        deadline: now + 3600000 * 4,
        estimatedMinutes: 60,
        skipCooldownSteps: 0,
        totalSkips: 0,
        createdAt: now,
        updatedAt: now,
      },
      // 2. Рутина (с кольцом бутонов!)
      {
        id: createTaskId(crypto.randomUUID()),
        parentId: rootCatId,
        title: 'Утренняя разминка',
        kind: 'routine',
        status: 'active',
        estimatedMinutes: 15,
        rules: [],
        budCluster: { total: 25, bloomed: 5, missedStreak: 0 },
        cooldown: { mode: 'auto', cooldownUntil: null },
        skipCooldownSteps: 0,
        totalSkips: 0,
        createdAt: now,
        updatedAt: now,
      },
      // 3. Отдых (светлячок-спутник)
      {
        id: createTaskId(crypto.randomUUID()),
        parentId: rootCatId,
        title: 'Прогулка в парке',
        kind: 'leisure',
        status: 'active',
        estimatedMinutes: 30,
        category: 'walk',
        skipCooldownSteps: 0,
        totalSkips: 0,
        createdAt: now,
        updatedAt: now,
      },
      // 4. Одноразовая задача
      {
        id: createTaskId(crypto.randomUUID()),
        parentId: rootCatId,
        title: 'Заказать фильтры',
        kind: 'one_off',
        status: 'active',
        estimatedMinutes: 5,
        skipCooldownSteps: 0,
        totalSkips: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  };

  return (
    <main className="w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      <header className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 px-4 py-2 rounded-2xl shadow-xl pointer-events-auto">
          <h1 className="text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-1.5">
            <span>Arboris</span>
            <span className="text-xs">🌲</span>
          </h1>
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono">Epic 2: Mind-Graph</span>
          </div>
        </div>

        <nav className="flex items-center gap-2 pointer-events-auto">
          {/* Кнопка генерации тестового дерева задач */}
          <button
            type="button"
            onClick={handleSeedDemoTree}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-medium bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all cursor-pointer shadow-xl"
            title="Засеять дерево тестовыми задачами"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Демо-дерево</span>
          </button>

          <div className="flex items-center gap-1 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-1 rounded-2xl shadow-xl">
            <button
              type="button"
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'graph'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Холст графа</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'inbox'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Корзина (Inbox)</span>
            </button>
          </div>
        </nav>
      </header>

      <div className="relative w-full h-full flex-1">
        {activeTab === 'graph' ? (
          <TreeCanvas />
        ) : (
          <div className="w-full h-full overflow-y-auto p-6 pt-24 md:p-12 md:pt-24 flex justify-center">
            <InboxView />
          </div>
        )}
      </div>
    </main>
  );
}