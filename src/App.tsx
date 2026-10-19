// src/App.tsx

import { InboxView } from '@/modules/inbox/InboxView';

export default function App() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center p-6 md:p-12 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Главный заголовок приложения */}
      <header className="w-full max-w-xl pb-6 border-b border-zinc-900 mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight text-zinc-100 flex items-center gap-2.5">
          <span>Arboris</span>
          <span className="text-xl">🌲</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-400 font-mono">Local-First Engine</span>
        </div>
      </header>

      {/* Модуль быстрой корзины */}
      <InboxView />
    </main>
  );
}