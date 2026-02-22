---
status: complete
priority: p1
issue_id: "044"
tags: [code-review, web, seo, marketing]
dependencies: []
---

# Missing OG Image

## Problem Statement

`app/layout.tsx` references `/og-image.png` in Open Graph metadata, but the file does not exist in `public/`. Social previews (Twitter, LinkedIn, Slack) will fail or fall back to a generic image.

## Findings

- **File:** `apps/web/app/layout.tsx:18`
- Metadata includes `images: [{ url: "/og-image.png", width: 1200, height: 630 }]`
- Only `public/favicon.svg` exists; no `og-image.png`
- Impact: Broken social sharing previews

## Proposed Solutions

### Option 1: Add og-image.png

**Approach:** Create a 1200×630 PNG for thirdwatch.dev branding and place in `public/og-image.png`.

**Pros:** Full social preview support
**Cons:** Requires design asset
**Effort:** Small (if asset exists) / Medium (if designed)
**Risk:** Low

---

### Option 2: Remove images entry until asset exists

**Approach:** Remove the `images` entry from metadata until og-image.png is ready.

**Pros:** No broken references
**Cons:** No custom social preview
**Effort:** Small
**Risk:** Low

---

### Option 3: Use placeholder service

**Approach:** Use a dynamic OG image service (e.g. Vercel OG) to generate at build time.

**Pros:** No static asset needed
**Cons:** More complex, adds dependency
**Effort:** Medium
**Risk:** Medium

## Recommended Action

Removed images entry from metadata until og-image.png asset exists.

## Technical Details

**Affected files:**
- `apps/web/app/layout.tsx` — metadata.images
- `apps/web/public/` — add og-image.png or remove reference

## Resources

- **PR:** #5
- **Review agent:** performance-oracle

## Acceptance Criteria

- [ ] Social previews work (og-image.png exists) OR images entry removed
- [ ] No 404 for /og-image.png

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified missing og-image.png in PR #5
- Removed images entry from layout.tsx metadata
