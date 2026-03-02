# SDK Registry

This directory contains YAML files defining patterns for known third-party SDK providers.
The Thirdwatch scanner uses these to automatically identify which provider an SDK belongs to
and enrich TDM output with provider metadata.

## Adding a New SDK

1. Create a new file: `registries/sdks/<provider-slug>.yml`
2. Follow the schema below
3. Open a PR — no code changes required

## Schema (v2)

```yaml
provider: stripe              # Unique slug for this provider
display_name: "Stripe"        # Human-readable name
homepage: "https://stripe.com"
changelog_url: "https://stripe.com/docs/changelog"  # For Phase 2 watcher

patterns:
  npm:                         # Supported ecosystems: npm, pypi, go, maven, cargo, packagist
    - package: "stripe"
      import_patterns:         # Strings/patterns to match in import/require statements
        - "stripe"
        - "Stripe"
  pypi:
    - package: "stripe"
      import_patterns:
        - "import stripe"
        - "from stripe"

constructors:                  # Constructor names that indicate SDK usage
  npm:
    - name: "Stripe"
      services_field: null     # Optional: field on the instance that exposes sub-services
  pypi:
    - name: "StripeClient"

factories:                     # Factory function names that create SDK clients
  npm:
    - "createStripeClient"

known_api_base_urls:           # Used to auto-detect provider from URL
  - "https://api.stripe.com"

env_var_patterns:              # Env var names that suggest this SDK is in use
  - "STRIPE_API_KEY"
  - "STRIPE_SECRET_KEY"
```

## Existing Registries

| File | Provider |
|---|---|
| `adyen.yml` | Adyen |
| `algolia.yml` | Algolia |
| `amplitude.yml` | Amplitude |
| `anthropic.yml` | Anthropic |
| `auth0.yml` | Auth0 |
| `aws.yml` | Amazon Web Services |
| `braintree.yml` | Braintree |
| `clerk.yml` | Clerk |
| `cloudflare.yml` | Cloudflare |
| `cohere.yml` | Cohere |
| `contentful.yml` | Contentful |
| `datadog.yml` | Datadog |
| `elasticsearch.yml` | Elasticsearch |
| `firebase.yml` | Firebase / Google |
| `github.yml` | GitHub |
| `gitlab.yml` | GitLab |
| `hubspot.yml` | HubSpot |
| `intercom.yml` | Intercom |
| `jira.yml` | Jira |
| `launchdarkly.yml` | LaunchDarkly |
| `linear.yml` | Linear |
| `mailgun.yml` | Mailgun |
| `mapbox.yml` | Mapbox |
| `mixpanel.yml` | Mixpanel |
| `mongodb.yml` | MongoDB Atlas |
| `netlify.yml` | Netlify |
| `newrelic.yml` | New Relic |
| `okta.yml` | Okta |
| `openai.yml` | OpenAI |
| `pagerduty.yml` | PagerDuty |
| `paypal.yml` | PayPal |
| `pinecone.yml` | Pinecone |
| `plaid.yml` | Plaid |
| `postmark.yml` | Postmark |
| `pusher.yml` | Pusher |
| `redis.yml` | Redis |
| `replicate.yml` | Replicate |
| `resend.yml` | Resend |
| `salesforce.yml` | Salesforce |
| `sanity.yml` | Sanity |
| `segment.yml` | Segment |
| `sendgrid.yml` | SendGrid / Twilio |
| `sentry.yml` | Sentry |
| `slack.yml` | Slack |
| `split.yml` | Split |
| `square.yml` | Square |
| `stripe.yml` | Stripe |
| `supabase.yml` | Supabase |
| `twilio.yml` | Twilio |
| `vercel.yml` | Vercel |
| `zendesk.yml` | Zendesk |

## Contributing

To add a new provider:

1. Create `registries/sdks/<provider-slug>.yml` using the schema above.
2. Fill in at least `provider`, `display_name`, and one ecosystem under `patterns`.
3. Add `constructors` and `factories` if the SDK uses named constructors or factory functions.
4. Add `known_api_base_urls` for any REST endpoints the SDK calls.
5. Add `env_var_patterns` for environment variables typically used to configure the SDK.
6. Run `make test` to verify the registry loads correctly.
7. Open a PR — no code changes required, just the YAML file.
