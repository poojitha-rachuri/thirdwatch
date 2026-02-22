---
status: complete
priority: p1
issue_id: "045"
tags: [code-review, web, agent-native, accessibility]
dependencies: []
---

# Agent-Native: Tabbed Content Not in Initial HTML

## Problem Statement

Quick Install (brew/pip) and TDM Explorer (apis, sdks, infra, webhooks) content lives only in client state after tab clicks. Agents that fetch the page HTML cannot access these — only the default tab (npm, packages) is server-rendered.

## Findings

- **Quick Install:** `apps/web/components/sections/quick-install.tsx` — brew and pip commands not in initial HTML
- **TDM Explorer:** `apps/web/components/sections/tdm-explorer.tsx` — apis, sdks, infrastructure, webhooks sections not in initial HTML
- Impact: Agents/crawlers only see npm install and packages; brew/pip and other TDM sections are inaccessible
- Copy buttons and tab switching require JS; agents need the underlying text in the markup

## Proposed Solutions

### Option 1: JSON script block

**Approach:** Add `<script type="application/json" id="install-commands">` and `id="tdm-fixture">` with all data in the page.

**Pros:** Agents can parse without executing JS; minimal DOM changes
**Cons:** Slight duplication; JSON must stay in sync
**Effort:** Small
**Risk:** Low

---

### Option 2: Render all sections in DOM (hidden)

**Approach:** Render all tab content in the DOM with `aria-hidden` or `hidden` for non-active tabs.

**Pros:** Full content in HTML; works with existing tab UI
**Cons:** Larger initial HTML; need to ensure hidden content is still parseable
**Effort:** Small
**Risk:** Low

---

### Option 3: JSON-LD structured data

**Approach:** Add `SoftwareApplication` JSON-LD with install instructions; add TDM fixture as structured data.

**Pros:** Standards-compliant; improves SEO and agent discoverability
**Cons:** More schema work; may not cover all TDM sections
**Effort:** Medium
**Risk:** Low

## Recommended Action

Added JSON script blocks (install-commands, tdm-fixture) in page.tsx for agent access.

## Technical Details

**Affected files:**
- `apps/web/components/sections/quick-install.tsx`
- `apps/web/components/sections/tdm-explorer.tsx`
- `apps/web/app/page.tsx` or layout — for JSON script blocks

## Resources

- **PR:** #5
- **Review agent:** agent-native-reviewer

## Acceptance Criteria

- [ ] All install commands (npm, brew, pip) are present in initial HTML or structured data
- [ ] Full TDM fixture (all sections) is present in initial HTML or structured data
- [ ] Agents can access content without executing JavaScript

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified agent-native gap in tabbed content
- Added script type="application/json" blocks in app/page.tsx
