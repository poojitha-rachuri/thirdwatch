import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { SITE_URL } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thirdwatch — Know Before You Break",
  description:
    "Scan your codebase, map every external API, SDK, and package dependency, and get alerted before breaking changes hit production.",
  openGraph: {
    title: "Thirdwatch — Know Before You Break",
    description:
      "Continuous monitoring for every external dependency in your codebase.",
    url: SITE_URL,
    siteName: "Thirdwatch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thirdwatch — Know Before You Break",
    description:
      "Continuous monitoring for every external dependency in your codebase.",
  },
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to main content
        </a>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
