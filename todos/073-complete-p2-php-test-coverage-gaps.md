---
status: complete
priority: p2
issue_id: "073"
tags: [code-review, php, testing]
dependencies: []
---

# PHP Analyzer: Missing Test Coverage for Several Patterns

## Problem Statement

The PHP analyzer tests cover the happy path for the main `app.php` fixture, but several detection patterns have no test coverage or their tests have ambiguous assertions that could pass even when a specific pattern is broken.

## Findings

**Missing or weak tests:**

1. **`base_uri` config pattern** — `BASE_URI` pattern defined in `HTTP_PATTERNS` but no test asserts its detection
2. **SendGrid SDK** — `SDK_PATTERNS` includes SendGrid (`new \SendGrid(`) but no test
3. **Sentry SDK** — `SDK_PATTERNS` includes Sentry (`\Sentry\init(`) but no test
4. **`ext-*` exclusion** — `manifests.test.ts` has test "excludes php and ext-* entries" but `fixtures/php-app/composer.json` has no `ext-*` entries, so this test can only verify `php` exclusion
5. **Infrastructure connection string patterns** — `CONN_STRING_PATTERNS` has mongodb://, redis://, mysql://, pgsql:// but no test exercises these
6. **Non-HTTP `file_get_contents`** — no negative test verifying that `file_get_contents('/local/path')` is NOT emitted
7. **`CURLOPT_URL` detection** — fixture `app.php:20` has it but `analyzer.test.ts` only checks for `api.weather.io` without specifying detection source; overlaps with curl_init test (both match `api.example.com`)
8. **Ambiguous test overlap** — "detects curl_init URL" and "detects Laravel Http::get" both check for `api.example.com/users`; if curl_init is broken but Laravel Http works, both tests still pass

**File:** `packages/languages/php/src/__tests__/analyzer.test.ts`

## Proposed Solutions

### Option 1: Add fixture entries and targeted tests (Recommended)

1. Add `new \SendGrid($key);` and `\Sentry\init([...]);` to `fixtures/php-app/app.php`
2. Add `base_uri` config: `$client = new \GuzzleHttp\Client(['base_uri' => 'https://api.sendgrid.com']);`
3. Add `ext-json` to `fixtures/php-app/composer.json` require to exercise ext-* exclusion
4. Add mongodb:// connection string URL to `app.php`
5. Add `file_get_contents('/local/file.txt')` to `app.php` for negative test
6. Disambiguate existing tests with specific URL checks

**Effort:** Small
**Risk:** None

## Recommended Action

Option 1 — expand fixtures and tests for full coverage.

## Technical Details

**Affected files:**
- `packages/languages/php/src/__tests__/analyzer.test.ts`
- `packages/languages/php/src/__tests__/manifests.test.ts`
- `fixtures/php-app/app.php`
- `fixtures/php-app/composer.json`

## Acceptance Criteria

- [ ] SendGrid and Sentry SDK entries tested
- [ ] `base_uri` config pattern tested
- [ ] `ext-*` exclusion in manifests tested with an actual ext-* entry
- [ ] Non-HTTP `file_get_contents` negative test
- [ ] No ambiguous test assertions (each test is specific enough to catch the individual pattern it covers)

## Work Log

- 2026-02-26: Filed during PR #17 review (PHP analyzer)
