
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GIFTY — Shop Kapruka by Chat",
  description:
    "Sri Lanka's smartest shopping assistant. Find gifts, compare products, and checkout in conversation. Supports English, සිංහල, Tamil, and Tanglish.",
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
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body style={{ margin: 0, background: "#0a0a0a", overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}