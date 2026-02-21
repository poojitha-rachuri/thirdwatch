# Test Fixtures

Realistic codebases used to verify Thirdwatch scanner detection accuracy.
These are **not** real applications — they exist solely as scan targets.

## Fixtures

| Directory | Languages | Providers Covered |
|---|---|---|
| `python-app/` | Python | Stripe, OpenAI, AWS (boto3, S3, SQS, DynamoDB), Redis, PostgreSQL |
| `node-app/` | TypeScript | OpenAI, Stripe, AWS SDK v3, Twilio, Slack, Redis, PostgreSQL |
| `mixed-monorepo/` | Python + TypeScript | Stripe, OpenAI, Twilio, AWS, Sentry, Anthropic, Slack, Supabase, Resend |

## Running Scanner Against Fixtures

```bash
# Scan a specific fixture
pnpm --filter thirdwatch start scan ./fixtures/python-app
pnpm --filter thirdwatch start scan ./fixtures/node-app
pnpm --filter thirdwatch start scan ./fixtures/mixed-monorepo

# Scan all fixtures
make scan-fixtures
```

## Adding a New Fixture

1. Create `fixtures/<name>/` with realistic code using real SDK patterns
2. Include `requirements.txt` (Python) and/or `package.json` (Node.js)
3. Cover as many detection kinds as possible: `import`, `http_call`, `instantiation`, `env_var`
4. Add a row to the table above

Fixtures should be self-contained (no real credentials, no external calls at import time).
