import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TDM Specification — Thirdwatch",
  description:
    "The Thirdwatch Dependency Manifest (TDM) v1.0 schema specification — structure, fields, and examples.",
};

export default function TDMSpecPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-3xl font-bold text-white">TDM Specification</h1>
      <p className="mt-3 text-zinc-400">
        The Thirdwatch Dependency Manifest (TDM) is a structured JSON artifact
        describing the entire external surface area of a codebase.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">Overview</h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          A TDM captures every external dependency your code interacts with:
          packages, HTTP APIs, SDKs, infrastructure connections, and webhooks.
          It is produced by running{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
            thirdwatch scan
          </code>{" "}
          and written to{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
            thirdwatch.json
          </code>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">Top-Level Structure</h2>
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <pre className="font-mono text-sm text-zinc-300">{`{
  "version": "1.0",
  "metadata": { ... },
  "packages": [ ... ],
  "apis": [ ... ],
  "sdks": [ ... ],
  "infrastructure": [ ... ],
  "webhooks": [ ... ]
}`}</pre>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">Sections</h2>

        <FieldSection
          title="metadata"
          description="Scan metadata and summary information."
          fields={[
            { name: "scan_timestamp", type: "string", desc: "ISO 8601 timestamp of when the scan ran" },
            { name: "scanner_version", type: "string", desc: "Version of the thirdwatch scanner" },
            { name: "repository", type: "string", desc: "Repository identifier" },
            { name: "languages_detected", type: "string[]", desc: "Programming languages found" },
            { name: "total_dependencies_found", type: "number", desc: "Total count of all dependencies" },
            { name: "scan_duration_ms", type: "number", desc: "Scan duration in milliseconds" },
          ]}
        />

        <FieldSection
          title="packages"
          description="Package manager dependencies (npm, pip, etc)."
          fields={[
            { name: "id", type: "string", desc: "Package URL (purl) identifier" },
            { name: "name", type: "string", desc: "Package name" },
            { name: "ecosystem", type: "string", desc: "Package ecosystem (npm, pypi, etc)" },
            { name: "current_version", type: "string", desc: "Resolved version" },
            { name: "version_constraint", type: "string", desc: "Version constraint from manifest" },
            { name: "manifest_file", type: "string", desc: "File declaring the dependency" },
            { name: "locations", type: "Location[]", desc: "Where the dependency appears" },
            { name: "usage_count", type: "number", desc: "Number of usages found" },
            { name: "confidence", type: "string", desc: "Detection confidence: high, medium, low" },
          ]}
        />

        <FieldSection
          title="apis"
          description="External HTTP API calls detected in code."
          fields={[
            { name: "id", type: "string", desc: "Unique API identifier" },
            { name: "url", type: "string", desc: "API endpoint URL or URL pattern" },
            { name: "method", type: "string", desc: "HTTP method (GET, POST, etc)" },
            { name: "provider", type: "string | null", desc: "Recognized API provider" },
            { name: "locations", type: "Location[]", desc: "Where the API call appears" },
            { name: "usage_count", type: "number", desc: "Number of call sites" },
            { name: "confidence", type: "string", desc: "Detection confidence" },
          ]}
        />

        <FieldSection
          title="sdks"
          description="SDK and client library usage."
          fields={[
            { name: "id", type: "string", desc: "Unique SDK identifier" },
            { name: "provider", type: "string", desc: "SDK provider (aws, stripe, etc)" },
            { name: "sdk_package", type: "string", desc: "Package name of the SDK" },
            { name: "services_used", type: "string[]", desc: "Cloud services accessed" },
            { name: "api_methods", type: "string[]", desc: "SDK methods called in code" },
            { name: "locations", type: "Location[]", desc: "Import and usage locations" },
            { name: "usage_count", type: "number", desc: "Number of usages" },
            { name: "confidence", type: "string", desc: "Detection confidence" },
          ]}
        />

        <FieldSection
          title="infrastructure"
          description="Database and infrastructure connections."
          fields={[
            { name: "id", type: "string", desc: "Unique infrastructure identifier" },
            { name: "type", type: "string", desc: "Infrastructure type (postgresql, redis, etc)" },
            { name: "connection_ref", type: "string", desc: "Environment variable or config key" },
            { name: "resolved_host", type: "string | null", desc: "Resolved hostname if available" },
            { name: "locations", type: "Location[]", desc: "Connection setup locations" },
            { name: "confidence", type: "string", desc: "Detection confidence" },
          ]}
        />

        <FieldSection
          title="webhooks"
          description="Inbound and outbound webhook registrations."
          fields={[
            { name: "id", type: "string", desc: "Unique webhook identifier" },
            { name: "direction", type: "string", desc: "inbound_callback or outbound_registration" },
            { name: "target_url", type: "string", desc: "Webhook URL or route path" },
            { name: "provider", type: "string", desc: "Webhook provider" },
            { name: "locations", type: "Location[]", desc: "Registration or handler locations" },
            { name: "confidence", type: "string", desc: "Detection confidence" },
          ]}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">Location Object</h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          Every dependency includes an array of locations pinpointing where it
          appears in the codebase.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-4 py-2 text-left font-medium text-zinc-300">Field</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-300">Type</th>
                <th className="px-4 py-2 text-left font-medium text-zinc-300">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-400">
              <tr className="border-b border-zinc-800">
                <td className="px-4 py-2 font-mono text-xs text-zinc-300">file</td>
                <td className="px-4 py-2 font-mono text-xs">string</td>
                <td className="px-4 py-2">Relative file path</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="px-4 py-2 font-mono text-xs text-zinc-300">line</td>
                <td className="px-4 py-2 font-mono text-xs">number</td>
                <td className="px-4 py-2">1-indexed line number</td>
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="px-4 py-2 font-mono text-xs text-zinc-300">context</td>
                <td className="px-4 py-2 font-mono text-xs">string?</td>
                <td className="px-4 py-2">Source code snippet at the location</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs text-zinc-300">usage</td>
                <td className="px-4 py-2 font-mono text-xs">string?</td>
                <td className="px-4 py-2">Usage type (import, http_call, env_var, etc)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white">JSON Schema</h2>
        <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
          The canonical JSON Schema is available at{" "}
          <a
            href="https://github.com/poojitha-rachuri/thirdwatch/blob/main/schema/v1/tdm.schema.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 underline"
          >
            schema/v1/tdm.schema.json
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function FieldSection({
  title,
  description,
  fields,
}: {
  title: string;
  description: string;
  fields: { name: string; type: string; desc: string }[];
}) {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-white">
        <code className="rounded bg-zinc-800 px-2 py-1 text-brand-400">{title}</code>
      </h3>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
      <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-2 text-left font-medium text-zinc-300">Field</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-300">Type</th>
              <th className="px-4 py-2 text-left font-medium text-zinc-300">Description</th>
            </tr>
          </thead>
          <tbody className="text-zinc-400">
            {fields.map((f) => (
              <tr key={f.name} className="border-b border-zinc-800 last:border-b-0">
                <td className="px-4 py-2 font-mono text-xs text-zinc-300">{f.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{f.type}</td>
                <td className="px-4 py-2">{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
