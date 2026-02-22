import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thirdwatch — Know Before You Break",
  description:
    "Scan your codebase, map every external API, SDK, and package dependency, and get alerted before breaking changes hit production.",
  openGraph: {
    title: "Thirdwatch — Know Before You Break",
    description:
      "Continuous monitoring for every external dependency in your codebase.",
    url: "https://thirdwatch.dev",
    siteName: "Thirdwatch",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thirdwatch — Know Before You Break",
    description:
      "Continuous monitoring for every external dependency in your codebase.",
  },
  metadataBase: new URL("https://thirdwatch.dev"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
