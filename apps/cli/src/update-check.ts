// apps/cli/src/update-check.ts — Non-blocking version check on startup
import pc from "picocolors";

export async function checkForUpdates(
  currentVersion: string,
): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(
      "https://registry.npmjs.org/thirdwatch/latest",
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) return;

    const data = (await res.json()) as { version?: string };
    const latest = data.version;
    if (!latest || latest === currentVersion) return;

    console.log(
      pc.yellow(
        `\n  Update available: ${currentVersion} → ${latest}  (npm i -g thirdwatch)`,
      ),
    );
  } catch {
    // Never block the scan — silently ignore
  }
}
