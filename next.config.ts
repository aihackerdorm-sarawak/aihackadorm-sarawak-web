import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/workshop-1",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
