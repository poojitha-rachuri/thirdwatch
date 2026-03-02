#!/usr/bin/env node
// scripts/validate-registry.mjs — Validate SDK registry YAML files against schema/registry.schema.json

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REGISTRY_DIR = join(ROOT, "registries", "sdks");
const SCHEMA_PATH = join(ROOT, "schema", "registry.schema.json");

const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));

const VALID_ECOSYSTEMS = new Set(
  Object.keys(schema.properties.patterns.properties),
);
const TOP_LEVEL_KEYS = new Set(Object.keys(schema.properties));
const SDK_PATTERN_KEYS = new Set(
  Object.keys(schema.$defs.SDKPatternEntry.properties),
);
const CONSTRUCTOR_KEYS = new Set(
  Object.keys(schema.$defs.ConstructorPattern.properties),
);
const REQUIRED_TOP = schema.required; // ["provider", "display_name", "patterns"]
const REQUIRED_SDK_PATTERN = schema.$defs.SDKPatternEntry.required; // ["package"]
const REQUIRED_CONSTRUCTOR = schema.$defs.ConstructorPattern.required; // ["name"]

function validateEntry(entry) {
  const errors = [];

  if (entry == null || typeof entry !== "object" || Array.isArray(entry)) {
    errors.push("top-level value must be a YAML mapping");
    return errors;
  }

  // Check for unknown top-level keys (additionalProperties: false)
  for (const key of Object.keys(entry)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      errors.push(`unknown top-level key '${key}'`);
    }
  }

  // Required fields
  for (const req of REQUIRED_TOP) {
    if (entry[req] == null) {
      errors.push(`missing required field '${req}'`);
    }
  }

  // provider
  if (entry.provider != null) {
    if (typeof entry.provider !== "string") {
      errors.push("'provider' must be a string");
    } else if (!/^[a-z0-9-]+$/.test(entry.provider)) {
      errors.push(
        `'provider' must match ^[a-z0-9-]+$ (got "${entry.provider}")`,
      );
    }
  }

  // display_name
  if (entry.display_name != null && typeof entry.display_name !== "string") {
    errors.push("'display_name' must be a string");
  }

  // homepage
  if (entry.homepage != null && typeof entry.homepage !== "string") {
    errors.push("'homepage' must be a string");
  }

  // changelog_url
  if (entry.changelog_url != null && typeof entry.changelog_url !== "string") {
    errors.push("'changelog_url' must be a string");
  }

  // patterns
  if (entry.patterns != null) {
    if (typeof entry.patterns !== "object" || Array.isArray(entry.patterns)) {
      errors.push("'patterns' must be an object");
    } else {
      // additionalProperties: false on patterns
      for (const eco of Object.keys(entry.patterns)) {
        if (!VALID_ECOSYSTEMS.has(eco)) {
          errors.push(
            `unknown ecosystem '${eco}' in patterns (valid: ${[...VALID_ECOSYSTEMS].join(", ")})`,
          );
        }
      }
      for (const [eco, patterns] of Object.entries(entry.patterns)) {
        if (!Array.isArray(patterns)) {
          errors.push(`patterns.${eco} must be an array`);
          continue;
        }
        for (let i = 0; i < patterns.length; i++) {
          const p = patterns[i];
          if (p == null || typeof p !== "object" || Array.isArray(p)) {
            errors.push(`patterns.${eco}[${i}] must be an object`);
            continue;
          }
          // additionalProperties: false
          for (const key of Object.keys(p)) {
            if (!SDK_PATTERN_KEYS.has(key)) {
              errors.push(
                `unknown key '${key}' in patterns.${eco}[${i}]`,
              );
            }
          }
          for (const req of REQUIRED_SDK_PATTERN) {
            if (p[req] == null) {
              errors.push(
                `patterns.${eco}[${i}] missing required field '${req}'`,
              );
            }
          }
          if (p.package != null && typeof p.package !== "string") {
            errors.push(`patterns.${eco}[${i}].package must be a string`);
          }
          if (p.import_patterns != null) {
            if (!Array.isArray(p.import_patterns)) {
              errors.push(
                `patterns.${eco}[${i}].import_patterns must be an array`,
              );
            } else {
              for (let j = 0; j < p.import_patterns.length; j++) {
                if (typeof p.import_patterns[j] !== "string") {
                  errors.push(
                    `patterns.${eco}[${i}].import_patterns[${j}] must be a string`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  // constructors
  if (entry.constructors != null) {
    if (
      typeof entry.constructors !== "object" ||
      Array.isArray(entry.constructors)
    ) {
      errors.push("'constructors' must be an object");
    } else {
      for (const [eco, ctors] of Object.entries(entry.constructors)) {
        if (!Array.isArray(ctors)) {
          errors.push(`constructors.${eco} must be an array`);
          continue;
        }
        for (let i = 0; i < ctors.length; i++) {
          const c = ctors[i];
          if (c == null || typeof c !== "object" || Array.isArray(c)) {
            errors.push(`constructors.${eco}[${i}] must be an object`);
            continue;
          }
          // additionalProperties: false
          for (const key of Object.keys(c)) {
            if (!CONSTRUCTOR_KEYS.has(key)) {
              errors.push(
                `unknown key '${key}' in constructors.${eco}[${i}]`,
              );
            }
          }
          for (const req of REQUIRED_CONSTRUCTOR) {
            if (c[req] == null) {
              errors.push(
                `constructors.${eco}[${i}] missing required field '${req}'`,
              );
            }
          }
          if (c.name != null && typeof c.name !== "string") {
            errors.push(`constructors.${eco}[${i}].name must be a string`);
          }
          if (c.services_field != null && typeof c.services_field !== "string") {
            errors.push(
              `constructors.${eco}[${i}].services_field must be a string`,
            );
          }
        }
      }
    }
  }

  // factories
  if (entry.factories != null) {
    if (
      typeof entry.factories !== "object" ||
      Array.isArray(entry.factories)
    ) {
      errors.push("'factories' must be an object");
    } else {
      for (const [eco, facs] of Object.entries(entry.factories)) {
        if (!Array.isArray(facs)) {
          errors.push(`factories.${eco} must be an array`);
          continue;
        }
        for (let i = 0; i < facs.length; i++) {
          if (typeof facs[i] !== "string") {
            errors.push(`factories.${eco}[${i}] must be a string`);
          }
        }
      }
    }
  }

  // known_api_base_urls
  if (entry.known_api_base_urls != null) {
    if (!Array.isArray(entry.known_api_base_urls)) {
      errors.push("'known_api_base_urls' must be an array");
    } else {
      for (let i = 0; i < entry.known_api_base_urls.length; i++) {
        if (typeof entry.known_api_base_urls[i] !== "string") {
          errors.push(`known_api_base_urls[${i}] must be a string`);
        }
      }
    }
  }

  // env_var_patterns
  if (entry.env_var_patterns != null) {
    if (!Array.isArray(entry.env_var_patterns)) {
      errors.push("'env_var_patterns' must be an array");
    } else {
      for (let i = 0; i < entry.env_var_patterns.length; i++) {
        if (typeof entry.env_var_patterns[i] !== "string") {
          errors.push(`env_var_patterns[${i}] must be a string`);
        }
      }
    }
  }

  return errors;
}

// Main
const files = readdirSync(REGISTRY_DIR)
  .filter((f) => f.endsWith(".yml"))
  .sort();

let totalErrors = 0;
let passed = 0;

for (const file of files) {
  const filePath = join(REGISTRY_DIR, file);
  try {
    const raw = yaml.load(readFileSync(filePath, "utf8"));
    const errors = validateEntry(raw);
    if (errors.length > 0) {
      console.error(`✗ ${file}`);
      for (const e of errors) {
        console.error(`    ${e}`);
      }
      totalErrors += errors.length;
    } else {
      passed++;
    }
  } catch (err) {
    console.error(
      `✗ ${file}: YAML parse error — ${err instanceof Error ? err.message : String(err)}`,
    );
    totalErrors++;
  }
}

console.log(`\n${passed}/${files.length} registry files valid`);
if (totalErrors > 0) {
  console.error(`${totalErrors} error(s) found`);
  process.exit(1);
} else {
  console.log("✓ All registry YAML files are valid");
}
