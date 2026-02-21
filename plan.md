Thirdwatch — Product Requirements Document (PRD)
Document Version: 1.0 Author: Pushpak Teja Date: February 21, 2026 Domain: thirdwatch.dev Repository: github.com/[org]/thirdwatch License: Apache 2.0 (core) / BSL 1.1 (cloud features)

1. Vision
Every production codebase silently depends on dozens — sometimes hundreds — of external services, APIs, packages, and endpoints that it doesn't own or control. When those change, teams find out through production incidents, not proactive alerts. Thirdwatch is the first tool that scans any codebase, maps every third-party dependency surface, continuously monitors for changes, and prioritizes breaking changes — before they break you.

One-liner: Know before you break — continuous monitoring for every external dependency in your codebase.

2. Problem Statement
Today's engineering teams face a blind spot. Tools like Dependabot and Renovate monitor package versions but ignore the much larger surface area of external HTTP APIs, SaaS endpoints, SDKs, webhooks, gRPC services, and database connections. Meanwhile, API monitoring tools like Moesif and Datadog track your own APIs, not the third-party APIs you consume. The result is a gap: no tool answers the question "What external things does my code depend on, and have any of them changed in ways that could break us?"

The cost of this gap is measured in production outages, emergency hotfixes, and wasted on-call hours spent debugging changes that were publicly announced but never surfaced to the right team.

3. Target Users
Primary Persona — The Platform/DevOps Engineer: Responsible for reliability across multiple services. Needs a single pane of glass showing every external dependency across repos, with alerts routed to the right team.

Secondary Persona — The Backend Developer: Integrates with third-party APIs daily (Stripe, Twilio, AWS, OpenAI, etc.). Wants to know when an API they call is deprecating an endpoint or changing a response schema.

Tertiary Persona — The Engineering Manager / VP Eng: Needs a risk dashboard: "How exposed are we to third-party changes across our 40 microservices?"

4. Product Principles
P1 — Local-first, privacy-by-default. The scanner runs on the developer's machine. Source code never leaves the local environment. Only a structured metadata manifest (the Dependency Graph) is optionally uploaded for cloud monitoring.

P2 — Open core, not open wrapper. The CLI scanner and the manifest format are fully open source and genuinely useful standalone. The cloud layer adds convenience and scale, not artificial gating.

P3 — Signal over noise. Every alert must be prioritized by actual impact on the user's codebase. A breaking change to an endpoint you call 200 times is critical. A deprecation of a parameter you don't use is informational. If we can't assess impact, we say so explicitly rather than crying wolf.

P4 — Language-agnostic by architecture. The scanner uses Tree-sitter for multi-language AST parsing with pluggable language analyzers. Day 1 supports Python, JavaScript/TypeScript, and Go. The architecture makes adding new languages a community contribution path.

P5 — Works with your stack, doesn't replace it. Thirdwatch integrates with existing tools (GitHub, GitLab, Jira, Slack, PagerDuty) rather than creating a new destination.

5. System Architecture Overview
The system is composed of four distinct layers, each deployable independently:

Layer 1 — The Scanner (Open Source CLI) Parses a codebase and produces a Thirdwatch Dependency Manifest (TDM) — a structured JSON/YAML file cataloging every discovered external dependency, its type, location in code, and usage frequency.

Layer 2 — The Watcher (Agent / Cloud Service) Consumes a TDM and continuously monitors each dependency against its source of truth (package registries, GitHub releases, API changelogs, status pages). Detects changes and classifies them.

Layer 3 — The Analyzer (Prioritization Engine) Cross-references detected changes against the codebase's actual usage patterns (from the TDM) to produce a prioritized impact assessment.

Layer 4 — The Notifier (Integration Layer) Routes prioritized alerts to the right destination: GitHub Issues, Jira tickets, Slack messages, PR comments, PagerDuty incidents, or email digests.

