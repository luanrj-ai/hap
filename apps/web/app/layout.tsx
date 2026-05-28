import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";

// Self-hosted (was next/font/google). Building with Turbopack intermittently
// failed to fetch Google Fonts on a cold cache — "Can't resolve
// '@vercel/turbopack-next/internal/font/google/font'" — which broke cold Vercel
// builds. These are the latin-subset variable woff2 files, so no network is
// touched at build time. See apps/web/app/fonts/.

const inter = localFont({
  src: "./fonts/inter.woff2",
  weight: "400 600",
  variable: "--font-inter",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  weight: "400 600",
  variable: "--font-jbm",
  display: "swap",
});

const serif = localFont({
  src: [
    { path: "./fonts/newsreader.woff2", weight: "400 500", style: "normal" },
    { path: "./fonts/newsreader-italic.woff2", weight: "400 500", style: "italic" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HAP — Hiring Agent Protocol",
  description:
    "An open A2A profile for AI-mediated hiring. Two agents — one for the candidate, one for the recruiter — interview each other with cited, dereferenceable evidence. Federated. Self-hosted. MIT.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = `${inter.variable} ${mono.variable} ${serif.variable}`;
  return (
    <html lang="en" data-theme="light" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
