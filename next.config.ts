import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The menu PDF was renamed; keep old links (and Google's copy) alive.
        source: "/nova-menu.pdf",
        destination: "/Nova%20Menu%20Summer%202026.pdf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
