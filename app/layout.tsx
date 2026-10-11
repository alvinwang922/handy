import type { Metadata } from "next";

// The UI is the static prototype at public/index.html (served at "/"); this layout only exists
// because the App Router requires one.
export const metadata: Metadata = { title: "Handy" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
