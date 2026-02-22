export async function getGitHubStarCount(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/poojitha-rachuri/thirdwatch",
      {
        next: { revalidate: 3600 },
        headers: process.env.GITHUB_TOKEN
          ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
          : {},
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.stargazers_count ?? 0;
  } catch {
    return 0;
  }
}
