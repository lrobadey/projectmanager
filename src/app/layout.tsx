import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luca's Project Dashboard",
  description: "Track your music projects, timelines, and ideas.",
  // Behaves like a standalone app when added to a phone home screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Luca's Project Dashboard",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets content extend under the notch / home indicator so we can pad with
  // safe-area insets ourselves.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
