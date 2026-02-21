import { simpleGit } from "simple-git";
import { stat } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// getChangedFiles — determines which files need re-analysis
// ---------------------------------------------------------------------------

export interface ChangedFilesResult {
  /** Files that have changed since the last scan */
  changedFiles: string[];
  /** Whether we used git diff (true) or mtime fallback (false) */
  usedGit: boolean;
}

/**
 * Given a scan root and a previous scan timestamp, returns the list of files
 * that need to be re-analyzed.
 *
 * Strategy:
 * 1. Use `git diff --name-only HEAD~1` if inside a git repo
 * 2. Fall back to mtime comparison against previousScanTimestamp
 */
export async function getChangedFiles(
  root: string,
  previousScanTimestamp: string,
  allFiles: string[],
): Promise<ChangedFilesResult> {
  // Try git diff first
  try {
    const git = simpleGit(root);
    const isRepo = await git.checkIsRepo();
    if (isRepo) {
      const diff = await git.diff(["--name-only", "HEAD~1"]);
      const changedFiles = diff
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => join(root, line.trim()));
      return { changedFiles, usedGit: true };
    }
  } catch {
    // Not a git repo or git not available — fall through to mtime
  }

  // Fallback: mtime comparison
  const previousTime = new Date(previousScanTimestamp).getTime();
  const changedFiles: string[] = [];

  for (const filePath of allFiles) {
    try {
      const fileStat = await stat(filePath);
      if (fileStat.mtimeMs > previousTime) {
        changedFiles.push(filePath);
      }
    } catch {
      // File might have been deleted — treat as changed
      changedFiles.push(filePath);
    }
  }

  return { changedFiles, usedGit: false };
}
