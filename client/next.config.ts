import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * A live build without its backend URL or Google client ID would ship a portal nobody can sign in to,
 * so `next build` stops with a clear message instead. Mock builds (NEXT_PUBLIC_API_MODE=mock) skip this.
 */
function checkLiveBuildEnv() {
  if (process.env.NEXT_PUBLIC_API_MODE === "mock") return;
  const missing = ["NEXT_PUBLIC_API_URL"];
  // Local development against the real backend signs in through /dev/token, so Google is optional there.
  if (process.env.NEXT_PUBLIC_DEV_SIGN_IN !== "true") missing.push("NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  const empty = missing.filter((name) => !process.env[name]?.trim());
  if (empty.length > 0) {
    throw new Error(
      `Live build is missing ${empty.join(" and ")}. Set ${empty.length === 1 ? "it" : "them"} (see .env.example), ` +
        "or set NEXT_PUBLIC_API_MODE=mock to build the in-browser demo instead.",
    );
  }
}

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) checkLiveBuildEnv();
  return {
    // Plain HTML, CSS and JS in out/, served from S3 behind CloudFront. There is no Next.js server.
    output: "export",
    // /team/ is written as out/team/index.html, which S3 and CloudFront can serve as a directory index.
    trailingSlash: true,
    // Without a server there is no image optimiser; images in public/ are pre-sized and shipped as they are.
    images: { unoptimized: true },
  };
}
