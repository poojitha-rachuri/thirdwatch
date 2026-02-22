---
status: complete
priority: p2
issue_id: "050"
tags: [code-review, web, maintainability]
dependencies: []
---

# Centralize Duplicated URLs

## Problem Statement

`https://github.com/poojitha-rachuri/thirdwatch` appears in 4 files; `https://thirdwatch.dev` in 6+. Hardcoded URLs make updates error-prone and can drift (e.g. repo URL for production).

## Findings

- **GitHub repo URL:** Used in `lib/github-stats.ts`, Hero, Footer, possibly elsewhere
- **Site URL:** Used in metadata, sitemap, robots, links
- **Impact:** Repo URL may need to change for production (e.g. `thirdwatch/thirdwatch`); site URL used for canonical, OG, etc.

## Proposed Solutions

### Option 1: lib/constants.ts

**Approach:** Create `apps/web/lib/constants.ts`:
```ts
export const GITHUB_REPO_URL = "https://github.com/poojitha-rachuri/thirdwatch";
export const SITE_URL = "https://thirdwatch.dev";
```
Import everywhere.

**Pros:** Single source of truth; easy to update for production
**Cons:** One more file
**Effort:** Small
**Risk:** Low

---

### Option 2: Environment variables

**Approach:** Use `NEXT_PUBLIC_SITE_URL` and `GITHUB_REPO_URL` (or similar) from env.

**Pros:** Configurable per environment
**Cons:** More setup; env vars for static site can be awkward
**Effort:** Small
**Risk:** Low

---

### Option 3: Defer

**Approach:** Leave as-is; update manually when repo/site changes.

**Pros:** No change
**Cons:** Duplication and drift risk
**Effort:** None
**Risk:** Medium

## Recommended Action

Created lib/constants.ts with SITE_URL, GITHUB_REPO_URL, GITHUB_API_REPO_URL, INSTALL_OPTIONS.

## Technical Details

**Affected files:**
- `apps/web/lib/github-stats.ts`
- `apps/web/components/hero/hero.tsx`
- `apps/web/components/footer.tsx`
- `apps/web/app/layout.tsx` (metadataBase)
- `apps/web/app/sitemap.ts`
- `apps/web/app/robots.ts`
- New: `apps/web/lib/constants.ts`

## Resources

- **PR:** #5
- **Review agent:** code-simplicity-reviewer

## Acceptance Criteria

- [ ] URLs centralized in constants or env
- [ ] No hardcoded GitHub repo or site URLs in components
- [ ] Build and links work correctly

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified URL duplication
- Created lib/constants.ts and updated all consumers
