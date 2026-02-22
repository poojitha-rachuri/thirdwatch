"use client";

import { useState } from "react";
import { TDM_FIXTURE, TDM_SECTIONS } from "@/lib/tdm-fixture";

type SectionKey = "packages" | "apis" | "sdks" | "infrastructure" | "webhooks";

export function TDMExplorerSection() {
  const [activeTab, setActiveTab] = useState<SectionKey>("packages");

  const sectionData = TDM_FIXTURE[activeTab];

  return (
    <section className="border-t border-zinc-800 bg-zinc-900 py-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center text-3xl font-bold text-white">
          See What Thirdwatch Finds
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
          Real output from scanning a Python payments service. This is what a
          Thirdwatch Dependency Manifest looks like.
        </p>

        <div className="mt-10 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-zinc-800">
            {TDM_SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveTab(section.key as SectionKey)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === section.key
                    ? "border-b-2 border-brand-500 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span>{section.icon}</span>
                {section.label}
                <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-xs">
                  {section.count}
                </span>
              </button>
            ))}
          </div>

          {/* JSON Output */}
          <div className="max-h-[400px] overflow-auto p-4">
            <pre className="font-mono text-sm text-zinc-300">
              <code>{JSON.stringify(sectionData, null, 2)}</code>
            </pre>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          From{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">
            thirdwatch.json
          </code>{" "}
          — {TDM_FIXTURE.metadata.repository}
        </p>
      </div>
    </section>
  );
}
