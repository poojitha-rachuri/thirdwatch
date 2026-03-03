export function DashboardNav() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <a href="/dashboard" className="text-lg font-bold text-brand-400">
            Thirdwatch
          </a>
          <div className="flex gap-4 text-sm">
            <a
              href="/dashboard"
              className="text-zinc-300 transition-colors hover:text-white"
            >
              Overview
            </a>
            <a
              href="/changes"
              className="text-zinc-300 transition-colors hover:text-white"
            >
              Changes
            </a>
            <a
              href="/dependencies"
              className="text-zinc-300 transition-colors hover:text-white"
            >
              Dependencies
            </a>
            <a
              href="/settings"
              className="text-zinc-300 transition-colors hover:text-white"
            >
              Settings
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