6. Detailed Functional Requirements
6.1 — The Scanner (Layer 1)
FR-1.1: Multi-Language Code Parsing The scanner SHALL parse source code using Tree-sitter to build ASTs for supported languages. Initial language support SHALL include Python, JavaScript/TypeScript, and Go. The architecture SHALL expose a plugin interface so community contributors can add new language analyzers without modifying core scanner logic.

FR-1.2: Package Dependency Discovery The scanner SHALL read and parse standard manifest files: package.json and package-lock.json (npm/yarn), requirements.txt, Pipfile, pyproject.toml, and poetry.lock (Python), go.mod and go.sum (Go). For each package, the scanner SHALL record: package name, current version, version constraint, registry source, and the files in the codebase that import or use it.

FR-1.3: External HTTP/API Endpoint Discovery The scanner SHALL detect outbound HTTP calls by identifying usage patterns of common HTTP clients: fetch, axios, http, urllib, requests, httpx, net/http, got, superagent, and equivalents. For each discovered call, the scanner SHALL extract: the target URL or URL pattern (handling string concatenation, template literals, and f-strings), the HTTP method, headers being set, and the file + line number. The scanner SHALL attempt to resolve URLs that reference environment variables or config files by tracing variable assignments within the same file and across imported config modules.

FR-1.4: SDK / Service Client Discovery The scanner SHALL detect instantiation of known third-party SDK clients. An initial registry of SDK patterns SHALL include: AWS SDK (boto3, @aws-sdk/*, aws-sdk-go), Stripe (stripe), Twilio (twilio), OpenAI (openai), Firebase (firebase-admin), SendGrid, Datadog, Sentry, Slack SDK, and Google Cloud client libraries. The registry SHALL be community-extensible via a YAML/JSON configuration file. For each detected SDK, the scanner SHALL record: the service provider, SDK package and version, specific API methods called, and file + line locations.

FR-1.5: Connection String & Infrastructure Discovery The scanner SHALL detect database connection strings (PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch), message queue connections (RabbitMQ, Kafka, SQS), and storage service references (S3, GCS, Azure Blob). Detection SHALL cover both direct string literals and references to environment variable names commonly used for these services.

FR-1.6: Webhook & Callback URL Discovery The scanner SHALL detect outbound webhook registrations and callback URLs defined in the codebase — URLs where the application tells a third-party service to send data back. This includes webhook setup calls in SDK clients and URL patterns in configuration files.

FR-1.7: Thirdwatch Dependency Manifest (TDM) Output The scanner SHALL output a structured Thirdwatch Dependency Manifest in both JSON and YAML formats. The TDM schema SHALL include the following top-level sections: metadata (scan timestamp, repo identifier, scanner version, languages detected), packages (discovered package dependencies), apis (discovered external API endpoints), sdks (discovered SDK clients), infrastructure (discovered database/queue/storage connections), and webhooks (discovered webhook/callback URLs). Each entry SHALL include a locations array containing file paths, line numbers, and a usage_count indicating how many times that dependency is referenced across the codebase. The TDM format SHALL be versioned using semver for the schema itself.

FR-1.8: CLI Interface The scanner SHALL be invoked via a CLI command: thirdwatch scan [path] [options]. Options SHALL include: --output (file path for TDM output, defaults to ./thirdwatch.json), --format (json or yaml), --languages (filter to specific languages), --ignore (glob patterns for files/directories to skip), --config (path to a .thirdwatch.yml config file), --verbose (detailed logging), and --no-resolve (skip environment variable / config resolution). The scanner SHALL also support a .thirdwatchignore file following .gitignore syntax.

FR-1.9: Performance Requirements The scanner SHALL process a 100,000 LOC codebase in under 60 seconds on a standard developer machine (4-core, 8GB RAM). The scanner SHALL support incremental scanning by accepting a previous TDM as input and only re-scanning changed files (determined via git diff or file modification timestamps).

FR-1.10: Confidence Scoring Each discovered dependency SHALL have a confidence field: high (deterministic AST match — e.g., a requests.get("https://api.stripe.com/v1/charges") literal), medium (pattern match with inference — e.g., a URL constructed from variables where the base was resolved), or low (heuristic match — e.g., an environment variable named STRIPE_API_URL where the actual URL couldn't be resolved). This allows users to filter and triage results by reliability.

6.2 — The Watcher (Layer 2)
FR-2.1: Package Registry Monitoring The Watcher SHALL poll package registries (npm, PyPI, Maven Central, Go Module Proxy) for new versions of packages listed in a TDM. Polling frequency SHALL be configurable, defaulting to every 6 hours. For each new version detected, the Watcher SHALL retrieve: version number, release date, changelog/release notes (from the registry, GitHub Releases, or the repository's CHANGELOG.md), and semver classification (major/minor/patch).

FR-2.2: GitHub Release & Changelog Monitoring For dependencies linked to a GitHub (or GitLab) repository, the Watcher SHALL monitor GitHub Releases, the CHANGELOG.md file, and tagged commits for new entries. The Watcher SHALL use the GitHub API with conditional requests (ETags/If-Modified-Since) to minimize API rate consumption.

FR-2.3: API Changelog & Documentation Monitoring For known API providers (Stripe, Twilio, OpenAI, AWS, etc.), the Watcher SHALL monitor official changelog pages, developer blogs, and status pages for announcements. An initial registry of changelog sources SHALL be maintained for the top 50 most commonly discovered API providers. The registry SHALL be community-extensible. For APIs without known changelog sources, the Watcher SHALL fall back to monitoring the provider's OpenAPI/Swagger spec URL if one is configured, using oasdiff-style diffing to detect endpoint changes.

FR-2.4: Change Classification Engine Every detected change SHALL be classified into one of the following categories: breaking (removed endpoint, removed field, changed authentication, incompatible schema change, removed package export), deprecation (announced deprecation timeline, sunset header detected, deprecated field), major-update (major version bump, significant new functionality), minor-update (minor version bump, non-breaking additions), patch (bug fix, security patch), security (CVE published, security advisory), or informational (documentation change, status page update). Classification SHALL use a rules engine for structured data (semver changes, OpenAPI diffs) and an LLM-assisted classifier for unstructured data (changelog prose, blog posts). The LLM classifier SHALL be optional and configurable — the system SHALL function without it, falling back to keyword-based heuristics.

FR-2.5: Self-Hosted Watcher Mode The Watcher SHALL be deployable as a self-hosted Docker container that reads TDM files from a local directory or S3-compatible storage and writes change events to a configurable output (stdout, file, webhook, or message queue). This allows air-gapped environments to use Thirdwatch without the cloud service.

6.3 — The Analyzer (Layer 3)
FR-3.1: Impact Scoring Each detected change SHALL be scored against the codebase's actual usage patterns from the TDM. The impact score SHALL be computed based on: usage frequency (how many times the affected dependency is called), code spread (how many files/modules reference it), criticality path (whether it's in a hot path like authentication, payments, or data pipeline — detected via directory naming heuristics and configurable labels), and change severity (from the classification engine). The output SHALL be a numeric priority score (P0–P4) with a human-readable explanation.

FR-3.2: Affected Code Mapping For each change, the Analyzer SHALL output the specific files and line numbers in the codebase that are affected, along with the nature of the impact (e.g., "You call POST /v1/charges with parameter source which was removed in Stripe API version 2025-12-01. Found in: payments/stripe_client.py:47, checkout/handler.py:112").

FR-3.3: Remediation Suggestions For package updates, the Analyzer SHALL link to the migration guide or changelog entry. For API changes, it SHALL surface the provider's recommended migration path if available. For breaking changes with high impact, the Analyzer SHALL generate a draft code change suggestion where feasible (e.g., "rename parameter source to payment_method"), flagged as AI-generated and requiring human review.

FR-3.4: Noise Suppression The Analyzer SHALL support user-configurable suppression rules: suppress by dependency name, by change category, by priority threshold, or by file path. Suppressed items SHALL still be recorded in the audit log but SHALL NOT trigger notifications.

6.4 — The Notifier (Layer 4)
FR-4.1: GitHub Integration Thirdwatch SHALL be installable as a GitHub App with scoped permissions (Issues: write, Pull Requests: write, Checks: write). It SHALL create GitHub Issues for detected changes above a configurable priority threshold, with structured labels (thirdwatch, breaking-change, P0, etc.). It SHALL optionally create a PR comment when a dependency change is detected that affects files modified in the PR.

FR-4.2: GitLab Integration Equivalent functionality to the GitHub integration using GitLab's API: Issues, Merge Request comments, and CI/CD pipeline integration.

FR-4.3: Jira Integration Thirdwatch SHALL create Jira tickets via the Jira REST API, with configurable project, issue type, priority mapping (P0→Blocker, P1→Critical, etc.), labels, and assignee rules. It SHALL deduplicate by checking for existing open tickets for the same dependency+change before creating a new one.

FR-4.4: Slack Integration Thirdwatch SHALL send Slack notifications via Incoming Webhooks or the Slack API. Messages SHALL include: dependency name, change summary, priority, affected files count, and a link to the full Thirdwatch report. It SHALL support channel routing rules (e.g., P0 changes go to #incidents, P1–P2 go to #engineering-alerts, P3+ go to a weekly digest).

FR-4.5: Email Digest Thirdwatch SHALL support a configurable email digest (daily or weekly) summarizing all detected changes across all monitored repositories, grouped by priority.

FR-4.6: Webhook / Generic Integration Thirdwatch SHALL support sending change events as JSON payloads to arbitrary webhook URLs, enabling integration with PagerDuty, Microsoft Teams, Discord, or custom internal tools.

FR-4.7: CI/CD Pipeline Integration Thirdwatch SHALL provide a GitHub Action, GitLab CI template, and generic CI script that runs the scanner as part of the CI pipeline, compares the resulting TDM against the previously stored TDM, and fails the build (or posts a warning) if new unmonitored external dependencies are detected. This acts as a "dependency review gate."

7. Thirdwatch Dependency Manifest (TDM) — Schema Specification
Copy# thirdwatch.json / thirdwatch.yaml
version: "1.0"
metadata:
  scan_timestamp: "2026-02-21T07:55:00Z"
  scanner_version: "0.1.0"
  repository: "github.com/acme/payments-service"
  languages_detected: ["python", "javascript"]
  total_dependencies_found: 47
  scan_duration_ms: 12340

packages:
  - name: "stripe"
    ecosystem: "pypi"
    current_version: "7.9.0"
    version_constraint: "^7.0.0"
    manifest_file: "requirements.txt"
    locations:
      - file: "payments/stripe_client.py"
        line: 3
        usage: "import"
      - file: "payments/stripe_client.py"
        line: 45
        usage: "method_call:stripe.Charge.create"
    usage_count: 14
    confidence: "high"

apis:
  - url: "https://api.openai.com/v1/chat/completions"
    method: "POST"
    provider: "openai"  # auto-detected or null
    headers:
      - "Authorization: Bearer ${OPENAI_API_KEY}"
      - "Content-Type: application/json"
    locations:
      - file: "ai/completion_service.py"
        line: 78
        context: "requests.post(OPENAI_URL, ...)"
    usage_count: 6
    confidence: "high"

  - url: "${PARTNER_API_BASE}/v2/orders"
    method: "GET"
    provider: null
    resolved_url: "https://api.partner.com/v2/orders"  # if resolved
    locations:
      - file: "integrations/partner.py"
        line: 23
    usage_count: 2
    confidence: "medium"

sdks:
  - provider: "aws"
    sdk_package: "boto3"
    services_used: ["s3", "sqs", "dynamodb"]
    locations:
      - file: "infra/storage.py"
        line: 12
        usage: "client_init:s3"
      - file: "workers/queue.py"
        line: 8
        usage: "client_init:sqs"
    usage_count: 23
    confidence: "high"

infrastructure:
  - type: "postgresql"
    connection_ref: "${DATABASE_URL}"
    resolved_host: null
    locations:
      - file: "db/connection.py"
        line: 5
    confidence: "medium"

  - type: "redis"
    connection_ref: "redis://cache.internal:6379"
    locations:
      - file: "cache/redis_client.py"
        line: 11
    confidence: "high"

webhooks:
  - direction: "outbound_registration"
    target_url: "https://hooks.slack.com/services/${SLACK_WEBHOOK}"
    locations:
      - file: "notifications/slack.py"
        line: 34
    confidence: "medium"
Copy
8. Non-Functional Requirements
NFR-1: Security & Privacy The CLI scanner SHALL operate entirely offline with no network calls. The TDM SHALL NOT contain source code — only file paths, line numbers, dependency identifiers, and URL patterns. The cloud service SHALL encrypt TDMs at rest (AES-256) and in transit (TLS 1.3). The cloud service SHALL support org-level data isolation and deletion on request.

NFR-2: Extensibility Language analyzers SHALL follow a plugin interface defined as: Analyzer.discover(ast: Tree, file_path: string) → DependencyEntry[]. SDK pattern registries SHALL be defined as YAML files that can be overridden or extended by the user via .thirdwatch.yml. Changelog source registries SHALL follow the same pattern.

NFR-3: Reliability The cloud Watcher service SHALL have 99.9% uptime for monitoring and alert delivery. Missed polling windows SHALL be automatically retried. Alert delivery SHALL guarantee at-least-once delivery with deduplication at the Notifier layer.

NFR-4: Observability The Watcher and Analyzer services SHALL expose Prometheus-compatible metrics: dependencies monitored, changes detected (by category), alerts sent (by channel), scan duration, and classification confidence distribution. A health check endpoint SHALL be available at /healthz.

9. Phased Delivery Roadmap
Phase 1 — "The Map" (Weeks 1–6)
Deliver the open-source CLI scanner (Layer 1) with full TDM output for Python and JavaScript/TypeScript. The scanner should be installable via npm, pip, and brew. The TDM format spec should be published as a standalone document. Goal: launch on Hacker News, target 500+ GitHub stars, collect feedback on scan accuracy and TDM usefulness. No cloud service. No monitoring. Just the map.

Phase 2 — "The Pulse" (Weeks 7–14)
Add the Watcher (Layer 2) as a self-hosted Docker container and a free cloud beta. Package registry monitoring (npm + PyPI) and GitHub release monitoring only. Basic classification (semver-based). Email digest and Slack notifications. Goal: 50 teams running continuous monitoring, learn what change types matter most.

Phase 3 — "The Brain" (Weeks 15–22)
Add the Analyzer (Layer 3) with impact scoring, affected code mapping, and remediation suggestions. LLM-assisted changelog parsing for unstructured release notes. GitHub and Jira integrations. CI/CD pipeline gate. Goal: demonstrate clear ROI (incident prevention), begin outbound to engineering leaders.

Phase 4 — "The Platform" (Weeks 23–30)
Add Go language support. Add the org-wide dashboard for multi-repo visibility. Enterprise features: SSO, RBAC, audit logs, SBOM export compatibility, self-hosted cloud deployment. API changelog monitoring for top 50 providers. This is where monetization activates.

10. Monetization Tiers
Community (Free, Open Source Forever): CLI scanner, TDM output, CI/CD gate action, self-hosted Watcher for 1 repo, community SDK/changelog registries.

Team ($29/dev/month): Cloud-hosted monitoring for up to 20 repos, AI-powered change classification, impact scoring, Slack + GitHub + Jira integrations, weekly digest, 90-day change history.

Enterprise (Custom Pricing): Unlimited repos, self-hosted cloud deployment, SSO/SAML, RBAC, audit logs, SBOM export, SLA-backed monitoring, dedicated onboarding, custom changelog source integrations, and access to the aggregated (anonymized) ecosystem intelligence dashboard.

11. Success Metrics
Phase 1 — Adoption: 1,000 GitHub stars within 60 days of launch. 200+ unique CLI installs per week. 5+ community blog posts or tweets referencing TDM output. At least 2 community-contributed language analyzers or SDK patterns.

Phase 2 — Engagement: 50 teams with active Watcher agents. Alert open rate above 60%. Less than 10% of alerts marked as "not useful" by users. Average time from change detection to alert delivery under 2 hours.

Phase 3 — Value: At least 3 documented cases of Thirdwatch preventing a production incident. 20% of Phase 2 users upgrading to paid. NPS above 40 from active users.

Phase 4 — Revenue: $10K MRR within 90 days of paid launch. 5 enterprise pilots. Community contribution rate of 2+ PRs per week from external contributors.

12. Key Technical Decisions & Rationale
Tree-sitter for parsing: Rather than building per-language parsers or relying solely on regex, Tree-sitter provides production-grade, incremental AST parsing across 40+ languages with a single core engine. This is the same technology used by Neovim, GitHub's code search, and Zed editor. It gives Thirdwatch a credible path to supporting any language without rewriting the scanner.

TDM as the core artifact: By defining the Thirdwatch Dependency Manifest as a first-class, versioned, portable artifact — like an SBOM but for external dependencies — we create value even without the monitoring layer. Teams can commit their TDM to version control, diff it across releases, and use it for compliance or architecture reviews. This is the "plant the flag" move that establishes a new standard.

LLM classification as optional: The changelog parsing LLM is powerful but introduces cost, latency, and a dependency on an external AI provider. Making it optional means the tool works in air-gapped environments and doesn't require an API key for basic functionality. The rules engine + keyword heuristics should handle 70–80% of cases; the LLM catches the nuanced remainder.

Apache 2.0 + BSL 1.1 licensing: The scanner and TDM spec are Apache 2.0 — maximally permissive, encouraging adoption and contribution. Cloud-specific features (multi-repo dashboard, advanced analytics, enterprise integrations) use the Business Source License, which converts to open source after 3 years. This is the model used by Sentry, CockroachDB, and MariaDB — proven to balance openness with commercial viability.

13. Competitive Positioning
Dependabot / Renovate: Watch package versions. Thirdwatch watches everything your code talks to.

Snyk: Focused on security vulnerabilities (CVEs). Thirdwatch is focused on functionality-breaking changes and deprecations — the other 80% of third-party risk that nobody is tracking.

Fossabot (FOSSA): AI review of Dependabot PRs for JS/TS only. Thirdwatch is language-agnostic, covers APIs and services beyond packages, and provides continuous monitoring rather than reactive PR review.

oasdiff: Diffs two OpenAPI specs you already have. Thirdwatch discovers what you depend on, finds the specs, and monitors them for you.

API monitoring tools (Datadog, Moesif): Monitor your APIs for your consumers. Thirdwatch monitors other people's APIs for you.

14. Open Questions for Community Input
OQ-1: Should the TDM include a risk_profile section that pre-computes vendor concentration risk (e.g., "73% of your external calls depend on AWS")?

OQ-2: Should Thirdwatch monitor API response schema changes by periodically making test calls to endpoints (with user-provided credentials), or is that scope creep best left to contract testing tools like Pact?

OQ-3: Should the CI/CD gate block PRs that introduce new unmonitored dependencies, or only warn? What's the right default?

OQ-4: Is there value in a "Thirdwatch Score" — a single number representing a repo's external dependency risk exposure — similar to a credit score for codebases?

