---
status: complete
priority: p2
issue_id: "049"
tags: [code-review, web, accessibility]
dependencies: []
---

# Tab Accessibility: Quick Install and TDM Explorer

## Problem Statement

Tab-like controls in Quick Install and TDM Explorer lack proper ARIA roles and attributes. Screen readers do not treat them as tabs; keyboard navigation and announced state are incomplete.

## Findings

- **Quick Install:** `apps/web/components/sections/quick-install.tsx:26-38` — buttons lack `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex`
- **TDM Explorer:** `apps/web/components/sections/tdm-explorer.tsx:26-42` — same pattern
- Missing: `role="tablist"` on container, `role="tab"` on buttons, `aria-selected`, `aria-controls`/`id` links, `role="tabpanel"` on content with `aria-labelledby`

## Proposed Solutions

### Option 1: Full ARIA tab pattern

**Approach:** Add `role="tablist"` to container, `role="tab"` to buttons, `aria-selected`, `aria-controls`, `id` for tab/panel linking, `role="tabpanel"` on content, `tabIndex={selected ? 0 : -1}` for keyboard focus.

**Pros:** Proper tab semantics; screen reader and keyboard support
**Cons:** Slightly more markup
**Effort:** Small
**Risk:** Low

---

### Option 2: Use Radix/shadcn Tabs

**Approach:** Replace custom tabs with Radix UI Tabs (or shadcn Tabs) which implements ARIA automatically.

**Pros:** Battle-tested accessibility
**Cons:** Adds dependency; may conflict with current minimal approach
**Effort:** Medium
**Risk:** Low

---

### Option 3: Defer

**Approach:** Document as known gap; fix in follow-up.

**Pros:** No immediate change
**Cons:** Accessibility gap remains
**Effort:** Trivial
**Risk:** Medium (a11y compliance)

## Recommended Action

Added full ARIA tab pattern to both components.

## Technical Details

**Affected files:**
- `apps/web/components/sections/quick-install.tsx`
- `apps/web/components/sections/tdm-explorer.tsx`

## Resources

- **PR:** #5
- **Review agent:** kieran-typescript-reviewer
- **ARIA:** https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/

## Acceptance Criteria

- [ ] Tab containers have `role="tablist"` and `aria-label`
- [ ] Tab buttons have `role="tab"`, `aria-selected`, `aria-controls`, `tabIndex`
- [ ] Tab panels have `role="tabpanel"`, `aria-labelledby`, `id`
- [ ] Keyboard navigation works (arrow keys, Tab)

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified missing tab ARIA
- Added role=tablist, tab, tabpanel, aria-selected, aria-controls, tabIndex
