import "server-only";
import { GITHUB_API_REPO_URL } from "@/lib/constants";

interface GitHubRepoResponse {
  stargazers_count?: number;
}

export async function getGitHubStarCount(): Promise<number> {
  try {
    const res = await fetch(GITHUB_API_REPO_URL, {
      next: { revalidate: 3600 },
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {},
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as GitHubRepoResponse;
    return data.stargazers_count ?? 0;
  } catch {
    return 0;
  }
}
