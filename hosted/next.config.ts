import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./public/data/**/*",
      "./data/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/app.js",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
