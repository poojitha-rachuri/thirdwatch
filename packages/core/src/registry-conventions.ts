// @thirdwatch/core — Convention-based provider detection fallback

import type { Confidence } from "@thirdwatch/tdm";

interface ConventionResult {
  provider: string;
  confidence: Confidence;
}

const KNOWN_BRANDS = new Set([
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

const API_DOMAIN_TO_PROVIDER = new Map<string, string>([
  ["api.stripe.com", "stripe"],
  ["api.openai.com", "openai"],
  ["api.anthropic.com", "anthropic"],
  ["api.twilio.com", "twilio"],
  ["api.sendgrid.com", "sendgrid"],
  ["s3.amazonaws.com", "aws"],
  ["sqs.amazonaws.com", "aws"],
  ["dynamodb.amazonaws.com", "aws"],
  ["api.github.com", "github"],
  ["api.slack.com", "slack"],
  ["hooks.slack.com", "slack"],
  ["api.hubapi.com", "hubspot"],
  ["api.intercom.io", "intercom"],
  ["api.segment.io", "segment"],
  ["api.mixpanel.com", "mixpanel"],
  ["api2.amplitude.com", "amplitude"],
  ["api.mapbox.com", "mapbox"],
  ["api.linear.app", "linear"],
  ["api.replicate.com", "replicate"],
  ["api.cohere.ai", "cohere"],
  ["api.pinecone.io", "pinecone"],
  ["api.datadoghq.com", "datadog"],
  ["api.pagerduty.com", "pagerduty"],
  ["api.cloudflare.com", "cloudflare"],
  ["api.vercel.com", "vercel"],
  ["api.netlify.com", "netlify"],
  ["api.resend.com", "resend"],
  ["api.postmarkapp.com", "postmark"],
  ["api.mailgun.net", "mailgun"],
  ["api.algolia.com", "algolia"],
  ["cdn.contentful.com", "contentful"],
  ["api.sanity.io", "sanity"],
  ["api.pusherapp.com", "pusher"],
]);

/**
 * Detect a provider using naming conventions and URL pattern matching.
 * This is the lowest-priority fallback in the detection chain.
 */
export function detectByConvention(
  packageName: string,
  source: string,
): ConventionResult | null {
  // Convention 1: Package name contains known brand
  for (const brand of KNOWN_BRANDS) {
    if (packageName.toLowerCase().includes(brand)) {
      return { provider: brand, confidence: "medium" };
    }
  }

  // Convention 2: Code references known API domains
  const domainMatches = source.match(
    /https?:\/\/([\w-]+\.)*(\w+)\.(com|io|dev|ai|co)\//g,
  );
  if (domainMatches) {
    for (const url of domainMatches) {
      try {
        const hostname = new URL(url).hostname;
        const provider = API_DOMAIN_TO_PROVIDER.get(hostname);
        if (provider) {
          return { provider, confidence: "medium" };
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return null;
}
