import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@account-books/ui", "@account-books/types", "@account-books/utils"],
};

export default nextConfig;
