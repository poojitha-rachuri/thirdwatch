---
title: "feat: Website — thirdwatch.dev"
type: feat
phase: 1 — The Map (launch site)
date: 2026-02-21
priority: P1
dependencies: Plan 1 (Repo Setup), Plan 5 (CLI Interface — for content accuracy)
package: apps/web
---

# feat: Website — thirdwatch.dev

## Overview

Build the thirdwatch.dev marketing and documentation website in `apps/web`. For Phase 1, this is a focused launch site designed to convert a Hacker News post into GitHub stars and CLI installs. It is not a full docs site yet — just a compelling, credible, fast page that answers "What is this? Why do I care? How do I try it?"

## Problem Statement

The Phase 1 goal is 1,000 GitHub stars and 200+ weekly CLI installs within 60 days. Every developer who lands on thirdwatch.dev must immediately understand the value proposition, trust the product, and know how to install it. A generic template site kills that momentum. A site that shows real TDM output, speaks developer language, and has a fast install path converts.

## Proposed Solution

A Next.js 15 (App Router) site with:
1. **Hero section** — one-liner, animated terminal showing a real scan
2. **Problem section** — the blind spot story (Dependabot misses 80% of the surface)
3. **How it works** — 3-step visual (scan → manifest → monitor)
4. **TDM showcase** — interactive explorer of a real TDM output
5. **Quick install** — copy-paste install command with OS detection
6. **GitHub CTA** — strong star prompt
7. **Docs** — inline, not a separate docs site for Phase 1 (just a CLI reference page)

## Technical Approach

### Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router) | Static generation, Vercel deploy, excellent DX |
| Styling | Tailwind CSS 4 | Fast iteration, consistent design tokens |
| Components | shadcn/ui (selected) | Not a full install — pick only the components used |
| Syntax highlighting | Shiki | Same highlighter used by VS Code; supports ANSI terminal output |
| Fonts | Geist (sans + mono) | Free, sharp, developer-friendly |
| Analytics | Plausible (self-hosted or cloud) | Privacy-respecting, no cookie banners |
| Deploy | Vercel | Zero-config for Next.js |

### Site Structure

```
apps/web/
├── app/
│   ├── layout.tsx               # Root layout (fonts, analytics)
│   ├── page.tsx                 # Landing page (/)
│   ├── docs/
│   │   ├── page.tsx             # Docs index (/docs)
│   │   └── cli-reference/
│   │       └── page.tsx         # CLI flags reference (/docs/cli-reference)
│   └── tdm-spec/
│       └── page.tsx             # TDM schema spec (/tdm-spec)
├── components/
│   ├── hero/
│   │   ├── hero.tsx             # Hero section
│   │   └── terminal-demo.tsx    # Animated terminal showing scan
│   ├── sections/
│   │   ├── problem.tsx          # Problem statement section
│   │   ├── how-it-works.tsx     # 3-step diagram
│   │   ├── tdm-explorer.tsx     # Interactive TDM viewer
│   │   ├── quick-install.tsx    # Install command with OS detection
│   │   └── social-proof.tsx     # GitHub stats, HN link
│   ├── ui/
│   │   ├── copy-button.tsx      # Copy to clipboard
│   │   └── code-block.tsx       # Shiki-powered code block
│   └── nav.tsx                  # Top navigation
├── lib/
│   ├── github-stats.ts          # Fetch star count from GitHub API
│   └── tdm-fixture.ts           # The example TDM for the explorer
├── public/
│   ├── og-image.png             # Open Graph image (1200×630)
│   └── favicon.svg
└── package.json
```

### Page Design — Landing Page (`/`)

