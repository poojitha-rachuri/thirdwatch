# SDK Registry

This directory contains YAML files defining patterns for known third-party SDK providers.
The Thirdwatch scanner uses these to automatically identify which provider an SDK belongs to
and enrich TDM output with provider metadata.

## Adding a New SDK

1. Create a new file: `registries/sdks/<provider-slug>.yml`
2. Follow the schema below
3. Open a PR — no code changes required

## Schema

```yaml
provider: stripe              # Unique slug for this provider
display_name: "Stripe"        # Human-readable name
homepage: "https://stripe.com"
changelog_url: "https://stripe.com/docs/changelog"  # For Phase 2 watcher

patterns:
  npm:
    - package: "stripe"
      import_patterns:        # Strings/patterns to match in import/require statements
        - "stripe"
        - "Stripe"
  pypi:
    - package: "stripe"
      import_patterns:
        - "import stripe"
        - "from stripe"

known_api_base_urls:           # Used to auto-detect provider from URL
  - "https://api.stripe.com"

env_var_patterns:              # Env var names that suggest this SDK is in use
  - "STRIPE_API_KEY"
  - "STRIPE_SECRET_KEY"
```

## Existing Registries

| File | Provider |
|---|---|
| `aws.yml` | Amazon Web Services |
| `stripe.yml` | Stripe |
| `openai.yml` | OpenAI |
| `anthropic.yml` | Anthropic |
| `twilio.yml` | Twilio |
| `firebase.yml` | Firebase / Google |
| `sendgrid.yml` | SendGrid / Twilio |
| `datadog.yml` | Datadog |
| `sentry.yml` | Sentry |
| `slack.yml` | Slack |
| `supabase.yml` | Supabase |
| `resend.yml` | Resend |
| `pinecone.yml` | Pinecone |
| `cloudflare.yml` | Cloudflare |
