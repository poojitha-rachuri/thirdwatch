// apps/cli/src/update-check.ts — Non-blocking version check on startup
import pc from "picocolors";

export async function checkForUpdates(
  currentVersion: string,
): Promise<void> {
  // Skip in non-TTY (piping), CI, or when explicitly suppressed
  if (
    !process.stderr.isTTY ||
    process.env["CI"] ||
    process.env["NO_UPDATE_NOTIFICATION"]
  ) {
    return;
  }

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

    // Write to stderr so stdout stays clean for piping
    console.error(
      pc.yellow(
        `\n  Update available: ${currentVersion} → ${latest}  (npm i -g thirdwatch)`,
      ),
    );
  } catch {
    // Never block the scan — silently ignore
  }
}
