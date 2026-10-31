import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

function contentSecurityPolicy(isDev: boolean): string {
  return [
    "default-src 'self'",
    // Next.js inlines its bootstrap scripts; eval is only needed by the dev tooling.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    // The outbox preview renders stored email HTML in a srcDoc iframe.
    "frame-src 'self' about:",
    "frame-ancestors 'none'",
    "form-action 'self' https://github.com",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/(.*)",
        headers: [...securityHeaders, { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) }],
      },
    ];
  },
};

export default nextConfig;
