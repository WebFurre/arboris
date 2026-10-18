export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-center space-y-4">
        <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
          Local-First Engine Ready
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Arboris 🌳</h1>
        <p className="text-sm text-slate-400">
          Окружение WSL2, Vite, React, TS и Tailwind успешно сконфигурировано.
        </p>
      </div>
    </main>
  );
}