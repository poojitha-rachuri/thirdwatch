---
status: complete
priority: p2
issue_id: "047"
tags: [code-review, web, type-safety, security]
dependencies: []
---

# GitHub Stats: Typing, Auth Format, and Server-Only Guard

## Problem Statement

`lib/github-stats.ts` has three issues: (1) untyped `res.json()` response, (2) deprecated `token` auth format (should use `Bearer`), (3) no explicit server-only boundary to prevent accidental client import.

## Findings

- **File:** `apps/web/lib/github-stats.ts`
- Line 13: `data` from `res.json()` is implicitly `any` — conflicts with strict mode
- Line 8: `Authorization: token ${...}` is legacy; fine-grained PATs use `Bearer`
- No `"server-only"` import — if someone imports in a client component, pattern is fragile (Next.js won't bundle `process.env` without `NEXT_PUBLIC_`, but explicit guard is clearer)

## Proposed Solutions

### Option 1: Full fix (typing + Bearer + server-only)

**Approach:**
```ts
import "server-only";

interface GitHubRepoResponse {
  stargazers_count?: number;
}

export async function getGitHubStarCount(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/poojitha-rachuri/thirdwatch",
      {
        next: { revalidate: 3600 },
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {},
      }
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as GitHubRepoResponse;
    return data.stargazers_count ?? 0;
  } catch {
    return 0;
  }
}
```

**Pros:** Addresses all three issues
**Cons:** Requires `server-only` package (Next.js includes it)
**Effort:** Small
**Risk:** Low

---

### Option 2: Typing and Bearer only

**Approach:** Add interface and Bearer; skip server-only.

**Pros:** Minimal change
**Cons:** No explicit server boundary
**Effort:** Small
**Risk:** Low

## Recommended Action

Implemented full fix: server-only, GitHubRepoResponse type, Bearer auth.

## Technical Details

**Affected files:**
- `apps/web/lib/github-stats.ts`

## Resources

- **PR:** #5
- **Review agents:** kieran-typescript-reviewer, security-sentinel
- **GitHub API:** Fine-grained PATs use Bearer; classic tokens support both

## Acceptance Criteria

- [ ] GitHub API response is typed (no implicit any)
- [ ] Authorization uses `Bearer` format
- [ ] `"server-only"` imported (or documented why not)
- [ ] Document GITHUB_TOKEN in deploy setup (Vercel env vars)

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified typing, auth format, and server boundary issues
- Added server-only, GitHubRepoResponse, Bearer auth, GITHUB_API_REPO_URL from constants
