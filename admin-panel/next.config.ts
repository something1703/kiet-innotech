import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node_modules is a symlink to ../client/node_modules, so Turbopack must be allowed to
  // resolve files from the parent folder that contains both apps.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
