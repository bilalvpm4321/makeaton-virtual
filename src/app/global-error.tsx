"use client";

import { useEffect } from "react";

// Replaces the root layout when it fails, so it cannot use the app's CSS or fonts. Keep the styles inline.
const page = {
  margin: 0,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  background: "#f7f7f4",
  color: "#16151d",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  WebkitFontSmoothing: "antialiased",
} as const;

const card = {
  width: "100%",
  maxWidth: 420,
  padding: 24,
  textAlign: "center",
  background: "#ffffff",
  border: "1px solid #e6e4de",
  borderRadius: 12,
  boxShadow: "0 1px 2px rgb(22 21 29 / 0.04)",
} as const;

const primaryButton = {
  height: 36,
  padding: "0 16px",
  border: "none",
  borderRadius: 6,
  background: "#5b4cf0",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
} as const;

const secondaryLink = {
  display: "inline-flex",
  alignItems: "center",
  height: 36,
  padding: "0 16px",
  border: "1px solid #dcdad3",
  borderRadius: 6,
  background: "#ffffff",
  color: "#16151d",
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={page}>
        <main style={card}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>
            Something went wrong
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#6b6a73" }}>
            Brightloop hit an unexpected error. It has been logged. Try again, and if it keeps happening, contact the
            team.
          </p>
          {error.digest ? (
            <p style={{ margin: "16px 0 0", fontSize: 12, color: "#6b6a73" }}>
              Reference <code style={{ color: "#16151d" }}>{error.digest}</code>
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
            {/* A full reload is intended here: the root layout itself has failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={secondaryLink}>
              Go home
            </a>
            <button type="button" onClick={() => reset()} style={primaryButton}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
