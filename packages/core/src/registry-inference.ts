// @thirdwatch/core — Package metadata inference for unregistered packages

interface PackageMetadata {
  homepage?: string | undefined;
  keywords?: string[] | undefined;
  description?: string | undefined;
}

const KNOWN_PROVIDER_SLUGS = new Set([
  "stripe",
  "paypal",
  "square",
  "braintree",
  "adyen",
  "plaid",
  "auth0",
  "okta",
  "clerk",
  "datadog",
  "newrelic",
  "pagerduty",
  "sentry",
  "segment",
  "mixpanel",
  "amplitude",
  "launchdarkly",
  "split",
  "aws",
  "gcp",
  "google",
  "azure",
  "firebase",
  "openai",
  "anthropic",
  "cohere",
  "replicate",
  "twilio",
  "sendgrid",
  "resend",
  "postmark",
  "mailgun",
  "slack",
  "discord",
  "github",
  "gitlab",
  "jira",
  "hubspot",
  "salesforce",
  "intercom",
  "zendesk",
  "algolia",
  "elasticsearch",
  "mongodb",
  "redis",
  "pinecone",
  "supabase",
  "vercel",
  "netlify",
  "cloudflare",
  "contentful",
  "sanity",
  "mapbox",
  "pusher",
  "linear",
]);

/**
 * Infer a provider slug from a package not in the curated registry.
 * Uses heuristics: homepage URL, keywords, and package name patterns.
 * Returns null if no provider can be inferred.
 */
export async function inferProvider(
  packageName: string,
  ecosystem: string,
): Promise<string | null> {
  // Strategy 1: Extract from package name (no network needed)
  const nameSlug = extractProviderFromName(packageName);
  if (nameSlug) return nameSlug;

  // Strategy 2: Fetch metadata from registry (optional, may fail offline)
  try {
    const meta = await fetchPackageMetadata(packageName, ecosystem);
    if (!meta) return null;

    // Check homepage domain
    if (meta.homepage) {
      const slug = extractProviderFromUrl(meta.homepage);
      if (slug) return slug;
    }

    // Check keywords
    if (meta.keywords) {
      for (const kw of meta.keywords) {
        if (KNOWN_PROVIDER_SLUGS.has(kw.toLowerCase())) {
          return kw.toLowerCase();
        }
      }
    }
  } catch {
    // Offline or rate limited — skip metadata inference
  }

  return null;
}

function extractProviderFromName(name: string): string | null {
  // Scoped packages: @provider/package → provider
  const scopeMatch = name.match(/^@([^/]+)\//);
  if (scopeMatch) {
    const scope = scopeMatch[1]!;
    if (KNOWN_PROVIDER_SLUGS.has(scope)) return scope;
  }

  // Hyphenated: provider-sdk, provider-client
  const parts = name.split(/[-_]/);
  if (parts.length >= 2) {
    const first = parts[0]!;
    if (KNOWN_PROVIDER_SLUGS.has(first)) return first;
  }

  return null;
}

function extractProviderFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    // api.stripe.com → stripe
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const domain = parts[parts.length - 2]!;
      if (KNOWN_PROVIDER_SLUGS.has(domain)) return domain;
    }
  } catch {
    // Invalid URL
  }
  return null;
}

async function fetchPackageMetadata(
  name: string,
  ecosystem: string,
): Promise<PackageMetadata | null> {
  switch (ecosystem) {
    case "npm": {
      const res = await fetch(`https://registry.npmjs.org/${name}`, {
        headers: { Accept: "application/vnd.npm.install-v1+json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      return {
        homepage: data.homepage as string | undefined,
        keywords: data.keywords as string[] | undefined,
        description: data.description as string | undefined,
      };
    }
    case "pypi": {
      const res = await fetch(`https://pypi.org/pypi/${name}/json`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const info = data.info as Record<string, unknown>;
      return {
        homepage: info.home_page as string | undefined,
        keywords: (info.keywords as string | undefined)
          ?.split(",")
          .map((k: string) => k.trim()),
        description: info.summary as string | undefined,
      };
    }
    default:
      return null;
  }
}
