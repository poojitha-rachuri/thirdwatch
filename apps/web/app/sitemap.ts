import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://thirdwatch.dev", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://thirdwatch.dev/docs", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: "https://thirdwatch.dev/docs/cli-reference", lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: "https://thirdwatch.dev/tdm-spec", lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];
}
