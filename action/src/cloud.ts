// action/src/cloud.ts — Thirdwatch cloud API client for baseline TDM management

import { parseTDM } from "@thirdwatch/tdm";
import type { TDM } from "@thirdwatch/tdm";

const API_BASE = "https://api.thirdwatch.dev";

// ---------------------------------------------------------------------------
// Download baseline TDM from Thirdwatch cloud
// ---------------------------------------------------------------------------

export async function downloadBaselineTDM(
  token: string,
  repository?: string,
): Promise<TDM | null> {
  const url = new URL("/api/v1/tdm/baseline", API_BASE);
  if (repository) {
    url.searchParams.set("repository", repository);
  }

  const response = await fetch(url, {
    headers: {
      "x-api-key": token,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to download baseline TDM: ${response.status} ${response.statusText}`,
    );
  }

  const json: unknown = await response.json();
  return parseTDM(json);
}

// ---------------------------------------------------------------------------
// Upload current TDM to Thirdwatch cloud (becomes baseline for next run)
// ---------------------------------------------------------------------------

export async function uploadTDM(
  token: string,
  tdm: TDM,
): Promise<void> {
  const response = await fetch(new URL("/api/v1/tdm", API_BASE), {
    method: "POST",
    headers: {
      "x-api-key": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tdm),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to upload TDM: ${response.status} ${response.statusText}`,
    );
  }
}
