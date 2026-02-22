---
status: complete
priority: p2
issue_id: "048"
tags: [code-review, web, accessibility, error-handling]
dependencies: []
---

# CopyButton: Accessibility and Error Handling

## Problem Statement

`CopyButton` has three issues: (1) `navigator.clipboard.writeText()` can throw (non-secure context, permission denied) with no try/catch, (2) `aria-label` stays "Copy to clipboard" when checkmark is shown, (3) button type not specified (defaults to submit, risky inside forms).

## Findings

- **File:** `apps/web/components/ui/copy-button.tsx`
- Lines 8–12: `handleCopy` has no try/catch; unhandled errors crash component
- Line 18: `aria-label` does not update when `copied` is true
- Line 15: No `type="button"` — could submit forms if nested

## Proposed Solutions

### Option 1: Full fix

**Approach:**
```tsx
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Clipboard API failed (e.g. non-HTTPS, permission denied)
  }
}

// In JSX:
<button type="button" onClick={handleCopy} aria-label={copied ? "Copied!" : "Copy to clipboard"} ...>
```

**Pros:** Addresses all three
**Cons:** None
**Effort:** Small
**Risk:** Low

---

### Option 2: Error handling only

**Approach:** Add try/catch; defer aria-label and type.

**Pros:** Prevents crashes
**Cons:** Accessibility gaps remain
**Effort:** Trivial
**Risk:** Low

## Recommended Action

Implemented: try/catch, aria-label when copied, type="button", removed unused className.

## Technical Details

**Affected files:**
- `apps/web/components/ui/copy-button.tsx`

## Resources

- **PR:** #5
- **Review agent:** kieran-typescript-reviewer

## Acceptance Criteria

- [ ] Clipboard errors are caught (no unhandled rejection)
- [ ] aria-label reflects copied state ("Copied!" when copied)
- [ ] Button has `type="button"`
- [ ] Optional: Remove unused `className` prop if never passed

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** workflows:review

**Actions:**
- Identified CopyButton error handling and accessibility gaps
- Implemented full fix
