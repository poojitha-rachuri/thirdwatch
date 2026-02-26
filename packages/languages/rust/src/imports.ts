/**
 * Parse Rust `use` declarations and return a map of alias → full path.
 *
 * Handles:
 *   use aws_sdk_s3::Client;           → "Client" → "aws_sdk_s3::Client"
 *   use aws_sdk_s3::Client as S3;     → "S3"     → "aws_sdk_s3::Client"
 *   use reqwest;                       → "reqwest" → "reqwest"
 */
export function detectUseStatements(source: string): Map<string, string> {
  const imports = new Map<string, string>();

  // use path::to::Item as Alias;
  const aliasRe = /use\s+([\w:]+(?:::\w+)*)\s+as\s+(\w+)\s*;/g;
  for (const m of source.matchAll(aliasRe)) {
    imports.set(m[2]!, m[1]!);
  }

  // use path::to::Item;
  const useRe = /use\s+([\w:]+(?:::\w+)*)\s*;/g;
  for (const m of source.matchAll(useRe)) {
    const fullPath = m[1]!;
    // Skip if this was already matched as an alias
    if ([...imports.values()].includes(fullPath)) continue;
    const parts = fullPath.split("::");
    const alias = parts[parts.length - 1]!;
    imports.set(alias, fullPath);
  }

  return imports;
}
