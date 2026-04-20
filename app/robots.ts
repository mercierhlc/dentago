import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/search", "/login"],
        disallow: ["/admin", "/api/", "/clinic/"],
      },
    ],
    sitemap: "https://www.dentago.co.uk/sitemap.xml",
    host: "https://www.dentago.co.uk",
  };
}
