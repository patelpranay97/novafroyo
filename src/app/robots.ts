import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/portal",
    },
    sitemap: "https://www.novafroyo.com/sitemap.xml",
  };
}
