import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseDotenv } from "dotenv";
import type { Confidence } from "@thirdwatch/tdm";

// ---------------------------------------------------------------------------
// Known provider base URLs — used for heuristic resolution
// ---------------------------------------------------------------------------

const KNOWN_PROVIDERS: Record<string, string> = {
  STRIPE_API_BASE: "https://api.stripe.com",
  STRIPE_BASE_URL: "https://api.stripe.com",
  OPENAI_API_BASE: "https://api.openai.com",
  OPENAI_BASE_URL: "https://api.openai.com",
  TWILIO_API_BASE: "https://api.twilio.com",
  SENDGRID_API_BASE: "https://api.sendgrid.com",
  GITHUB_API_URL: "https://api.github.com",
  SLACK_API_URL: "https://slack.com/api",
  AWS_ENDPOINT_URL: "https://amazonaws.com",
  SENTRY_DSN: "https://sentry.io",
};

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

export async function loadEnvFile(
  scanRoot: string,
): Promise<Record<string, string>> {
  const envPath = join(scanRoot, ".env");
  try {
    const raw = await readFile(envPath, "utf-8");
    return parseDotenv(Buffer.from(raw));
  } catch {
    return {};
  }
}

export function buildEnvMap(
  dotenvVars: Record<string, string>,
  configEnv: Record<string, string> | undefined,
  useProcessEnv: boolean,
): Record<string, string> {
  const merged: Record<string, string> = {};

  // Lowest priority: known provider patterns
  for (const [key, value] of Object.entries(KNOWN_PROVIDERS)) {
    merged[key] = value;
  }

  // Process env (opt-in)
  if (useProcessEnv) {
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }

  // .env file overrides
  Object.assign(merged, dotenvVars);

  // Config file overrides (highest priority)
  if (configEnv) {
    Object.assign(merged, configEnv);
  }

  return merged;
}

// ---------------------------------------------------------------------------
// URL resolution
// ---------------------------------------------------------------------------

const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

/** Patterns that indicate secrets — redacted from resolved URLs to prevent exposure in TDM output */
const SECRET_PATTERNS = [
  /\bsk_[a-zA-Z0-9]{24,}/g, // Stripe secret key
  /\bghp_[a-zA-Z0-9]{36}/g, // GitHub personal access token
  /\bgho_[a-zA-Z0-9]{36}/g, // GitHub OAuth
  /\bBearer\s+[a-zA-Z0-9_\-\.]+/gi, // Bearer tokens
  /(?:api[_-]?key|key)=[^&\s]+/gi, // api_key=, key= values
];

function redactSecretsInUrl(url: string): string {
  let result = url;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

export function resolveUrl(
  urlTemplate: string,
  env: Record<string, string>,
): { resolved: string | null; confidence: Confidence } {
  // If no env vars in template, it's already resolved (still redact secrets)
  if (!urlTemplate.includes("${")) {
    return { resolved: redactSecretsInUrl(urlTemplate), confidence: "high" };
  }

  let allResolved = true;
  let anyResolved = false;

  const resolved = urlTemplate.replace(ENV_VAR_PATTERN, (_match, varName: string) => {
    const value = env[varName];
    if (value !== undefined) {
      anyResolved = true;
      return value;
    }
    allResolved = false;
    return `\${${varName}}`;
  });

  if (allResolved) {
    return { resolved: redactSecretsInUrl(resolved), confidence: "high" };
  }
  if (anyResolved) {
    return { resolved: redactSecretsInUrl(resolved), confidence: "medium" };
  }
  return { resolved: null, confidence: "low" };
}
