import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jbm",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
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
