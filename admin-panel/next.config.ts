import type { NextConfig } from "next";

// A production build without NEXT_PUBLIC_API_MODE=mock talks to the real backend, so it must know
// where the backend is and which Google OAuth client to sign in with. Fail the build instead of
// shipping a panel that cannot sign anyone in. (NEXT_PUBLIC_* values are inlined at build time.)
if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_API_MODE !== "mock") {
  const devSignIn = process.env.NEXT_PUBLIC_DEV_SIGN_IN === "true";
  const required = devSignIn ? ["NEXT_PUBLIC_API_URL"] : ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Live admin panel build is missing ${missing.join(" and ")}. Set ${missing.length > 1 ? "them" : "it"} ` +
        "(see .env.example), or set NEXT_PUBLIC_API_MODE=mock to build the demo with mock data.",
    );
  }
}

const nextConfig: NextConfig = {
  // Plain HTML/JS/CSS in out/, served from S3 behind CloudFront. No Node.js server.
  output: "export",
  // /teams/ → out/teams/index.html, which S3 and CloudFront serve without rewrites.
  trailingSlash: true,
  // The image optimiser needs a server; the brand images are small PNGs served as they are.
  images: { unoptimized: true },
};

export default nextConfig;
