# Changelog Registry

This directory defines where Thirdwatch's Watcher (Phase 2) fetches changelog information for known API providers.

## Adding a New Changelog Source

1. Create `registries/changelogs/<provider-slug>.yml`
2. Follow the schema below
3. Open a PR — no code changes required

## Schema

```yaml
provider: stripe              # Must match a provider slug in registries/sdks/
sources:
  - type: webpage             # or: github_releases, rss, openapi_spec
    url: "https://stripe.com/docs/changelog"
    selector: ".changelog-entry"  # CSS selector for webpage type
  - type: github_releases
    repo: "stripe/stripe-python"  # GitHub owner/repo
  - type: openapi_spec
    url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"
```
