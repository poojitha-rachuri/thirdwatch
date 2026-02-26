import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { DependencyEntry } from "@thirdwatch/core";

export async function parseManifests(
  manifestFiles: string[],
  scanRoot: string,
): Promise<DependencyEntry[]> {
  const entries: DependencyEntry[] = [];

  for (const manifest of manifestFiles) {
    const isJavaManifest =
      manifest.endsWith("pom.xml") ||
      manifest.endsWith("build.gradle") ||
      manifest.endsWith("build.gradle.kts") ||
      manifest.endsWith("libs.versions.toml");

    if (!isJavaManifest) continue;

    try {
      const content = await readFile(manifest, "utf-8");
      const rel = relative(scanRoot, manifest);

      if (manifest.endsWith("pom.xml")) {
        entries.push(...parsePomXml(content, rel));
      } else if (manifest.endsWith("build.gradle.kts") || manifest.endsWith("build.gradle")) {
        entries.push(...parseGradleBuild(content, rel));
      } else if (manifest.endsWith("libs.versions.toml")) {
        entries.push(...parseVersionCatalog(content, rel));
      }
    } catch (err) {
      // Manifest errors are non-fatal — log and continue scanning other files
      console.error(
        `[java-analyzer] Failed to parse ${manifest}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Maven pom.xml parser
// ---------------------------------------------------------------------------

function parsePomXml(content: string, manifestFile: string): DependencyEntry[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const pom = parser.parse(content) as Record<string, unknown>;
  const project = pom["project"] as Record<string, unknown> | undefined;
  if (!project) return [];

  // Extract properties for interpolation
  const properties: Record<string, string> = {};
  const rawProps = project["properties"] as Record<string, unknown> | undefined;
  if (rawProps) {
    for (const [key, value] of Object.entries(rawProps)) {
      if (typeof value === "string") properties[key] = value;
    }
  }

  const depsNode = project["dependencies"] as Record<string, unknown> | undefined;
  const deps = normalizeDependencies(depsNode?.["dependency"]);
  const entries: DependencyEntry[] = [];

  for (const dep of deps) {
    const groupId = String(dep["groupId"] ?? "");
    const artifactId = String(dep["artifactId"] ?? "");
    let version = String(dep["version"] ?? "unknown");

    // Interpolate ${property.name}
    const propMatch = version.match(/^\$\{(.+)\}$/);
    if (propMatch && properties[propMatch[1]!]) {
      version = properties[propMatch[1]!]!;
    }

    // Skip test-scoped dependencies
    if (dep["scope"] === "test") continue;

    entries.push({
      kind: "package",
      name: `${groupId}:${artifactId}`,
      ecosystem: "maven",
      current_version: version,
      version_constraint: version,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return entries;
}

function normalizeDependencies(deps: unknown): Record<string, unknown>[] {
  if (!deps) return [];
  if (Array.isArray(deps)) return deps as Record<string, unknown>[];
  return [deps as Record<string, unknown>];
}

// ---------------------------------------------------------------------------
// Gradle build.gradle / build.gradle.kts parser
// ---------------------------------------------------------------------------

function parseGradleBuild(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  // Skip testImplementation / testCompileOnly / testRuntimeOnly
  // Word boundaries ensure we only match standalone config names, not substrings within them
  const configRe = /\b(?:implementation|api|compileOnly|runtimeOnly)\b/;

  // Groovy DSL: implementation 'group:artifact:version'
  const groovyRe = new RegExp(
    configRe.source + /\s+['"]([^'"]+)['"]/.source,
    "g",
  );
  for (const match of content.matchAll(groovyRe)) {
    const entry = parseGradleCoordinate(match[1]!, manifestFile);
    if (entry) entries.push(entry);
  }

  // Kotlin DSL: implementation("group:artifact:version")
  const kotlinRe = new RegExp(
    configRe.source + /\(["']([^"']+)["']\)/.source,
    "g",
  );
  for (const match of content.matchAll(kotlinRe)) {
    const entry = parseGradleCoordinate(match[1]!, manifestFile);
    if (entry) entries.push(entry);
  }

  // Groovy map notation: implementation group: 'x', name: 'y', version: 'z'
  const mapRe =
    /\b(?:implementation|api)\b\s+group:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],\s*version:\s*['"]([^'"]+)['"]/g;
  for (const match of content.matchAll(mapRe)) {
    entries.push({
      kind: "package",
      name: `${match[1]}:${match[2]}`,
      ecosystem: "maven",
      current_version: match[3]!,
      version_constraint: match[3]!,
      manifest_file: manifestFile,
      locations: [],
      usage_count: 0,
      confidence: "high",
    });
  }

  return entries;
}

function parseGradleCoordinate(
  coord: string,
  manifestFile: string,
): DependencyEntry | null {
  const parts = coord.split(":");
  if (parts.length < 2) return null;
  const group = parts[0]!;
  const artifact = parts[1]!;
  const version = parts[2] ?? "unknown";

  return {
    kind: "package",
    name: `${group}:${artifact}`,
    ecosystem: "maven",
    current_version: version.includes("$") ? "unknown" : version,
    version_constraint: version,
    manifest_file: manifestFile,
    locations: [],
    usage_count: 0,
    confidence: version.includes("$") ? "medium" : "high",
  };
}

// ---------------------------------------------------------------------------
// Gradle version catalog libs.versions.toml parser
// ---------------------------------------------------------------------------

function parseVersionCatalog(content: string, manifestFile: string): DependencyEntry[] {
  const entries: DependencyEntry[] = [];

  // Parse [versions] section
  const versions: Record<string, string> = {};
  const versionsSectionMatch = content.match(/\[versions\]([\s\S]*?)(?=\n\[|$)/);
  if (versionsSectionMatch) {
    for (const line of versionsSectionMatch[1]!.split("\n")) {
      const match = line.match(/^\s*(\S+)\s*=\s*"([^"]+)"/);
      if (match) {
        versions[match[1]!] = match[2]!;
      }
    }
  }

  // Parse [libraries] section
  const librariesSectionMatch = content.match(/\[libraries\]([\s\S]*?)(?=\n\[|$)/);
  if (!librariesSectionMatch) return entries;

  for (const line of librariesSectionMatch[1]!.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // module = "group:artifact", version.ref = "key"
    const moduleRefMatch = trimmed.match(
      /module\s*=\s*"([^"]+)".*version\.ref\s*=\s*"([^"]+)"/,
    );
    if (moduleRefMatch) {
      const [group, artifact] = moduleRefMatch[1]!.split(":");
      const versionRef = moduleRefMatch[2]!;
      const version = versions[versionRef] ?? "unknown";
      if (group && artifact) {
        entries.push({
          kind: "package",
          name: `${group}:${artifact}`,
          ecosystem: "maven",
          current_version: version,
          version_constraint: version,
          manifest_file: manifestFile,
          locations: [],
          usage_count: 0,
          confidence: "high",
        });
      }
      continue;
    }

    // module = "group:artifact", version = "1.2.3"
    const moduleInlineMatch = trimmed.match(
      /module\s*=\s*"([^"]+)".*version\s*=\s*"([^"]+)"/,
    );
    if (moduleInlineMatch) {
      const [group, artifact] = moduleInlineMatch[1]!.split(":");
      const version = moduleInlineMatch[2]!;
      if (group && artifact) {
        entries.push({
          kind: "package",
          name: `${group}:${artifact}`,
          ecosystem: "maven",
          current_version: version,
          version_constraint: version,
          manifest_file: manifestFile,
          locations: [],
          usage_count: 0,
          confidence: "high",
        });
      }
    }
  }

  return entries;
}
