import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thirdwatch",
  description: "Know every external API your codebase depends on.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
