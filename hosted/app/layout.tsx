import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  return {
    title: "BioAtlas | OVAITY",
    description: "The OVAITY BioAtlas is a free, continuously expanding knowledge base for life science concepts, laboratory methods and scientific terminology.",
    icons: {
      icon: "/logo-mark.png",
      shortcut: "/logo-mark.png",
    },
    openGraph: {
      title: "The OVAITY BioAtlas",
      description: "Explore the language of life science.",
      type: "website",
      images: [{ url: `${baseUrl}/og-bioatlas.png`, width: 1734, height: 907, alt: "The OVAITY BioAtlas — Explore the language of life science." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "The OVAITY BioAtlas",
      description: "Explore the language of life science.",
      images: [`${baseUrl}/og-bioatlas.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* The external stylesheet supplies the existing OVAITY brand fonts. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
