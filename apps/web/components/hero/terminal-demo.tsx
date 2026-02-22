"use client";

import { useEffect, useState } from "react";

const LINES = [
  { text: "$ thirdwatch scan .", type: "command" as const, delay: 0 },
  { text: "", type: "blank" as const, delay: 800 },
  { text: "✔ Scanning 847 files (Python, TypeScript)...", type: "info" as const, delay: 1200 },
  { text: "📦 4 packages  🌐 3 APIs  🔧 2 SDKs  🗄️ 2 infra  🔗 2 webhooks", type: "result" as const, delay: 2000 },
  { text: "", type: "blank" as const, delay: 2400 },
  { text: "TDM written to ./thirdwatch.json (13 dependencies found)", type: "success" as const, delay: 2800 },
];

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    LINES.forEach((line, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), line.delay));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 font-mono text-sm shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-zinc-700" />
        <span className="h-3 w-3 rounded-full bg-zinc-700" />
        <span className="h-3 w-3 rounded-full bg-zinc-700" />
        <span className="ml-2 text-xs text-zinc-500">Terminal</span>
      </div>
      <div className="p-4 min-h-[160px]">
        {LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`${
              line.type === "command"
                ? "text-green-400"
                : line.type === "info"
                  ? "text-blue-400"
                  : line.type === "result"
                    ? "text-zinc-300"
                    : line.type === "success"
                      ? "text-green-300"
                      : ""
            } ${line.text === "" ? "h-5" : ""}`}
          >
            {line.text}
          </div>
        ))}
        {visibleLines < LINES.length && (
          <span className="inline-block h-4 w-2 animate-pulse bg-zinc-400" />
        )}
      </div>
    </div>
  );
}
