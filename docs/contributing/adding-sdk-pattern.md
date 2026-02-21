# Adding an SDK Pattern

SDK patterns live in `registries/sdks/<provider-slug>.yml`. Adding support for a new provider
requires **no code changes** — just a YAML file and a PR.

## When to Add a New Provider

- The provider has a public SDK/API that developers commonly use
- It's not already listed in `registries/sdks/README.md`
- You've encountered it in a real codebase and want Thirdwatch to detect it

## Schema Reference

```yaml
provider: github              # Unique slug (lowercase, hyphens ok)
display_name: "GitHub"        # Human-readable name shown in TDM output
homepage: "https://github.com"
changelog_url: "https://github.blog/changelog/"  # Used by Phase 2 Watcher

patterns:
  npm:                        # npm packages (JavaScript/TypeScript)
    - package: "@octokit/core"
      import_patterns:        # Substrings matched in import/require statements
        - "@octokit/core"
        - "@octokit/rest"
        - "Octokit"
  pypi:                       # PyPI packages (Python)
    - package: "PyGithub"
      import_patterns:
        - "import github"
        - "from github"
        - "Github"

known_api_base_urls:          # Detected when literal URLs appear in code
  - "https://api.github.com"

env_var_patterns:             # Detected when env var names appear in code
  - "GITHUB_TOKEN"
  - "GH_TOKEN"
  - "GITHUB_APP_ID"
```

## Tips

- **`provider` slug** must be lowercase, URL-safe (hyphens ok, no spaces). It becomes the `provider` field in TDM output.
- **`import_patterns`** are case-sensitive substring matches. Be specific enough to avoid false positives.
- **`known_api_base_urls`** should be the canonical base URL. Avoid wildcard entries unless truly necessary.
- **`env_var_patterns`** should be the most common variable names used by developers (check the provider's official docs/quickstart).
- For providers with many sub-packages (like AWS), list the most commonly used ones and use wildcard `@aws-sdk/*` syntax in the `package` field.

## Step-by-Step

1. Create `registries/sdks/<provider-slug>.yml`
2. Fill in all fields following the schema above
3. Add a row to the table in `registries/sdks/README.md`
4. If the provider also has a changelog source, add `registries/changelogs/<provider-slug>.yml`
5. Open a PR — CI will validate the YAML schema automatically

## Validation

Run locally to check your file:

```bash
make validate-registry  # coming in Phase 1
# or
pnpm thirdwatch validate registries/sdks/<provider-slug>.yml
```
