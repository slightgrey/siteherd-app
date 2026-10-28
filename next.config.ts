import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server (server.js + only the needed node_modules), for deploying.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  redirects() {
    return [
      // The site Updates tab was replaced by update actions on the Plugins, Themes, Core and Translations tabs.
      { source: "/sites/:id/updates", destination: "/sites/:id/plugins", permanent: false },
      // The cross-site Updates page became Bulk update, with a page per kind.
      { source: "/updates", destination: "/updates/plugins", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
