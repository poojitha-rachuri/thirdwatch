const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

async function apiFetch<T>(
  path: string,
  opts?: { token?: string; method?: string; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts?.token) headers["x-api-key"] = opts.token;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts?.method ?? "GET",
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({
      error: res.statusText,
    }))) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getOrg: (token: string) =>
    apiFetch<{ id: string; name: string; plan: string }>("/api/v1/org", {
      token,
    }),
  getUsage: (token: string) =>
    apiFetch<{
      plan: string;
      repositories: { used: number; limit: number | null };
      dependencies: { monitored: number };
      changes: { last30Days: number };
      notifications: { sent: number; failed: number };
    }>("/api/v1/org/usage", { token }),
  getChanges: (token: string, params?: string) =>
    apiFetch<{
      changes: Record<string, unknown>[];
      total: number;
      hasMore: boolean;
    }>(`/api/v1/changes${params ? `?${params}` : ""}`, { token }),
  getChange: (token: string, id: string) =>
    apiFetch<Record<string, unknown>>(`/api/v1/changes/${id}`, { token }),
  getDependencies: (token: string) =>
    apiFetch<{ dependencies: Record<string, unknown>[] }>(
      "/api/v1/dependencies",
      { token },
    ),
  getApiKeys: (token: string) =>
    apiFetch<{ keys: Record<string, unknown>[] }>("/api/v1/org/api-keys", {
      token,
    }),
  getChannels: (token: string) =>
    apiFetch<{ channels: Record<string, unknown>[] }>(
      "/api/v1/notifications/channels",
      { token },
    ),
  getRoutingRules: (token: string) =>
    apiFetch<{ rules: Record<string, unknown>[] }>(
      "/api/v1/notifications/routing",
      { token },
    ),
  createCheckout: (token: string, plan: string) =>
    apiFetch<{ url: string }>("/api/v1/billing/checkout", {
      token,
      method: "POST",
      body: { plan },
    }),
};
