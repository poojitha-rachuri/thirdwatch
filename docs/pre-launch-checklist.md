# Pre-Launch Checklist

Use this checklist before taking Thirdwatch to production or launching publicly.

## Code and Quality

- [ ] All CI checks pass (lint, typecheck, test)
- [ ] `make test` passes locally
- [ ] `make scan-fixtures` produces a valid TDM
- [ ] No high-priority security issues from open todos (e.g. `todos/017-*` through `todos/031-*`)
- [ ] README and docs match current CLI behavior and install instructions

## npm

- [ ] `NPM_TOKEN` secret configured in GitHub
- [ ] Publish step enabled in release workflow
- [ ] First "Version Packages" PR merged and packages published
- [ ] `npm install -g thirdwatch` works
- [ ] `thirdwatch scan --help` and `thirdwatch scan .` work after install

## Website

- [ ] Railway (or chosen host) deployment succeeds
- [ ] Custom domain `thirdwatch.dev` resolves and uses HTTPS
- [ ] Install commands on the site are correct and tested
- [ ] GitHub star count loads (or degrades gracefully without `GITHUB_TOKEN`)
- [ ] OG image and metadata work for social sharing
- [ ] Mobile layout checked (e.g. 375px width)

## Legal and Branding

- [ ] LICENSE and LICENSE-CLOUD files are correct
- [ ] GitHub repo URL in `apps/web/lib/constants.ts` points to production repo (e.g. `thirdwatch/thirdwatch` vs fork)

## Optional Before Public Launch

- [ ] Homebrew tap (if planned)
- [ ] pip package (if planned)
- [ ] GitHub Action published to Marketplace (per Plan 11)
- [ ] Analytics (e.g. Plausible) configured and privacy-compliant
