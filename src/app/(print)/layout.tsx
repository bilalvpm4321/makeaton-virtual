import type { ReactNode } from "react";

// Print routes render without the back-office shell or the portal shell.
export default function PrintLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
