/**
 * Parse Go import declarations and return a map of alias → full import path.
 */
export function detectImports(source: string): Map<string, string> {
  const imports = new Map<string, string>();

  // Single import: import "github.com/stripe/stripe-go/v78"
  const singleRe = /import\s+"([^"]+)"/g;
  for (const m of source.matchAll(singleRe)) {
    const fullPath = m[1]!;
    const alias = fullPath.split("/").pop()!;
    imports.set(alias, fullPath);
  }

  // Block import: import ( ... )
  const blockRe = /import\s*\(([\s\S]*?)\)/g;
  for (const block of source.matchAll(blockRe)) {
    const lines = block[1]!.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      // Named import: s3 "github.com/aws/aws-sdk-go-v2/service/s3"
      const named = trimmed.match(/^(\w+)\s+"([^"]+)"/);
      if (named) {
        if (named[1] === "_") continue; // blank import — side-effect only
        imports.set(named[1]!, named[2]!);
        continue;
      }
      // Unnamed import: "github.com/stripe/stripe-go/v78"
      const unnamed = trimmed.match(/^"([^"]+)"/);
      if (unnamed) {
        const fullPath = unnamed[1]!;
        const alias = fullPath.split("/").pop()!;
        imports.set(alias, fullPath);
      }
    }
  }

  return imports;
}
