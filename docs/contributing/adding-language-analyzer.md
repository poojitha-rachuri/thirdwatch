# Adding a Language Analyzer

Thirdwatch uses a plugin architecture for language support. Each language analyzer is a separate npm package that implements the `LanguageAnalyzerPlugin` interface from `@thirdwatch/core`.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Familiarity with [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammars
- The `web-tree-sitter` WASM grammar for your target language (e.g., `tree-sitter-python`, `tree-sitter-go`)

## Step 1: Copy the Template

```bash
cp -r plugins/analyzer-template plugins/thirdwatch-language-YOURLANGUAGE
cd plugins/thirdwatch-language-YOURLANGUAGE
```

Update `package.json`:
- `name`: `thirdwatch-language-YOURLANGUAGE`
- `description`: short description
- Keep `keywords: ["thirdwatch-plugin"]` — this is how auto-discovery works

## Step 2: Find the Tree-Sitter Grammar

Search npm for `tree-sitter-YOURLANGUAGE`. Install as a dev dependency:

```bash
pnpm add -D tree-sitter-rust  # example for Rust
```

The WASM file will be at `node_modules/tree-sitter-rust/tree-sitter-rust.wasm`.

## Step 3: Implement the Plugin

Edit `src/index.ts`. The `analyze()` method receives a `ScanContext` with:

- `context.tree` — parsed tree-sitter AST (via `web-tree-sitter`)
- `context.filePath` — relative path from project root
- `context.fileContent` — raw file content as string
- `context.registry` — SDK pattern registry for provider matching

### Key Patterns to Detect

| Kind | Description | Example |
|---|---|---|
| `import` | Language import/require statements | `import stripe` |
| `http_call` | Literal HTTP URLs in code | `requests.get("https://api.stripe.com/...")` |
| `instantiation` | SDK client constructor calls | `new Stripe(...)` |
| `env_var` | Environment variable reads | `os.environ["STRIPE_API_KEY"]` |

### Tree-Sitter Query Example (Python imports)

```typescript
const IMPORT_QUERY = `
  (import_statement
    name: (dotted_name) @module)
  (import_from_statement
    module_name: (dotted_name) @module)
`;

const matches = context.tree.rootNode.query(IMPORT_QUERY);
for (const match of matches) {
  const moduleName = match.captures[0]?.node.text ?? "";
  const registryMatch = context.registry.matchImport(moduleName, "python");
  if (registryMatch) {
    // emit dependency
  }
}
```

## Step 4: Write Tests

Use the fixtures in `fixtures/` for realistic test cases. Create `src/index.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { plugin } from "./index";

describe("YOURLANGUAGE analyzer", () => {
  it("detects stripe SDK import", async () => {
    const result = await plugin.analyze(/* mock context */);
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("stripe");
  });
});
```

## Step 5: Add SDK Patterns (if needed)

If the language has SDK patterns not yet in the registry, add them to `registries/sdks/<provider>.yml`:

```yaml
patterns:
  yourlanguage:  # add a new language section
    - package: "some-package"
      import_patterns:
        - "some-pattern"
```

## Step 6: Open a PR

1. Add your plugin to `pnpm-workspace.yaml` globs (already covered by `plugins/*`)
2. Add to `tsconfig.json` project references
3. Open a PR with:
   - Plugin code and tests
   - Any new SDK registry entries
   - A line in the PR description: "Adds support for YOURLANGUAGE"

We aim to review language analyzer PRs within 48 hours.
