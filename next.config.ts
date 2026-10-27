import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingExcludes: {
    "/*": [
      "./data/staging/**/*",
      "./data/evaluation/**/*",
      "./data/sample-feedback.csv",
      "./data/real-reviews-template.csv",
      "./data/store-reviews-staging-template.csv",
    ],
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
