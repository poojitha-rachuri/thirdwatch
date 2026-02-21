# ADR 003 — TDM as the Core Artifact

**Date:** 2026-02-21
**Status:** Accepted

## Context

We need to decide what the scanner's primary output should be and how tightly coupled it should be to the monitoring service.

## Decision

The **Thirdwatch Dependency Manifest (TDM)** is a first-class, versioned, portable artifact — separate from the monitoring service. It is defined by a published JSON Schema (`schema/v1/tdm.schema.json`) and a human-readable spec (`docs/architecture/tdm-spec.md`).

The scanner produces a TDM. The cloud service *optionally* consumes it. They are decoupled.

## Rationale

- **Standalone value:** Teams can commit their TDM to version control, diff it across releases, and use it for compliance reviews without paying for the cloud service. This drives adoption.
- **Open standard:** Positioning the TDM as an open spec (like SPDX for licenses, CycloneDX for vulnerabilities) creates a moat through ecosystem adoption rather than lock-in.
- **Clean architecture:** The scanner has no network calls (`--no-resolve` flag). Privacy by default — source code never leaves the machine.
- **Stable API surface:** The TDM schema is versioned with semver. Language analyzers are plugins that produce TDM entries. The cloud service is a consumer. None of these layers need to know about the others' internals.
- **Diffability:** Adding an `id` field to every TDM entity (e.g., `pkg:pypi:stripe@7.9.0`) makes `tdm diff old.json new.json` possible — the CI gate (Plan 11) depends on this.

## Consequences

- The TDM JSON Schema is a permanent public commitment. Breaking it (removing fields, changing types) requires a new major version (`2.0`).
- Every language analyzer plugin must produce entries that validate against the TDM JSON Schema.
- The `@thirdwatch/tdm` npm package (types + validation) must be published independently and treated as a stable library from v0.1.0.
