
import type { Metadata } from "next";
import { Providers } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "GIFTY — Shop Kapruka by Chat",
  description:
    "Sri Lanka's smartest shopping assistant. Find gifts, compare products, and checkout in conversation. Supports English, සිංහල, Tamil, and Tanglish.",
  icons: {
  icon: "/tab1.png",
  shortcut: "/tab1.png",
  apple: "/tab1.png",
  },
  openGraph: {
    title: "GIFTY — Shop Kapruka by Chat",
    description: "Find the perfect gift. Shop in Sinhala, Tamil, Tanglish, or English.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#d3c9c9" media="(prefers-color-scheme: light)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50 transition-colors duration-300">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}