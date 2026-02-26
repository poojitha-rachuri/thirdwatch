/**
 * Parse Rust `use` declarations and return a map of alias → full path.
 *
 * Handles:
 *   use aws_sdk_s3::Client;              → "Client" → "aws_sdk_s3::Client"
 *   use aws_sdk_s3::Client as S3;        → "S3"     → "aws_sdk_s3::Client"
 *   use reqwest;                          → "reqwest" → "reqwest"
 *   use aws_sdk_s3::{Client, Error};     → "Client" → "aws_sdk_s3::Client",
 *                                           "Error"  → "aws_sdk_s3::Error"
 *   use stripe::{Charge as C};           → "C"      → "stripe::Charge"
 *
 * Known limitation: nested grouped imports (`use X::{A, B::{C, D}}`) are not
 * parsed — only the top-level group is handled.
 */
export function detectUseStatements(source: string): Map<string, string> {
  const imports = new Map<string, string>();

  // Strip comment-only lines to avoid matching commented-out `use` statements.
  // `use` declarations in Rust always start a line, so full-line comment removal
  // is sufficient. Inline trailing comments after code are safe to keep.
  const withoutLineComments = source
    .split("\n")
    .map((line) => (line.trimStart().startsWith("//") ? "" : line))
    .join("\n");

  // use path::to::Item as Alias;
  const aliasRe = /use\s+([\w:]+(?:::\w+)*)\s+as\s+(\w+)\s*;/g;
  for (const m of withoutLineComments.matchAll(aliasRe)) {
    imports.set(m[2]!, m[1]!);
  }

  // use path::to::{A, B as C, D};  — grouped imports
  const groupedUseRe = /use\s+([\w:]+(?:::\w+)*)::\{([^}]+)\}/g;
  for (const m of withoutLineComments.matchAll(groupedUseRe)) {
    const cratePath = m[1]!;
    for (const item of m[2]!.split(",").map((s) => s.trim()).filter(Boolean)) {
      const aliasMatch = item.match(/^([\w:]+)\s+as\s+(\w+)$/);
      if (aliasMatch) {
        imports.set(aliasMatch[2]!, `${cratePath}::${aliasMatch[1]!}`);
      } else if (item && item !== "_") {
        const fullPath = `${cratePath}::${item}`;
        const alias = item.split("::").pop()!;
        if (!imports.has(alias)) {
          imports.set(alias, fullPath);
        }
      }
    }
  }

  // use path::to::Item;
  const useRe = /use\s+([\w:]+(?:::\w+)*)\s*;/g;
  for (const m of withoutLineComments.matchAll(useRe)) {
    const fullPath = m[1]!;
    const parts = fullPath.split("::");
    const alias = parts[parts.length - 1]!;
    // O(1) guard: skip if this alias was already registered (e.g., via aliasRe or groupedUseRe)
    if (!imports.has(alias)) {
      imports.set(alias, fullPath);
    }
  }

  return imports;
}