#### Section 1: Hero
```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  Know before you break.                                    │
│  ──────────────────────────────────────────────────────    │
│  Thirdwatch scans your codebase, maps every external       │
│  dependency — APIs, SDKs, packages, databases — and        │
│  tells you when one of them changes in a way that          │
│  could break you.                                          │
│                                                            │
│  [Install CLI]   [View on GitHub ★ 1.2k]                  │
│                                                            │
│  $ thirdwatch scan .                                       │  ← animated terminal
│  ✔ Scanning 847 files (Python, TypeScript)...             │
│  📦 12 packages  🌐 8 APIs  🔧 3 SDKs  🗄️ 4 infra       │
│  TDM written to ./thirdwatch.json                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Section 2: The Problem (The Blind Spot)
Stats-driven. Three columns:
- "Dependabot monitors packages. Your Stripe API version? Not covered."
- "API monitoring tools watch your APIs. The APIs you call? Also not covered."
- "Contract testing tools need you to write tests first. Thirdwatch just reads your code."

#### Section 3: How It Works
Three cards with icons:
1. **Scan** — Run `thirdwatch scan` locally. Source code never leaves your machine.
2. **Map** — Get a TDM: a structured JSON manifest of every external surface area.
3. **Monitor** *(Phase 2)* — Upload the TDM. Thirdwatch watches for breaking changes.

#### Section 4: TDM Explorer
Interactive JSON viewer showing a real (anonymized) TDM from a sample codebase. Tabbed by section (packages, apis, sdks, infrastructure). This demonstrates the product without requiring installation.

```typescript
// components/sections/tdm-explorer.tsx (concept)
const tabs = ["packages", "apis", "sdks", "infrastructure", "webhooks"];
// Rendered with Shiki for syntax highlighting
// Clicking a location shows the fake code snippet
```

#### Section 5: Quick Install
```
┌─────────────────────────────────────────────────────────────┐
│  Install in seconds                                         │
│                                                             │
│  npm   $ npm install -g thirdwatch          [copy]         │
│  brew  $ brew install thirdwatch/tap/...    [copy]         │
│  pip   $ pip install thirdwatch             [copy]         │
│                                                             │
│  Then run: thirdwatch scan /path/to/your/repo              │
└─────────────────────────────────────────────────────────────┘
```

OS detection: if `navigator.platform` is macOS, show brew first.

### SEO & Meta

```typescript
// app/layout.tsx metadata
export const metadata: Metadata = {
  title: "Thirdwatch — Know Before You Break",
  description:
    "Scan your codebase, map every external API, SDK, and package dependency, and get alerted before breaking changes hit production.",
  openGraph: {
    title: "Thirdwatch — Know Before You Break",
    description: "Continuous monitoring for every external dependency in your codebase.",
    url: "https://thirdwatch.dev",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@thirdwatch",
  },
};
```

### GitHub Star Count (SSR with revalidation)

```typescript
// lib/github-stats.ts
export async function getGitHubStarCount(): Promise<number> {
  const res = await fetch("https://api.github.com/repos/thirdwatch/thirdwatch", {
    next: { revalidate: 3600 }, // Revalidate hourly
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
  });
  const data = await res.json();
  return data.stargazers_count ?? 0;
}
```

### Animated Terminal Demo (`components/hero/terminal-demo.tsx`)

```typescript
// Use a typewriter-effect library to animate the CLI output line by line
// Shows: `thirdwatch scan .` being typed, then spinner, then summary table
// Pure CSS animation preferred over JS-heavy libraries
// Must not block LCP (Largest Contentful Paint)
```

### Performance Requirements

| Metric | Target |
|---|---|
| Lighthouse Performance | 95+ |
| LCP | < 2.5s |
| CLS | < 0.1 |
| Total page weight | < 200KB (gzipped) |
| Core Web Vitals | All green |

All sections are statically generated at build time. No client-side data fetching on first load.

### `apps/web/package.json`

```json
{
  "name": "@thirdwatch/web",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "shiki": "^1.0.0",
    "tailwindcss": "^4.0.0",
    "geist": "^1.3.0"
  }
}
```

### Vercel Deployment

- Connect GitHub repo to Vercel
- `apps/web` is the root for the Vercel project
- Environment variables: `GITHUB_TOKEN` for star count
- Custom domain: `thirdwatch.dev`
- Preview deployments on every PR

## Implementation Phases

### Phase 6.1: Scaffold
- Initialize Next.js 15 in `apps/web`
- Configure Tailwind CSS 4, Geist fonts
- Set up Vercel deployment on the repo

### Phase 6.2: Hero + Install
- Build hero section with tagline, CTA buttons
- Build animated terminal demo component
- Build quick install section with copy buttons

### Phase 6.3: Content Sections
- Problem statement section with 3-column comparison
- How It Works section with 3-step cards
- TDM Explorer with the fixture from Plan 2's examples

### Phase 6.4: SEO & OG
- Metadata, OG image (designed for Twitter/HN share)
- GitHub star count with hourly revalidation
- sitemap.xml and robots.txt

### Phase 6.5: Docs Page (Phase 1 minimal)
- CLI reference page at `/docs/cli-reference`
- TDM spec page at `/tdm-spec` (rendered from `docs/architecture/tdm-spec.md`)

## Acceptance Criteria

- [ ] Site loads at `https://thirdwatch.dev` on Vercel
- [ ] Lighthouse performance score ≥ 95
- [ ] All copy-paste install commands are correct and tested
- [ ] TDM Explorer renders the fixture JSON with correct syntax highlighting
- [ ] GitHub star count updates without a full rebuild (ISR)
- [ ] OG image renders correctly when shared on Twitter and LinkedIn
- [ ] CLI reference page documents all flags from Plan 5
- [ ] Mobile layout is fully responsive at 375px width
- [ ] No tracking cookies — analytics are privacy-respecting (Plausible)

## File Inventory

| File | Description |
|---|---|
| `apps/web/app/layout.tsx` | Root layout |
| `apps/web/app/page.tsx` | Landing page |
| `apps/web/app/docs/page.tsx` | Docs index |
| `apps/web/app/docs/cli-reference/page.tsx` | CLI flag reference |
| `apps/web/app/tdm-spec/page.tsx` | TDM schema spec |
| `apps/web/components/hero/hero.tsx` | Hero section |
| `apps/web/components/hero/terminal-demo.tsx` | Animated terminal |
| `apps/web/components/sections/problem.tsx` | Problem section |
| `apps/web/components/sections/how-it-works.tsx` | How it works |
| `apps/web/components/sections/tdm-explorer.tsx` | TDM Explorer |
| `apps/web/components/sections/quick-install.tsx` | Install section |
| `apps/web/components/ui/copy-button.tsx` | Copy to clipboard |
| `apps/web/components/ui/code-block.tsx` | Shiki code block |
| `apps/web/lib/github-stats.ts` | GitHub API fetch |
| `apps/web/lib/tdm-fixture.ts` | Example TDM for explorer |
| `apps/web/public/og-image.png` | OG image |
| `apps/web/public/favicon.svg` | Favicon |
| `apps/web/package.json` | Package manifest |
| `apps/web/next.config.ts` | Next.js config |

## References

- [Next.js 15 App Router docs](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Shiki — code highlighting](https://shiki.style/)
- [Geist font](https://vercel.com/font)
- [Plausible Analytics](https://plausible.io/)
- [Vercel deployment](https://vercel.com/docs)
