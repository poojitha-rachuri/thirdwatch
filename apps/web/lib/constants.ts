export const SITE_URL = "https://thirdwatch.dev";
export const GITHUB_REPO_URL = "https://github.com/poojitha-rachuri/thirdwatch";
export const GITHUB_API_REPO_URL =
  "https://api.github.com/repos/poojitha-rachuri/thirdwatch";
export const GITHUB_SCHEMA_JSON_URL =
  `${GITHUB_REPO_URL}/blob/main/schema/v1/tdm.schema.json`;

export const INSTALL_OPTIONS = [
  { id: "npm", label: "npm", command: "npm install -g thirdwatch" },
  { id: "brew", label: "brew", command: "brew install thirdwatch/tap/thirdwatch" },
  { id: "pip", label: "pip", command: "pip install thirdwatch" },
] as const;
