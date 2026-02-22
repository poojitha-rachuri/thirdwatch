"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui/copy-button";

const INSTALL_OPTIONS = [
  { id: "npm", label: "npm", command: "npm install -g thirdwatch" },
  { id: "brew", label: "brew", command: "brew install thirdwatch/tap/thirdwatch" },
  { id: "pip", label: "pip", command: "pip install thirdwatch" },
] as const;

export function QuickInstallSection() {
  const [selected, setSelected] = useState<string>("npm");

  const active = INSTALL_OPTIONS.find((o) => o.id === selected) ?? INSTALL_OPTIONS[0];

  return (
    <section id="install" className="border-t border-zinc-800 bg-zinc-950 py-20">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h2 className="text-3xl font-bold text-white">Install in Seconds</h2>
        <p className="mt-3 text-zinc-400">
          One command. No configuration. Start scanning immediately.
        </p>

        <div className="mt-10 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
          {/* Package manager tabs */}
          <div className="flex border-b border-zinc-800">
            {INSTALL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  selected === opt.id
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Command */}
          <div className="flex items-center justify-between gap-2 p-4">
            <code className="font-mono text-sm text-green-400">
              $ {active.command}
            </code>
            <CopyButton text={active.command} />
          </div>
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          Then run:{" "}
          <code className="rounded bg-zinc-800 px-2 py-1 text-zinc-300">
            thirdwatch scan /path/to/your/repo
          </code>
        </p>
      </div>
    </section>
  );
}
